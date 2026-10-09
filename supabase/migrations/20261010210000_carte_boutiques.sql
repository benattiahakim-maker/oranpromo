-- US-24.1 : carte des boutiques — position limitée à la wilaya d'Oran, protégée après validation, lecture des épingles.
-- Décisions du propriétaire (9/10/2026, PR #53) : colonnes existantes boutiques.latitude / longitude (pas de PostGIS),
-- rectangle autour de la wilaya d'Oran, position réservée à l'admin une fois la boutique publiée.
--
-- Bornes : limite administrative de la wilaya d'Oran dans OpenStreetMap, relation 1259187 (admin_level 4,
-- Wikidata Q231331), rectangle englobant lu par Nominatim le 9/10/2026 : latitude 35,3335 à 35,9094,
-- longitude −1,1396 à −0,1137 (îles Habibas comprises), arrondi vers l'extérieur (≈ 1 km de marge).
-- Même rectangle dans lib/position.ts (BORNES_ORAN). Les 2 boutiques en production sont dedans (lecture du 9/10).

-- ---------------------------------------------------------------------------
-- 1. Position : les deux coordonnées ou aucune, et dans la wilaya d'Oran.
--    Contraintes = garantie pour tous (même la clé de service) ; NaN et l'infini ne sont pas « entre » les bornes.
-- ---------------------------------------------------------------------------
alter table public.boutiques
  add constraint boutiques_position_complete check ((latitude is null) = (longitude is null)),
  add constraint boutiques_position_oran check (
    latitude is null or (latitude between 35.33 and 35.92 and longitude between -1.15 and -0.10));

-- Message clair en français avant que la contrainte ne réponde par son nom technique.
create or replace function prive.verifier_position_boutique() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.latitude is null) <> (new.longitude is null) then
    raise exception 'Saisissez la latitude et la longitude, ou aucune des deux.' using errcode = '23514';
  end if;
  if new.latitude is not null and not (new.latitude between 35.33 and 35.92 and new.longitude between -1.15 and -0.10) then
    raise exception 'La position doit être dans la wilaya d''Oran.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function prive.verifier_position_boutique() from public, anon, authenticated;

create trigger boutique_position_verifiee before insert or update of latitude, longitude on public.boutiques
  for each row execute function prive.verifier_position_boutique();

-- ---------------------------------------------------------------------------
-- 2. Boutique publiée (validée ou suspendue) : la position rejoint le nom, le WhatsApp, le slug et les liens,
--    modifiables seulement par un admin. Tant qu'elle est en attente, le commerçant rattaché la règle.
--    Reprise de 20261009120000_securite_corrections_revue.sql, seule la liste des colonnes et le message changent.
-- ---------------------------------------------------------------------------
create or replace function prive.proteger_coordonnees_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- service (clé secrète)
  end if;
  if tg_op = 'UPDATE' and old.statut <> 'en_attente' and not prive.est_admin()
     and (new.nom is distinct from old.nom
       or new.whatsapp is distinct from old.whatsapp
       or new.slug is distinct from old.slug
       or new.instagram is distinct from old.instagram
       or new.facebook is distinct from old.facebook
       or new.latitude is distinct from old.latitude
       or new.longitude is distinct from old.longitude) then
    raise exception 'Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, la position ou les liens.'
      using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.whatsapp is distinct from old.whatsapp)
     and new.whatsapp !~ '^\+213[1-9][0-9]{8}$' then
    raise exception 'Numéro WhatsApp invalide : format attendu +213XXXXXXXXX.' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.instagram is distinct from old.instagram)
     and new.instagram is not null and new.instagram !~ '^https://' then
    raise exception 'Le lien Instagram doit commencer par https://.' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.facebook is distinct from old.facebook)
     and new.facebook is not null and new.facebook !~ '^https://' then
    raise exception 'Le lien Facebook doit commencer par https://.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function prive.proteger_coordonnees_boutique() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Épingles de la carte : une seule lecture légère (ni photo, ni WhatsApp, ni adresse), 500 boutiques au plus.
--    Boutiques validées seulement ; articles comptés avec les filtres publics explicites de lib/catalogue.ts
--    (disponible ou réservé, confirmé il y a moins de 21 jours) : un admin ou un commerçant connecté ne voit
--    rien de plus que le public. « rayons » = couples catégorie / genre distincts des articles visibles ; l'univers
--    est calculé par le site (articleDansUnivers, lib/catalogue.ts) pour garder une seule définition des univers.
--    security invoker : les règles RLS du visiteur s'appliquent en plus.
-- ---------------------------------------------------------------------------
create or replace function public.boutiques_carte(limite integer default 500)
returns table (id uuid, slug text, nom text, quartier text, latitude double precision, longitude double precision,
               promos_en_cours integer, rayons jsonb)
language sql stable security invoker set search_path = public as $$
  select b.id, b.slug, b.nom, b.quartier, b.latitude, b.longitude,
    coalesce((select count(distinct a.id)::integer
                from articles a join promos p on p.article_id = a.id
               where a.boutique_id = b.id and a.statut in ('disponible', 'reserve')
                 and a.derniere_confirmation > now() - interval '21 days'
                 and p.date_fin >= now()), 0),
    coalesce((select jsonb_agg(distinct jsonb_build_object('categorie', a.categorie, 'genre', a.genre))
                from articles a
               where a.boutique_id = b.id and a.statut in ('disponible', 'reserve')
                 and a.derniere_confirmation > now() - interval '21 days'), '[]'::jsonb)
  from boutiques b
  where b.statut = 'validee'
  order by b.nom, b.id
  limit least(greatest(coalesce(limite, 500), 1), 500)
$$;
revoke execute on function public.boutiques_carte(integer) from public;
grant execute on function public.boutiques_carte(integer) to anon, authenticated;

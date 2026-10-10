-- US-29.1 : plusieurs villes (BleDeal). Décisions du propriétaire du 10/10/2026 (PR #86 et #87).
-- Table villes (bornes, centre, ouverte, pays), ville de chaque boutique, bornes vérifiées par ville,
-- épingles de la carte par ville, lecture des villes ouvertes, ville d'un ambassadeur.
-- Oran : mêmes bornes, même message, même contrainte qu'avant (20261010210000_carte_boutiques.sql).
-- Aucune règle de blocage, de no-show, de numéro vérifié, de statut ni de stock n'est touchée.

-- ---------------------------------------------------------------------------
-- 1. Villes. Une ville est ajoutée par migration (bornes lues dans OpenStreetMap, testées), puis ouverte par l'admin.
--    code = adresse (/oran) et cookie « ville » : jamais un mot déjà pris par une page du site.
-- ---------------------------------------------------------------------------
create table public.villes (
  code text primary key
    constraint villes_code_format check (code ~ '^[a-z][a-z-]{1,29}$')
    constraint villes_code_libre check (code not in (
      'admin', 'api', 'apercu-local', 'auth', 'carte', 'catalogue', 'compte', 'confirmer', 'espace', 'langue',
      'manifest', 'panier', 'parrainage', 'retrait', 'robots', 'sitemap', 'ville', 'villes', 'visiteurs')),
  pays text not null default 'DZ' check (pays ~ '^[A-Z]{2}$'),
  numero_wilaya smallint check (numero_wilaya > 0),
  nom text not null check (char_length(btrim(nom)) between 2 and 40),
  nom_ar text not null check (char_length(btrim(nom_ar)) between 2 and 40),
  lat_min double precision not null, lat_max double precision not null,
  lng_min double precision not null, lng_max double precision not null,
  centre_lat double precision not null, centre_lng double precision not null,
  zoom smallint not null default 12 check (zoom between 5 and 16),
  ouverte boolean not null default false,
  ordre smallint not null default 100,
  cree_le timestamptz not null default now(),
  constraint villes_bornes check (lat_min between -90 and 90 and lat_max between -90 and 90 and lng_min between -180 and 180
    and lng_max between -180 and 180 and lat_min < lat_max and lng_min < lng_max),
  constraint villes_centre check (centre_lat between lat_min and lat_max and centre_lng between lng_min and lng_max),
  constraint villes_wilaya_unique unique (pays, numero_wilaya)
);
comment on table public.villes is 'US-29 : villes (wilayas) de BleDeal. Ajout par migration, ouverture par l''admin (/admin/villes).';

-- Feuille de route du propriétaire (10/10/2026) : l'Ouest (Oran, Mostaganem, Relizane, Tlemcen), puis le Centre
-- (Alger, Tizi Ouzou, Béjaïa), puis l'Est (Annaba, Constantine). Seule Oran est ouverte ; l'admin ouvre les autres.
-- Bornes : rectangle de la wilaya dans OpenStreetMap (relation indiquée, limites lues le 10/10/2026 avec Nominatim),
-- élargi d'environ 1 km (0,01°) de chaque côté puis arrondi vers l'extérieur au centième.
-- Oran garde exactement son rectangle d'avant (relation 1259187 : 35,3335–35,9094 / -1,1396 – -0,1137).
-- Centre : chef-lieu dans OpenStreetMap. Les rectangles de deux wilayas voisines se recouvrent un peu : c'est la ville
-- de la boutique qui décide quelles bornes s'appliquent.
insert into public.villes (code, pays, numero_wilaya, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng, zoom, ouverte, ordre)
values
  -- code          pays  n°  nom            nom_ar      lat_min lat_max lng_min lng_max centre_lat centre_lng zoom ouverte ordre   relation OSM : limites brutes
  ('oran',        'DZ', 31, 'Oran',        'وهران',     35.33, 35.92, -1.15, -0.10, 35.6971, -0.6337, 12, true,  1), -- 1259187
  ('mostaganem',  'DZ', 27, 'Mostaganem',  'مستغانم',   35.66, 36.35, -0.13,  0.76, 35.9288,  0.0900, 12, false, 2), -- 1259191 : 35,6716–36,3340 / -0,1156–0,7408
  ('relizane',    'DZ', 48, 'Relizane',    'غليزان',    35.43, 36.24,  0.21,  1.44, 35.7381,  0.5548, 12, false, 3), -- 1282091 : 35,4447–36,2280 / 0,2272–1,4280
  ('tlemcen',     'DZ', 13, 'Tlemcen',     'تلمسان',    34.08, 35.25, -2.23, -0.75, 34.8818, -1.3167, 12, false, 4), -- 1280702 : 34,0967–35,2381 / -2,2185 – -0,7635
  ('alger',       'DZ', 16, 'Alger',       'الجزائر',   36.56, 36.84,  2.78,  3.40, 36.7729,  3.0588, 12, false, 5), -- 157062  : 36,5795–36,8209 / 2,7995–3,3827
  ('tizi-ouzou',  'DZ', 15, 'Tizi Ouzou',  'تيزي وزو',  36.44, 36.93,  3.70,  4.67, 36.7138,  4.0494, 12, false, 6), -- 1283601 : 36,4525–36,9107 / 3,7154–4,6530
  ('bejaia',      'DZ',  6, 'Béjaïa',      'بجاية',     36.20, 36.91,  4.33,  5.50, 36.7512,  5.0644, 12, false, 7), -- 1278765 : 36,2176–36,8959 / 4,3500–5,4830
  ('annaba',      'DZ', 23, 'Annaba',      'عنابة',     36.59, 37.10,  7.27,  7.85, 36.8982,  7.7549, 12, false, 8), -- 1455599 : 36,6029–37,0850 / 7,2848–7,8301
  ('constantine', 'DZ', 25, 'Constantine', 'قسنطينة',   36.08, 36.64,  6.29,  7.06, 36.3642,  6.6084, 12, false, 9); -- 1273368 : 36,0926–36,6243 / 6,3096–7,0493

-- ---------------------------------------------------------------------------
-- 2. Ville de chaque boutique (toutes les boutiques existantes sont à Oran).
--    Valeur par défaut « oran » le temps que le site envoie la ville (retirée en US-29.4).
-- ---------------------------------------------------------------------------
alter table public.boutiques add column ville text not null default 'oran' references public.villes (code);
create index boutiques_ville_statut_idx on public.boutiques (ville, statut);

-- Droits sur villes (après la colonne boutiques.ville, lue par la politique de lecture).
alter table public.villes enable row level security;
-- Lecture : villes ouvertes pour tous ; toutes pour l'admin et l'ambassadeur ; la sienne pour un commerçant.
create policy "lecture des villes" on public.villes for select
  using (ouverte or prive.est_admin_ou_ambassadeur()
         or code = (select b.ville from public.boutiques b where b.id = prive.ma_boutique()));
-- Écriture : l'admin ouvre / ferme et range ; bornes, noms et ajouts seulement par migration.
create policy "admin ouvre une ville" on public.villes for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());
revoke all on public.villes from anon, authenticated;
grant select on public.villes to anon, authenticated;
grant update (ouverte, ordre) on public.villes to authenticated;

-- Oran garde sa garantie par contrainte (même sans déclencheur) ; les autres villes : déclencheur ci-dessous.
alter table public.boutiques drop constraint boutiques_position_oran;
alter table public.boutiques add constraint boutiques_position_oran check (
  ville <> 'oran' or latitude is null or (latitude between 35.33 and 35.92 and longitude between -1.15 and -0.10));

-- Position dans les bornes de la ville de la boutique. Message identique pour Oran : « … dans la wilaya d'Oran. »
create or replace function prive.verifier_position_boutique() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  if (new.latitude is null) <> (new.longitude is null) then
    raise exception 'Saisissez la latitude et la longitude, ou aucune des deux.' using errcode = '23514';
  end if;
  select nom, lat_min, lat_max, lng_min, lng_max into v from public.villes where code = new.ville;
  if not found then
    raise exception 'Ville inconnue.' using errcode = '23503';
  end if;
  if new.latitude is not null and not (new.latitude between v.lat_min and v.lat_max and new.longitude between v.lng_min and v.lng_max) then
    raise exception 'La position doit être dans la wilaya %', prive.de_ville(v.nom) || '.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function prive.verifier_position_boutique() from public, anon, authenticated;

-- « d'Oran », « d'Alger », « de Tlemcen » (élision devant une voyelle ou un h).
create or replace function prive.de_ville(nom text) returns text
language sql immutable set search_path = '' as $$
  select case when nom ~* '^[aeiouyàâäéèêëîïôöùûüh]' then 'd''' || nom else 'de ' || nom end
$$;
revoke execute on function prive.de_ville(text) from public, anon, authenticated;

drop trigger boutique_position_verifiee on public.boutiques;
create trigger boutique_position_verifiee before insert or update of latitude, longitude, ville on public.boutiques
  for each row execute function prive.verifier_position_boutique();

-- ---------------------------------------------------------------------------
-- 3. Ville d'une boutique publiée : seulement par un admin (comme le nom, le WhatsApp, la position et les liens).
--    Reprise de 20261010210000_carte_boutiques.sql : seule la condition sur « ville » s'ajoute (message inchangé).
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
       or new.longitude is distinct from old.longitude
       or new.ville is distinct from old.ville) then
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
-- 4. Ville d'un ambassadeur (facultative) : réglée par l'admin seulement. Déclencheur à part :
--    prive.proteger_profil (numéro, blocage, no-shows) n'est pas modifié.
-- ---------------------------------------------------------------------------
alter table public.profils add column ville text references public.villes (code);

create or replace function prive.proteger_ville_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not prive.est_admin() then
    new.ville := case when tg_op = 'UPDATE' then old.ville end;
  end if;
  return new;
end $$;
revoke execute on function prive.proteger_ville_profil() from public, anon, authenticated;
create trigger profil_ville_protegee before insert or update of ville on public.profils
  for each row execute function prive.proteger_ville_profil();

-- Ville de l'ambassadeur connecté (null : toutes les villes).
create or replace function prive.ma_ville_ambassadeur() returns text
language sql stable security definer set search_path = public as $$
  select ville from profils where id = auth.uid() and role = 'ambassadeur'
$$;
revoke execute on function prive.ma_ville_ambassadeur() from public, anon;
grant execute on function prive.ma_ville_ambassadeur() to authenticated;

-- Création d'une boutique : un ambassadeur avec une ville ne crée que dans sa ville.
alter policy "admin ou ambassadeur crée une boutique" on public.boutiques
  with check (prive.est_admin_ou_ambassadeur() and (prive.est_admin() or prive.ma_ville_ambassadeur() is null or ville = prive.ma_ville_ambassadeur()));

-- ---------------------------------------------------------------------------
-- 5. Épingles de la carte par ville (même lecture qu'avant, ville ouverte seulement ; Oran par défaut).
--    Paramètres dans cet ordre pour que boutiques_carte(1) reste valable.
-- ---------------------------------------------------------------------------
drop function public.boutiques_carte(integer);
create function public.boutiques_carte(limite integer default 500, code_ville text default 'oran')
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
  join villes v on v.code = b.ville and v.ouverte
  where b.statut = 'validee' and b.ville = coalesce(code_ville, 'oran')
  order by b.nom, b.id
  limit least(greatest(coalesce(limite, 500), 1), 500)
$$;
revoke execute on function public.boutiques_carte(integer, text) from public;
grant execute on function public.boutiques_carte(integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Villes ouvertes (page /villes, en-tête) avec le nombre de boutiques validées.
-- ---------------------------------------------------------------------------
create function public.villes_ouvertes()
returns table (code text, pays text, nom text, nom_ar text, lat_min double precision, lat_max double precision,
               lng_min double precision, lng_max double precision, centre_lat double precision, centre_lng double precision,
               zoom smallint, boutiques integer)
language sql stable security invoker set search_path = public as $$
  select v.code, v.pays, v.nom, v.nom_ar, v.lat_min, v.lat_max, v.lng_min, v.lng_max, v.centre_lat, v.centre_lng, v.zoom,
    (select count(*)::integer from boutiques b where b.ville = v.code and b.statut = 'validee')
  from villes v
  where v.ouverte
  order by v.ordre, v.nom
$$;
revoke execute on function public.villes_ouvertes() from public;
grant execute on function public.villes_ouvertes() to anon, authenticated;

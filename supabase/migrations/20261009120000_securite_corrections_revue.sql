-- Sécurité : corrections issues de la revue de code.
-- Les règles ci-dessous sont appliquées par la base : elles tiennent même si le
-- navigateur appelle Supabase directement avec la clé publique.
-- Convention reprise des migrations précédentes : auth.uid() null = service (clé secrète,
-- migrations), prive.est_admin() = administrateur ; les deux passent sans restriction.

-- ---------------------------------------------------------------------------
-- 1. Un article masqué par la modération ne peut être rendu visible que par un admin.
--    Le commerçant peut toujours masquer / démasquer lui-même ses articles : on distingue
--    donc le masquage de modération par une colonne dédiée.
-- ---------------------------------------------------------------------------
alter table articles add column masque_par_moderation boolean not null default false;

-- Reprise : les articles déjà masqués par une décision « masquer » restent verrouillés.
update articles set masque_par_moderation = true
where statut = 'masque'
  and id in (
    select s.article_id from decisions d join signalements s on s.id = d.signalement_id
    where d.action = 'masquer'
  );

alter table articles add constraint articles_masque_par_moderation_check
  check (not masque_par_moderation or statut = 'masque');

-- ---------------------------------------------------------------------------
-- 2. Dates d'un article : fixées par la base pour le commerçant.
--    - création : cree_le et derniere_confirmation = now() ;
--    - modification : cree_le ne change jamais ; une nouvelle derniere_confirmation
--      vaut toujours now() (impossible de dater dans le futur ou dans le passé).
-- ---------------------------------------------------------------------------
-- Reprise : aucune date existante ne reste dans le futur.
update articles set derniere_confirmation = now() where derniere_confirmation > now();
update articles set cree_le = now() where cree_le > now();

create or replace function prive.proteger_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- service (clé secrète)
  end if;
  if prive.est_admin() then
    -- Rendre un article visible lève le verrou de modération.
    if new.statut <> 'masque' then
      new.masque_par_moderation := false;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.masque_par_moderation := false;
    new.cree_le := now();
    new.derniere_confirmation := now();
    return new;
  end if;
  if old.masque_par_moderation and new.statut is distinct from 'masque' then
    raise exception 'Cet article a été masqué par la modération : seul un administrateur peut le rendre visible.'
      using errcode = '42501';
  end if;
  new.masque_par_moderation := old.masque_par_moderation;
  new.cree_le := old.cree_le;
  if new.derniere_confirmation is distinct from old.derniere_confirmation then
    new.derniere_confirmation := now();
  end if;
  return new;
end $$;

revoke execute on function prive.proteger_article() from public, anon, authenticated;

create trigger article_protege before insert or update on articles
  for each row execute function prive.proteger_article();

-- ---------------------------------------------------------------------------
-- 3a. Seuls un admin ou un ambassadeur créent une boutique (US-16).
--     Avant : tout compte sans boutique pouvait en créer une et accéder aux routes IA.
-- ---------------------------------------------------------------------------
alter policy "commerçant crée sa boutique" on boutiques
  with check (prive.est_admin_ou_ambassadeur());
alter policy "commerçant crée sa boutique" on boutiques
  rename to "admin ou ambassadeur crée une boutique";

-- ---------------------------------------------------------------------------
-- 3b. Quota d'appels à l'IA (routes /api/ia/*) : 30 appels par heure et par compte.
--     Table lisible seulement via consommer_quota_ia() (RLS sans aucune politique).
-- ---------------------------------------------------------------------------
create table appels_ia (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null default now()
);
create index appels_ia_utilisateur_idx on appels_ia (utilisateur_id, date);
alter table appels_ia enable row level security;

-- Renvoie true et enregistre l'appel si le quota n'est pas atteint, sinon false.
create or replace function public.consommer_quota_ia() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
begin
  if compte is null then
    raise exception 'Connectez-vous pour utiliser l''IA.' using errcode = '42501';
  end if;
  -- Sérialise les appels simultanés d'un même compte (pas de dépassement par rafale).
  perform pg_advisory_xact_lock(hashtextextended('appels_ia:' || compte::text, 0));
  delete from appels_ia where utilisateur_id = compte and date < now() - interval '1 day';
  if (select count(*) from appels_ia where utilisateur_id = compte and date > now() - interval '1 hour') >= 30 then
    return false;
  end if;
  insert into appels_ia (utilisateur_id) values (compte);
  return true;
end $$;

revoke execute on function public.consommer_quota_ia() from public, anon;
grant execute on function public.consommer_quota_ia() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Coordonnées d'une boutique publiée : nom, WhatsApp, slug, Instagram et Facebook
--    ne changent plus qu'avec un admin (sinon une boutique validée pourrait changer de
--    numéro de réservation sans contrôle). Format vérifié pour toute nouvelle valeur.
--    Un trigger plutôt qu'une contrainte CHECK : les lignes existantes au format libre
--    (ex. « +213 555 12 34 56 ») ne bloquent pas les autres modifications.
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
       or new.facebook is distinct from old.facebook) then
    raise exception 'Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, l''adresse ou les liens.'
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

create trigger coordonnees_boutique_protegees before insert or update on boutiques
  for each row execute function prive.proteger_coordonnees_boutique();

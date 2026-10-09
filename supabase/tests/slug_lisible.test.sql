-- Tests SQL de la migration 20261010120000_slug_lisible.sql (US-22, lien de boutique à partager).
-- Même mode d'emploi que les autres fichiers de supabase/tests :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/slug_lisible.test.sql
-- Tout se passe dans une transaction annulée à la fin : aucune donnée n'est gardée.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
begin;

create function pg_temp.ok(condition boolean, nom text) returns text language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'ÉCHEC - %', nom; end if;
  return 'ok - ' || nom;
end $$;

create function pg_temp.erreur(requete text, code text, morceau text, nom text) returns text language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    if sqlstate = code and position(morceau in sqlerrm) > 0 then return 'ok - ' || nom; end if;
    raise exception 'ÉCHEC - % : erreur % « % »', nom, sqlstate, sqlerrm;
  end;
  raise exception 'ÉCHEC - % : aucune erreur', nom;
end $$;

create function pg_temp.compte(id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(id::text, ''), true);
$$;

create function pg_temp.boutique(slug text) returns text language sql as $$
  select format($q$insert into boutiques (nom, slug, quartier, whatsapp) values ('Boutique test', %L, 'Centre', '+213555930001')$q$, slug);
$$;

-- Comptes : un admin, un commerçant rattaché à une boutique validée et à une boutique en attente.
insert into auth.users (id, email) values
  ('a3000000-0000-0000-0000-000000000001', 'admin-slug@test.dz'),
  ('b3000000-0000-0000-0000-000000000001', 'commercant-slug@test.dz');
update profils set role = 'admin' where id = 'a3000000-0000-0000-0000-000000000001';
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d3000000-0000-0000-0000-000000000001', 'Boutique Lien', 'boutique-lien', 'Centre', '+213555930001', 'validee'),
  ('d3000000-0000-0000-0000-000000000002', 'Boutique Cachee', 'boutique-cachee', 'Centre', '+213555930002', 'en_attente'),
  ('d3000000-0000-0000-0000-000000000003', 'Boutique Suspendue', 'boutique-suspendue', 'Centre', '+213555930003', 'suspendue');
update profils set role = 'commercant', boutique_id = 'd3000000-0000-0000-0000-000000000001' where id = 'b3000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Format
-- ---------------------------------------------------------------------------
select pg_temp.ok(not exists (select 1 from boutiques where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'), 'format : les slugs existants sont lisibles');
select pg_temp.erreur(pg_temp.boutique('-nour'), '23514', 'boutiques_slug_lisible', 'format : tiret au début refusé');
select pg_temp.erreur(pg_temp.boutique('nour-'), '23514', 'boutiques_slug_lisible', 'format : tiret à la fin refusé');
select pg_temp.erreur(pg_temp.boutique('nour--oran'), '23514', 'boutiques_slug_lisible', 'format : tiret doublé refusé');
select pg_temp.erreur(pg_temp.boutique('Nour'), '23514', 'check', 'format : majuscule refusée');
select pg_temp.erreur(pg_temp.boutique('noûr'), '23514', 'check', 'format : accent refusé');
select pg_temp.erreur(pg_temp.boutique('a'), '23514', 'check', 'format : 1 caractère refusé');
select pg_temp.erreur(pg_temp.boutique(repeat('a', 61)), '23514', 'check', 'format : plus de 60 caractères refusé');
select pg_temp.erreur(pg_temp.boutique('boutique-lien'), '23505', 'slug', 'unicité : slug déjà pris refusé');
insert into boutiques (nom, slug, quartier, whatsapp) values ('Boutique Lien', 'boutique-lien-2', 'Centre', '+213555930004');
select pg_temp.ok(exists (select 1 from boutiques where slug = 'boutique-lien-2'), 'format : suffixe -2 accepté');

-- ---------------------------------------------------------------------------
-- Visibilité : seul le lien d'une boutique validée répond au public
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok((select count(*) = 1 from boutiques where slug in ('boutique-lien', 'boutique-cachee', 'boutique-suspendue')),
  'public : seule la boutique validée est lue par son slug');
reset role;

-- ---------------------------------------------------------------------------
-- Stabilité : le commerçant ne change pas le slug d'une boutique publiée, l'admin oui (au bon format)
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('b3000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur($$update boutiques set slug = 'autre-nom' where id = 'd3000000-0000-0000-0000-000000000001'$$,
  '42501', 'seul un administrateur', 'stabilité : le commerçant ne change pas le slug de sa boutique publiée');
select pg_temp.compte('a3000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur($$update boutiques set slug = 'autre--nom' where id = 'd3000000-0000-0000-0000-000000000001'$$,
  '23514', 'boutiques_slug_lisible', 'stabilité : l''admin ne met pas un slug illisible');
update boutiques set slug = 'boutique-lien-oran' where id = 'd3000000-0000-0000-0000-000000000001';
select pg_temp.ok((select slug = 'boutique-lien-oran' from boutiques where id = 'd3000000-0000-0000-0000-000000000001'),
  'stabilité : l''admin peut corriger le slug');
reset role;

select 'Tous les tests SQL du lien de boutique (US-22) passent.';
rollback;

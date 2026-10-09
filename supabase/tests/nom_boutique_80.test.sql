-- Tests SQL de la migration 20261010170000_nom_boutique_80.sql (nom de boutique : 2 à 80 caractères).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/nom_boutique_80.test.sql
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

insert into boutiques (id, nom, slug, quartier, whatsapp) values
  ('d7000000-0000-0000-0000-000000000001', repeat('A', 80), 'nom-quatre-vingts', 'Centre', '+213555970001');
select pg_temp.ok((select char_length(nom) = 80 from boutiques where id = 'd7000000-0000-0000-0000-000000000001'), 'nom de 80 caractères accepté');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp) values (repeat('A', 81), 'nom-81', 'Centre', '+213555970002')$$,
  '23514', 'Le nom de la boutique doit contenir entre 2 et 80 caractères.', 'nom de 81 caractères refusé avec le message clair');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp) values (repeat('A', 120), 'nom-120', 'Centre', '+213555970003')$$,
  '23514', 'entre 2 et 80 caractères', 'nom de 120 caractères refusé (ancienne limite du formulaire)');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp) values ('  A  ', 'nom-1', 'Centre', '+213555970004')$$,
  '23514', 'entre 2 et 80 caractères', 'nom d''un caractère (espaces autour) refusé');
insert into boutiques (id, nom, slug, quartier, whatsapp) values
  ('d7000000-0000-0000-0000-000000000002', '  ' || repeat('B', 80) || '  ', 'nom-espaces', 'Centre', '+213555970005');
select pg_temp.ok((select nom = repeat('B', 80) from boutiques where id = 'd7000000-0000-0000-0000-000000000002'), 'espaces autour retirés : 80 caractères acceptés');
select pg_temp.erreur($$update boutiques set nom = repeat('C', 81) where id = 'd7000000-0000-0000-0000-000000000001'$$,
  '23514', 'entre 2 et 80 caractères', 'modification : 81 caractères refusés');
update boutiques set nom = 'Nouveau nom' where id = 'd7000000-0000-0000-0000-000000000001';
select pg_temp.ok((select nom = 'Nouveau nom' from boutiques where id = 'd7000000-0000-0000-0000-000000000001'), 'modification valide acceptée');
update boutiques set quartier = 'Akid Lotfi' where id = 'd7000000-0000-0000-0000-000000000001';
select pg_temp.ok((select quartier = 'Akid Lotfi' from boutiques where id = 'd7000000-0000-0000-0000-000000000001'), 'autres colonnes : pas de contrôle du nom');
insert into boutiques (id, nom, slug, quartier, whatsapp) values
  ('d7000000-0000-0000-0000-000000000003', repeat('👗', 80), 'nom-emoji', 'Centre', '+213555970006');
select pg_temp.ok((select char_length(nom) = 80 from boutiques where id = 'd7000000-0000-0000-0000-000000000003'), '80 émojis acceptés (même compte que le site)');
select pg_temp.ok((select count(*) = 0 from boutiques where char_length(nom) not between 2 and 80), 'aucune boutique hors limite');

rollback;
\echo 'Tous les tests SQL du nom de boutique passent.'

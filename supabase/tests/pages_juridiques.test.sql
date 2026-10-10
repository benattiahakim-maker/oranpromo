-- Tests SQL de la migration 20261017090000_pages_juridiques.sql (US-34.1) : les adresses des pages juridiques ne
-- peuvent pas devenir le code d'une ville.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/pages_juridiques.test.sql
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

select pg_temp.erreur($q$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng)
  select 'conditions', 'Essai', 'تجربة', lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng from villes where code = 'oran'$q$,
  '23514', 'villes_code_libre_juridique', 'code « conditions » refusé');
select pg_temp.erreur($q$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng)
  select 'conditions-commercants', 'Essai', 'تجربة', lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng from villes where code = 'oran'$q$,
  '23514', 'villes_code_libre_juridique', 'code « conditions-commercants » refusé');
select pg_temp.ok(exists (select 1 from pg_constraint where conname = 'villes_code_libre'), 'contrainte villes_code_libre toujours là');
insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng)
  select 'conditions-test', 'Essai', 'تجربة', lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng from villes where code = 'oran';
select pg_temp.ok(exists (select 1 from villes where code = 'conditions-test'), 'un autre code reste accepté');
select pg_temp.erreur($q$update villes set code = 'confidentialite' where code = 'conditions-test'$q$,
  '23514', 'villes_code_libre_juridique', 'code « confidentialite » refusé (modification)');

rollback;

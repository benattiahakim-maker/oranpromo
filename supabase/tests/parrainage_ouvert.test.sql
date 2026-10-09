-- Tests SQL de la migration 20261012100000_parrainage_ouvert.sql (US-27.3 : interrupteur lisible par les pages publiques).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parrainage_ouvert.test.sql
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

delete from prive.reglages where cle = 'parrainage';
set local role anon;
select pg_temp.ok(public.parrainage_ouvert() = false, 'interrupteur absent : fermé (visiteur)');
reset role;

insert into prive.reglages (cle, valeur) values ('parrainage', 'on');
set local role anon;
select pg_temp.ok(public.parrainage_ouvert() = true, 'interrupteur « on » : ouvert (visiteur)');
reset role;
set local role authenticated;
select pg_temp.ok(public.parrainage_ouvert() = true, 'interrupteur « on » : ouvert (client connecté)');
reset role;

update prive.reglages set valeur = 'off' where cle = 'parrainage';
select pg_temp.ok(public.parrainage_ouvert() = false, 'valeur autre que « on » : fermé');

select pg_temp.ok(not has_function_privilege('public', 'public.parrainage_ouvert()', 'execute'), 'pas de droit pour PUBLIC');
select pg_temp.ok(has_function_privilege('anon', 'public.parrainage_ouvert()', 'execute'), 'droit pour anon');
select pg_temp.ok(pg_get_function_result('public.parrainage_ouvert()'::regprocedure) = 'boolean', 'ne renvoie qu''un booléen');
set local role anon;
select pg_temp.ok(not has_table_privilege('prive.reglages', 'select'), 'prive.reglages toujours illisible pour anon');
reset role;
rollback;

-- Garde-fou PostgREST (correctif 20261017100000_abonnements_cle_technique.sql, après US-31.1).
-- Une table dont la clé primaire contient deux clés étrangères est vue par PostgREST comme une table de liaison
-- (relation plusieurs-à-plusieurs). Si les deux tables liées ont déjà une clé étrangère directe entre elles, les lectures
-- « a → b(…) » deviennent ambiguës (erreur PGRST201) et des pages cassent (ex. /espace/commandes le 10/10).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/relations_postgrest.test.sql
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

create temp view jonctions_ambigues as
with fk as (select conrelid, confrelid, conkey from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace),
pk as (select conrelid, conkey from pg_constraint where contype = 'p' and connamespace = 'public'::regnamespace)
select f1.conrelid::regclass::text as jonction, f1.confrelid::regclass::text as a, f2.confrelid::regclass::text as b
from fk f1
join fk f2 on f1.conrelid = f2.conrelid and f1.confrelid < f2.confrelid
join pk on pk.conrelid = f1.conrelid
where f1.conkey <@ pk.conkey and f2.conkey <@ pk.conkey
  and exists (select 1 from fk d where (d.conrelid = f1.confrelid and d.confrelid = f2.confrelid)
                                    or (d.conrelid = f2.confrelid and d.confrelid = f1.confrelid));

select pg_temp.ok(not exists (select 1 from jonctions_ambigues),
  'aucune table de liaison entre deux tables déjà reliées directement : ' || coalesce((select string_agg(jonction || ' (' || a || ' ↔ ' || b || ')', ', ') from jonctions_ambigues), 'aucune'));

select pg_temp.ok((select array_agg(a.attname::text order by a.attname) from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.abonnements_boutique'::regclass and c.contype = 'p') = array['id'],
  'abonnements_boutique : clé primaire technique (id)');
select pg_temp.ok((select array_agg(a.attname::text order by a.attname) from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conname = 'abonnements_boutique_profil_boutique_key' and c.contype = 'u') = array['boutique_id', 'profil_id'],
  'abonnements_boutique : un seul abonnement par client et par boutique (contrainte d''unicité)');

rollback;

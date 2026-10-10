-- Tests SQL de la migration 20261015110000_search_path_whatsapp_arabe.sql (relecture n°6, point 4).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/search_path.test.sql
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

select pg_temp.ok((select bool_and(coalesce(array_to_string(proconfig, ','), '') like '%search_path=%') from pg_proc
  where oid in ('prive.gabarit_whatsapp_arabe(text)'::regprocedure, 'prive.parametres_whatsapp_arabe(text, text[])'::regprocedure)),
  'search_path fixé sur gabarit_whatsapp_arabe et parametres_whatsapp_arabe');
-- Comme l'outil de conseils de Supabase : aucune fonction de public ni de prive (hors extensions) sans search_path.
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname in ('public', 'prive') and d.objid is null
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'),
  'aucune fonction de public ou prive sans search_path fixé');
-- Les deux fonctions marchent toujours avec un search_path vide.
select pg_temp.ok(prive.gabarit_whatsapp_arabe('oranpromo_commande_prete') like 'السلام {{1}}%'
  and prive.gabarit_whatsapp_arabe('oranpromo_nouvelle_commande') is null,
  'gabarit_whatsapp_arabe : texte arabe, null sans version arabe');
select pg_temp.ok(prive.parametres_whatsapp_arabe('oranpromo_commande_prete', array['cher client', '12', 'Boutique Nour', '10/10 à 18h30'])
  = array['خويا', '12', 'Boutique Nour', '10/10 على 18:30']
  and prive.parametres_whatsapp_arabe('oranpromo_commande_prete', array['Amine', '12', 'Nour', 'dans les 24 heures'])
  = array['Amine', '12', 'Nour', 'تفوت 24 ساعة'],
  'parametres_whatsapp_arabe : « خويا », date et délai en arabe (expressions régulières sans search_path)');

rollback;

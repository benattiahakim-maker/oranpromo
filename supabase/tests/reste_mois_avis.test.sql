-- Tests SQL de la migration 20261019140000_reste_mois_avis.sql (reste du mois des programmes à budget mensuel).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/reste_mois_avis.test.sql
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

grant execute on function pg_temp.ok(boolean, text), pg_temp.erreur(text, text, text, text), pg_temp.compte(uuid) to anon, authenticated;


-- Boutiques : A (avis groupés), B (même numéro + retraits rapides), C (comptes récents), D (sous les seuils).
insert into auth.users (id, email) values ('a3360000-0000-0000-0000-000000000001', 'admin336@test.dz'), ('c3360000-0000-0000-0000-000000000001', 'client336@test.dz');
update profils set role = 'admin' where id = 'a3360000-0000-0000-0000-000000000001';
select pg_temp.ok((prive.regler_bon_avis(1000)).budget = 1000, 'programme « avis » : budget du mois 1 000 DA');
create temp table t_prog as select id from programmes_bons where type = 'avis';
grant select on t_prog to authenticated;
-- Bons « avis » : 2 ce mois-ci (dont 1 annulé), 3 le mois dernier ; un bon de bienvenue ce mois-ci.
set local session_replication_role = replica;
insert into bons (profil_id, montant, origine, programme_id, minimum_achat, statut, expire_le, cree_le)
select 'c3360000-0000-0000-0000-000000000001', 150, 'avis', (select id from t_prog), 1500, s, now() + interval '30 days', c
from (values ('disponible', now()), ('annule', now()), ('disponible', now() - interval '1 month'), ('disponible', now() - interval '1 month'), ('expire', now() - interval '1 month')) v(s, c);
insert into bons (profil_id, montant, origine, programme_id, minimum_achat, statut, expire_le)
select 'c3360000-0000-0000-0000-000000000001', 300, 'bienvenue', p.id, 2000, 'disponible', now() + interval '30 days' from programmes_bons p where p.type = 'bienvenue';
set local session_replication_role = origin;

set local role authenticated;
select pg_temp.compte('c3360000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select reste_mois_programmes()$$, '42501', 'Réservé', 'client : refusé');
select pg_temp.compte('a3360000-0000-0000-0000-000000000001');
select pg_temp.ok(reste_mois_programmes() = jsonb_build_array(jsonb_build_object('id', (select id from t_prog), 'restant', 850)),
  'reste du mois : 1 000 − 150 (bon du mois ; annulé, mois dernier et bienvenue non comptés)');
select pg_temp.ok((select (e->>'restant')::int from jsonb_array_elements(programmes_admin()) e where e->>'type' = 'avis') = 1000 - 4 * 150,
  'programmes_admin inchangé (reste sur tout le budget)');
reset role;
select pg_temp.ok(not has_function_privilege('anon', 'public.reste_mois_programmes()', 'execute'), 'droits : pas les visiteurs');

rollback;

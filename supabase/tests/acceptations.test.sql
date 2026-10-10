-- Tests SQL de la migration 20261017200000_acceptations.sql (US-34.2, US-34.3) : versions des textes juridiques,
-- acceptations datées par rôle, nouvelle version importante, droits.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/acceptations.test.sql
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

-- 0. Règles existantes inchangées (empreintes identiques à supabase/tests/parrainage.test.sql).
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','passer_commande'),('public','declarer_no_show'),('prive','recalculer_no_shows'),
    ('public','bloquer_client'),('prive','proteger_profil'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bloquer_client=7016b3730777461fcba4654207debc91,declarer_no_show=0457027879fe08544fca36316f8056b1,passer_commande=d18a962833a100d12f0b317e46973640,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be',
  'passer_commande, no-shows, blocage, vérification du numéro : définitions inchangées');

insert into auth.users (id, email) values
  ('c3400000-0000-0000-0000-000000000001', 'client34a@test.dz'), ('c3400000-0000-0000-0000-000000000002', 'client34b@test.dz'),
  ('b3400000-0000-0000-0000-000000000001', 'boutique34@test.dz'), ('a3400000-0000-0000-0000-000000000001', 'admin34@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3400000-0000-0000-0000-000000000001', 'Boutique Conditions', 'boutique-conditions', 'Gambetta', '+213555340901', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd3400000-0000-0000-0000-000000000001' where id = 'b3400000-0000-0000-0000-000000000001';
update profils set role = 'admin' where id = 'a3400000-0000-0000-0000-000000000001';

-- 1. Versions publiées
select pg_temp.ok((select count(*) from versions_documents where version = '2026-10-10' and importante) = 3, 'trois textes publiés le 10/10/2026, importants');
set local role anon;
select pg_temp.ok((select count(*) from versions_documents) = 3, 'versions lisibles par un visiteur');
select pg_temp.erreur($q$insert into versions_documents (document, version) values ('conditions', '2027-01-01')$q$, '42501', 'permission denied', 'un visiteur ne publie pas de version');
select pg_temp.erreur($q$select * from documents_a_accepter()$q$, '42501', 'permission denied', 'documents_a_accepter réservé aux comptes connectés');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'inscription')$q$, '42501', 'permission denied', 'accepter_documents réservé aux comptes connectés');
reset role;

-- 2. Client : conditions + confidentialité
select pg_temp.compte('c3400000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.ok((select string_agg(document || '@' || version, ',') from documents_a_accepter()) = 'conditions@2026-10-10,confidentialite@2026-10-10',
  'client : conditions et confidentialité à accepter');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-09-01']::date[], 'inscription')$q$, '22023', 'Les conditions ont changé', 'ancienne version refusée');
select pg_temp.erreur($q$select accepter_documents(array['conditions_commercants'], array['2026-10-10']::date[], 'inscription')$q$, '42501', 'ne concerne pas votre compte', 'client : conditions commerçants refusées');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'ailleurs')$q$, '22023', 'Contexte', 'contexte inconnu refusé');
select pg_temp.erreur($q$select accepter_documents(array['conditions', 'confidentialite'], array['2026-10-10']::date[], 'inscription')$q$, '22023', 'invalides', 'tableaux de tailles différentes refusés');
select pg_temp.erreur($q$insert into acceptations (profil_id, document, version, contexte) values (auth.uid(), 'conditions', '2026-10-10', 'inscription')$q$, '42501', 'permission denied', 'pas d''écriture directe dans acceptations');
select accepter_documents(array['conditions', 'confidentialite'], array['2026-10-10', '2026-10-10']::date[], 'inscription');
select pg_temp.ok(not exists (select 1 from documents_a_accepter()), 'après acceptation : plus rien à accepter');
select pg_temp.ok((select count(*) from acceptations where contexte = 'inscription') = 2, 'deux acceptations lisibles par le client, contexte inscription');
select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'commande');
select pg_temp.ok((select count(*) from acceptations) = 2 and (select contexte from acceptations where document = 'conditions') = 'inscription',
  'accepter deux fois ne change rien (date et contexte d''origine gardés)');
reset role;
select pg_temp.erreur($q$update acceptations set accepte_le = now() - interval '1 year'$q$, '42501', 'ne se modifie pas', 'une acceptation ne se modifie jamais (même par le propriétaire de la base)');

-- 3. Lecture : un autre client ne voit rien, l'admin voit tout
select pg_temp.compte('c3400000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.ok((select count(*) from acceptations) = 0, 'un autre client ne lit pas les acceptations des autres');
reset role;
select pg_temp.compte('a3400000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.ok((select count(*) from acceptations) = 2, 'l''admin lit toutes les acceptations');
select pg_temp.ok(not exists (select 1 from documents_a_accepter()), 'admin : rien à accepter');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'espace')$q$, '42501', 'ne concerne pas', 'admin : acceptation refusée');
reset role;

-- 4. Commerçant : conditions commerçants + confidentialité
select pg_temp.compte('b3400000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.ok((select string_agg(document, ',') from documents_a_accepter()) = 'conditions_commercants,confidentialite', 'commerçant : conditions commerçants et confidentialité');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'espace')$q$, '42501', 'ne concerne pas', 'commerçant : conditions clients refusées');
select accepter_documents(array['conditions_commercants', 'confidentialite'], array['2026-10-10', '2026-10-10']::date[], 'espace');
select pg_temp.ok(not exists (select 1 from documents_a_accepter()), 'commerçant : plus rien à accepter');
reset role;

-- 5. Nouvelle version importante, version mineure, version à venir
insert into versions_documents (document, version, importante) values ('conditions', '2026-12-01', true), ('confidentialite', '2026-12-02', false);
insert into versions_documents (document, version, importante, en_vigueur_le) values ('conditions_commercants', '2026-12-03', true, now() + interval '1 day');
select pg_temp.compte('c3400000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.ok((select string_agg(document || '@' || version, ',') from documents_a_accepter()) = 'conditions@2026-12-01',
  'nouvelle version importante des conditions : à accepter ; version mineure de la confidentialité : non');
select pg_temp.erreur($q$select accepter_documents(array['conditions'], array['2026-10-10']::date[], 'commande')$q$, '22023', 'Les conditions ont changé', 'l''ancienne version ne suffit plus');
select accepter_documents(array['conditions'], array['2026-12-01']::date[], 'commande');
select pg_temp.ok(not exists (select 1 from documents_a_accepter()), 'nouvelle version acceptée');
select pg_temp.ok((select count(*) from acceptations) = 3, 'l''ancienne acceptation reste (historique)');
reset role;
select pg_temp.compte('b3400000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.ok(not exists (select 1 from documents_a_accepter()), 'version pas encore en vigueur : rien à accepter');
reset role;

-- 6. Suppression du compte : ses acceptations partent avec lui
delete from auth.users where id = 'c3400000-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) from acceptations where profil_id = 'c3400000-0000-0000-0000-000000000001') = 3, 'acceptations des autres comptes gardées');
select pg_temp.ok(has_function_privilege('authenticated', 'public.documents_a_accepter()', 'execute')
  and not has_function_privilege('anon', 'public.accepter_documents(text[], date[], text)', 'execute'), 'droits d''exécution');
rollback;

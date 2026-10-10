-- Tests SQL de la migration 20261018100000_bon_bienvenue.sql (US-33.2) : bon de bienvenue donné quand le numéro
-- est vérifié (programme actif, budget, une fois par numéro), jamais en plus d'un bon de parrainage, utilisable
-- dès 2 000 DA ; la vérification du numéro ne change pas et n'échoue jamais à cause du bon.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bon_bienvenue.test.sql
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

create function pg_temp.compte(id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(id::text, ''), true);
$$;

-- 0. Définitions inchangées : vérification du numéro, blocage, no-shows, commandes, choix du parrain, bons.
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','recalculer_no_shows'),
    ('public','passer_commande'),('public','changer_statut_commande'),('public','choisir_parrain'),('public','utiliser_bon'),
    ('prive','donner_bon_programme'),('prive','bons_apres_statut'),('prive','proteger_profil')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bons_apres_statut=d8179836c23d7cd58776ced0dcd6daee,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,choisir_parrain=c15c674b039da99a5370b4f3e70e0b9c,donner_bon_programme=07c68f57d8b60505e1b6fcbff0e750d0,passer_commande=d18a962833a100d12f0b317e46973640,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,utiliser_bon=6ded97cf884bac444cf82f89b7f5a254', 'vérification du numéro, blocage, no-shows, commandes, parrain, bons : définitions inchangées');

-- Comptes : un numéro par compte (2135553320xx), vérifié en remplissant phone_confirmed_at.
create function pg_temp.client(i integer, verifie boolean default true) returns uuid language plpgsql as $$
declare cid uuid := ('c3320000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;
begin
  insert into auth.users (id, phone, phone_confirmed_at) values (cid, '2135553320' || lpad(i::text, 2, '0'), case when verifie then now() end);
  update profils set nom = 'Client ' || chr(64 + i) where profils.id = cid;
  return cid;
end $$;
create function pg_temp.verifier(cid uuid, oui boolean) returns void language sql as $$
  update auth.users set phone_confirmed_at = case when oui then now() end where auth.users.id = cid;
$$;
create function pg_temp.bienvenue(cid uuid) returns bigint language sql as $$
  select count(*) from bons where profil_id = cid and origine = 'bienvenue'
$$;
create function pg_temp.statut_bienvenue(cid uuid) returns text language sql as $$
  select string_agg(statut, ',' order by cree_le) from bons where profil_id = cid and origine = 'bienvenue'
$$;

-- 1. Programme inactif (état de la migration) : rien n'est donné, la vérification se fait.
select pg_temp.client(1);
select pg_temp.ok((select telephone_verifie_le is not null from profils where id = 'c3320000-0000-0000-0000-000000000001'),
  'programme inactif : numéro vérifié comme avant');
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000001') = 0, 'programme inactif : aucun bon de bienvenue');

-- 2. Programme actif, budget pour 2 bons (un compte supprimé rend son bon non utilisé au budget) : bon donné à la vérification, 300 DA dès 2 000 DA, 30 jours.
update programmes_bons set actif = true, budget = 600 where type = 'bienvenue';
select pg_temp.client(2);
select pg_temp.ok((select count(*) from bons b join programmes_bons p on p.id = b.programme_id
  where b.profil_id = 'c3320000-0000-0000-0000-000000000002' and b.origine = 'bienvenue' and b.statut = 'disponible'
    and b.montant = 300 and b.minimum_achat = 2000 and p.type = 'bienvenue'
    and b.expire_le between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour') = 1,
  'numéro vérifié : bon de bienvenue de 300 DA dès 2 000 DA, 30 jours');
-- Compte créé sans numéro vérifié : bon donné quand il le vérifie.
select pg_temp.client(3, false);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000003') = 0, 'numéro pas encore vérifié : pas de bon');
select pg_temp.verifier('c3320000-0000-0000-0000-000000000003', true);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000003') = 1, 'numéro vérifié ensuite : bon donné');

-- 3. Une fois par numéro : numéro perdu puis revérifié, ou compte supprimé puis recréé avec le même numéro.
select pg_temp.verifier('c3320000-0000-0000-0000-000000000002', false);
select pg_temp.verifier('c3320000-0000-0000-0000-000000000002', true);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000002') = 1, 'numéro revérifié : pas de 2e bon');
delete from auth.users where id = 'c3320000-0000-0000-0000-000000000003';
insert into auth.users (id, phone, phone_confirmed_at) values ('c3320000-0000-0000-0000-000000000033', '213555332003', now());
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000033') = 0, 'compte recréé avec le même numéro : pas de bon');

-- 4. Pas de bon si le compte a déjà une commande récupérée.
select pg_temp.ok((select prive.droit_bon_bienvenue('c3320000-0000-0000-0000-000000000001')), 'client sans commande : a droit au bon');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville, bons_acceptes) values
  ('d3320000-0000-0000-0000-00000000000a', 'Boutique Bienvenue', 'boutique-bienvenue', 'Gambetta', '+213555332901', 'validee', 'oran', true);
insert into auth.users (id, email) values ('b3320000-0000-0000-0000-00000000000a', 'boutique332@test.dz');
update profils set role = 'commercant', boutique_id = 'd3320000-0000-0000-0000-00000000000a' where id = 'b3320000-0000-0000-0000-00000000000a';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3320000-0000-0000-0000-00000000000a', 'd3320000-0000-0000-0000-00000000000a', 'Robe bienvenue', 'Robes', 2500, 'femme'),
  ('e3320000-0000-0000-0000-00000000000b', 'd3320000-0000-0000-0000-00000000000a', 'Foulard bienvenue', 'Hijabs et foulards', 1500, 'femme');
insert into tailles (article_id, libelle, disponible, quantite) values
  ('e3320000-0000-0000-0000-00000000000a', 'M', true, 50), ('e3320000-0000-0000-0000-00000000000b', 'M', true, 50);
create function pg_temp.commande(client uuid, article uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d3320000-0000-0000-0000-00000000000a', format('[{"article_id":"%s","taille":"M","quantite":1}]', article)::jsonb);
  perform pg_temp.compte(null);
  update commandes set cree_le = cree_le - interval '2 hours' where id = c;
  return c;
end $$;
create function pg_temp.statut(c uuid, s text) returns void language plpgsql as $$
begin
  perform pg_temp.compte('b3320000-0000-0000-0000-00000000000a');
  perform changer_statut_commande(c, s::statut_commande);
  perform pg_temp.compte(null);
end $$;
select pg_temp.commande('c3320000-0000-0000-0000-000000000001', 'e3320000-0000-0000-0000-00000000000b') as commande_a \gset
select pg_temp.statut(:'commande_a', 'confirmee');
select pg_temp.statut(:'commande_a', 'prete');
select pg_temp.statut(:'commande_a', 'recuperee');
select pg_temp.ok(not prive.droit_bon_bienvenue('c3320000-0000-0000-0000-000000000001'), 'commande déjà récupérée : pas de droit');
select pg_temp.ok(prive.donner_bon_bienvenue('c3320000-0000-0000-0000-000000000001') = 'droit'
  and pg_temp.bienvenue('c3320000-0000-0000-0000-000000000001') = 0, 'commande déjà récupérée : aucun bon donné');

-- 5. Commerçant : jamais de bon de bienvenue.
select pg_temp.ok(not prive.droit_bon_bienvenue('b3320000-0000-0000-0000-00000000000a'), 'commerçant : pas de droit');

-- 6. Filleul : pas de bon de bienvenue en plus du parrainage.
-- 6a. parrain trouvé après le bon de bienvenue : le bon disponible est annulé (et ne compte plus dans le budget).
select pg_temp.client(4);
select pg_temp.ok(pg_temp.statut_bienvenue('c3320000-0000-0000-0000-000000000004') = 'disponible', 'futur filleul : bon de bienvenue reçu');
select pg_temp.ok(prive.budget_programme_restant((select id from programmes_bons where type = 'bienvenue')) = 0, 'budget atteint (2 bons en cours, le bon du compte supprimé ne compte plus)');
insert into parrainages (filleul_id, parrain_id) values ('c3320000-0000-0000-0000-000000000004', null);
select pg_temp.ok(pg_temp.statut_bienvenue('c3320000-0000-0000-0000-000000000004') = 'disponible', 'saisie sans parrain trouvé : bon gardé');
update parrainages set parrain_id = 'c3320000-0000-0000-0000-000000000002' where filleul_id = 'c3320000-0000-0000-0000-000000000004';
select pg_temp.ok(pg_temp.statut_bienvenue('c3320000-0000-0000-0000-000000000004') = 'annule', 'parrain trouvé : bon de bienvenue annulé');
select pg_temp.ok(prive.budget_programme_restant((select id from programmes_bons where type = 'bienvenue')) = 300, 'bon annulé : budget rendu');
select pg_temp.ok(not prive.droit_bon_bienvenue('c3320000-0000-0000-0000-000000000004'), 'filleul : pas de droit');
-- 6b. numéro déjà parrainé (sur un autre compte) : pas de bon.
select pg_temp.client(5, false);
insert into prive.numeros_parraines (empreinte, filleul_id) values (prive.empreinte_numero('+213555332005'), null);
select pg_temp.verifier('c3320000-0000-0000-0000-000000000005', true);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000005') = 0, 'numéro déjà parrainé : pas de bon de bienvenue');
-- 6c. bon de parrainage du filleul inchangé par le déclencheur (seul le bon de bienvenue disponible est touché).
select pg_temp.ok(not exists (select 1 from bons where origine like 'parrainage%' and statut = 'annule'), 'bons de parrainage non touchés');

-- 7. Budget épuisé : plus de bon, la vérification se fait.
select pg_temp.client(6);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000006') = 1, 'budget rendu par l''annulation : bon donné');
select pg_temp.client(7);
select pg_temp.ok(pg_temp.bienvenue('c3320000-0000-0000-0000-000000000007') = 0
  and (select telephone_verifie_le is not null from profils where id = 'c3320000-0000-0000-0000-000000000007'),
  'budget épuisé : pas de bon, numéro vérifié');

-- 8. Au panier : dès 2 000 DA seulement ; un seul bon par commande.
select pg_temp.commande('c3320000-0000-0000-0000-000000000006', 'e3320000-0000-0000-0000-00000000000b') as petite,
       pg_temp.commande('c3320000-0000-0000-0000-000000000006', 'e3320000-0000-0000-0000-00000000000a') as grande \gset
select pg_temp.compte('c3320000-0000-0000-0000-000000000006');
select pg_temp.ok(utiliser_bon(:'petite') = 'minimum', 'commande de 1 500 DA : bon de bienvenue refusé (minimum)');
select pg_temp.ok(utiliser_bon(:'grande') = 'applique', 'commande de 2 500 DA : bon de bienvenue posé');
select pg_temp.compte(null);
select pg_temp.ok(pg_temp.statut_bienvenue('c3320000-0000-0000-0000-000000000006') = 'reserve', 'bon réservé pour la commande');

-- 9. Une erreur dans le bon de bienvenue n'empêche pas la vérification du numéro.
create or replace function prive.donner_bon_bienvenue(compte uuid) returns text language plpgsql as $$
begin raise exception 'panne simulée'; end $$;
select pg_temp.client(8);
select pg_temp.ok((select telephone_verifie_le is not null from profils where id = 'c3320000-0000-0000-0000-000000000008'),
  'panne du bon de bienvenue : numéro vérifié quand même');

-- 10. Droits : fonctions internes fermées aux comptes.
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.donner_bon_bienvenue(uuid)', 'execute')
  and not has_function_privilege('anon', 'prive.droit_bon_bienvenue(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.bon_bienvenue_filleul()', 'execute'),
  'fonctions internes : aucun droit pour anon et authenticated');

rollback;

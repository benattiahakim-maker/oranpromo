-- Tests SQL de la migration 20261018130000_bons_admin.sql (US-33.5) : créer une campagne, l'arrêter, chiffres,
-- historique des prix et signaux ; origine « avis » acceptée (US-32.5) ; rien d'existant ne change.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bons_admin.test.sql
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
create function pg_temp.compte(cid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(cid::text, ''), true);
$$;
-- Message d'erreur d'une instruction (ou « ok »).
create function pg_temp.erreur(instruction text) returns text language plpgsql as $$
begin
  execute instruction;
  return 'ok';
exception when others then return sqlerrm;
end $$;

-- 0. Définitions inchangées.
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','utiliser_bon'),('prive','raison_bon'),('prive','donner_bon_programme'),('public','passer_commande'),
    ('public','changer_statut_commande'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','bons_apres_statut')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bons_apres_statut=bdd1ffb334b87f6cef2fe350040f5ec0,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,donner_bon_programme=07c68f57d8b60505e1b6fcbff0e750d0,passer_commande=d18a962833a100d12f0b317e46973640,raison_bon=84d557a918e400bd125a0349d62d64a2,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,utiliser_bon=6ded97cf884bac444cf82f89b7f5a254', 'utiliser_bon, raison_bon, commandes, numéro, blocage : définitions inchangées');

-- Données : un admin, deux clients (dont un compte récent), une boutique, deux articles.
insert into auth.users (id, email) values ('c3350000-0000-0000-0000-0000000000ad', 'admin-bons@example.test'), ('c3350000-0000-0000-0000-00000000000a', 'nour-bons@example.test');
insert into auth.users (id, phone, phone_confirmed_at)
select ('c3350000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2135553350' || lpad(i::text, 2, '0'), now() from generate_series(1, 2) i;
update profils set role = 'admin', nom = 'Admin Bons' where id = 'c3350000-0000-0000-0000-0000000000ad';
update profils set nom = 'Client ' || chr(64 + right(id::text, 1)::integer) where id::text like 'c3350000-%' and right(id::text, 2) in ('01', '02');
update profils set cree_le = now() - interval '60 days' where id = 'c3350000-0000-0000-0000-000000000001';
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3350000-0000-0000-0000-00000000000a', 'Boutique Signaux', 'boutique-signaux', 'Gambetta', '+213555335901', 'validee', 'oran');
update profils set role = 'commercant', nom = 'Nour', boutique_id = 'd3350000-0000-0000-0000-00000000000a' where id = 'c3350000-0000-0000-0000-00000000000a';
insert into articles (id, boutique_id, titre, categorie, prix, genre, cree_le) values
  ('e3350000-0000-0000-0000-00000000000a', 'd3350000-0000-0000-0000-00000000000a', 'Robe signal', 'Robes', 4000, 'femme', now() - interval '60 days'),
  ('e3350000-0000-0000-0000-00000000000b', 'd3350000-0000-0000-0000-00000000000a', 'Jupe signal', 'Jupes', 4500, 'femme', now() - interval '3 days');
insert into tailles (article_id, libelle, disponible, quantite)
select a, 'M', true, 50 from unnest(array['e3350000-0000-0000-0000-00000000000a','e3350000-0000-0000-0000-00000000000b']::uuid[]) a;

-- 1. Créer une campagne : admin seulement, fin obligatoire, code normalisé et unique, villes connues.
create function pg_temp.creer(cid uuid, code text, fin timestamptz, villes text[] default '{oran}') returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.compte(cid);
  r := pg_temp.erreur(format('select creer_campagne(%L, %L, %L, 500, 4000, %L, %L, now() - interval ''1 day'', %L, 10, 300000, 2)',
                             'Aïd 2026', 'العيد 2026', code, 'femme', villes, fin));
  perform pg_temp.compte(null);
  return r;
end $$;
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-000000000001', 'AIDADM', now() + interval '10 days') = 'Réservé à l''administration.', 'client : refusé');
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-0000000000ad', 'AIDADM', null) = 'Indiquez la date de fin de la campagne.', 'sans date de fin : refusé');
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-0000000000ad', 'AIDADM', now() + interval '10 days', '{atlantide}') = 'Ville inconnue.', 'ville inconnue : refusée');
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-0000000000ad', ' aid adm ', now() + interval '10 days') = 'ok', 'admin : campagne créée');
select pg_temp.ok((select actif and code = 'AIDADM' and montant = 500 and plafond_par_boutique = 2 and validite_jours = 10 and budget = 300000
  and cree_par = 'c3350000-0000-0000-0000-0000000000ad' from programmes_bons where code = 'AIDADM'), 'campagne active, code en majuscules, champs gardés');
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-0000000000ad', 'AIDADM', now() + interval '10 days') = 'Ce code existe déjà.', 'même code : refusé');
select pg_temp.ok(pg_temp.creer('c3350000-0000-0000-0000-0000000000ad', 'A!', now() + interval '10 days') like '%programmes_bons_code_check%', 'code mal formé : refusé par la base');
select pg_temp.ok(not has_function_privilege('anon', 'public.creer_campagne(text, text, text, integer, integer, text, text[], timestamptz, timestamptz, integer, integer, integer)', 'execute'), 'creer_campagne : pas pour anon');
select id as prog from programmes_bons where code = 'AIDADM' \gset

-- 2. Historique des prix : prix d'article et promotions notés ; une modification sans changement de prix : rien.
update articles set prix = 5000 where id = 'e3350000-0000-0000-0000-00000000000a';
update articles set titre = 'Robe signal brodée' where id = 'e3350000-0000-0000-0000-00000000000a';
insert into promos (article_id, prix_promo, date_fin) values ('e3350000-0000-0000-0000-00000000000b', 4200, now() + interval '5 days');
select pg_temp.ok((select jsonb_agg(jsonb_build_array(ancien_prix, nouveau_prix, promo) order by id) from prive.historique_prix
  where article_id in ('e3350000-0000-0000-0000-00000000000a', 'e3350000-0000-0000-0000-00000000000b')) = '[[4000, 5000, false], [null, 4200, true]]'::jsonb,
  'prix 4 000 → 5 000 noté, promotion notée, titre seul : rien');
select pg_temp.ok(not has_table_privilege('authenticated', 'prive.historique_prix', 'select'), 'historique des prix : pas lisible par les comptes');

-- 3. Bons de la campagne utilisés : client ancien (commande récupérée en 10 minutes) et client récent.
select pg_temp.compte('c3350000-0000-0000-0000-000000000001');
select (ajouter_code_bon('AIDADM') ->> 'etat') = 'ajoute';
select passer_commande('d3350000-0000-0000-0000-00000000000a', '[{"article_id":"e3350000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') as c1 \gset
select utiliser_bon(:'c1') = 'applique';
select pg_temp.compte('c3350000-0000-0000-0000-000000000002');
select (ajouter_code_bon('AIDADM') ->> 'etat') = 'ajoute';
select passer_commande('d3350000-0000-0000-0000-00000000000a', '[{"article_id":"e3350000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') as c2 \gset
select utiliser_bon(:'c2') = 'applique';
select pg_temp.compte(null);
-- La boutique confirme, « Prête », remet par QR code (fonctions réelles) ; création antidatée de 10 minutes.
select pg_temp.compte('c3350000-0000-0000-0000-00000000000a');
select count(*) = 1 from changer_statut_commande(:'c1', 'confirmee'::statut_commande);
select count(*) = 1 from changer_statut_commande(:'c1', 'prete'::statut_commande);
select (remettre_commande((select jeton from prive.retraits where commande_id = :'c1')) ->> 'etat') = 'remise';
select pg_temp.compte(null);
update commandes set cree_le = terminee_le - interval '10 minutes' where id = :'c1';

-- 4. Chiffres : émis, utilisés, budget restant ; admin seulement.
create function pg_temp.programmes(cid uuid) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.compte(cid); r := pg_temp.erreur('select programmes_admin()'); perform pg_temp.compte(null); return r;
end $$;
select pg_temp.ok(pg_temp.programmes('c3350000-0000-0000-0000-000000000001') = 'Réservé à l''administration.', 'chiffres : client refusé');
select pg_temp.compte('c3350000-0000-0000-0000-0000000000ad');
select pg_temp.ok((select (x ->> 'emis')::int = 2 and (x ->> 'utilises')::int = 1 and (x ->> 'restant')::int = 299000 and (x ->> 'ouvert')::boolean
  and x ->> 'code' = 'AIDADM' from jsonb_array_elements(programmes_admin()) x where x ->> 'id' = :'prog'), 'Aïd : 2 émis, 1 utilisé, reste 299 000 DA, ouverte');
select pg_temp.ok(exists (select 1 from jsonb_array_elements(programmes_admin()) x where x ->> 'type' = 'bienvenue'), 'le programme Bienvenue est listé');

-- 5. Signaux : prix +25 % pendant la campagne, article créé 3 jours avant le début, plafond 2 atteint, compte récent, remise rapide.
update programmes_bons set debut = now() - interval '1 hour' where id = :'prog';
select pg_temp.ok((select s ->> 'boutique' = 'Boutique Signaux' and (s ->> 'prix')::int = 1 and (s ->> 'nouveaux')::int = 1 and (s ->> 'plafond')::int = 2
  and (s ->> 'plafond_jours')::int = 1 and (s ->> 'comptes_recents')::int = 1 and (s ->> 'remises_rapides')::int = 1 and (s ->> 'servis')::int = 2
  from jsonb_array_elements(signaux_bons(:'prog')) s), 'signaux de la boutique : prix, nouvel article, plafond en 1 jour, compte récent, remise rapide');
update prive.historique_prix set nouveau_prix = 4500 where article_id = 'e3350000-0000-0000-0000-00000000000a';
select pg_temp.ok((select (s ->> 'prix')::int = 0 from jsonb_array_elements(signaux_bons(:'prog')) s), 'hausse de 12,5 % : pas de signal de prix');
select pg_temp.ok(signaux_bons('00000000-0000-0000-0000-000000000000') = '[]'::jsonb, 'programme inconnu : aucun signal');

-- 6. Arrêter : plus de nouveau bon, les bons donnés restent.
select pg_temp.ok(arreter_programme(:'prog'), 'arrêter : fait');
select pg_temp.ok(not (select actif from programmes_bons where id = :'prog'), 'campagne arrêtée (inactive)');
select pg_temp.ok(not arreter_programme(:'prog'), 'déjà arrêtée : rien');
select pg_temp.compte(null);
insert into auth.users (id, phone, phone_confirmed_at) values ('c3350000-0000-0000-0000-000000000003', '213555335003', now());
select pg_temp.compte('c3350000-0000-0000-0000-000000000003');
select pg_temp.ok(ajouter_code_bon('AIDADM') ->> 'etat' = 'inconnu', 'après l''arrêt : code refusé');
select pg_temp.compte('c3350000-0000-0000-0000-000000000001');
select pg_temp.ok(pg_temp.erreur(format('select arreter_programme(%L)', :'prog')) = 'Réservé à l''administration.', 'arrêter : client refusé');
select pg_temp.compte(null);
select pg_temp.ok((select count(*) from bons where programme_id = :'prog' and statut in ('reserve', 'utilise')) = 2, 'bons déjà donnés : inchangés');

-- 7. US-32.5 : un programme « avis » et un bon d'origine « avis » sont acceptés.
insert into programmes_bons (id, type, nom_fr, nom_ar, montant, minimum_achat, budget) values ('f3350000-0000-0000-0000-0000000000a1', 'avis', 'Merci pour votre avis', 'شكرا على رايك', 150, 2000, 0);
insert into bons (profil_id, montant, origine, programme_id, minimum_achat, statut, expire_le)
values ('c3350000-0000-0000-0000-000000000001', 150, 'avis', 'f3350000-0000-0000-0000-0000000000a1', 2000, 'disponible', now() + interval '30 days');
select pg_temp.ok(true, 'programme et bon « avis » acceptés (US-32.5)');
select pg_temp.ok(pg_temp.erreur('insert into bons (profil_id, montant, origine, minimum_achat, statut, expire_le) values (''c3350000-0000-0000-0000-000000000001'', 150, ''avis'', 2000, ''disponible'', now())') like '%bons_programme_origine%',
  'bon « avis » sans programme : refusé');

rollback;

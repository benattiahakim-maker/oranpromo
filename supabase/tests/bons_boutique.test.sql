-- Tests SQL de la migration 20261018120000_bons_boutique.sql (US-33.4) : nom du bon côté boutique, client et proche,
-- noms des programmes du relevé, plafond par campagne ; aucune fonction existante ne change.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bons_boutique.test.sql
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

-- 0. Définitions inchangées (bons, commandes, retrait, relevé, numéro, blocage).
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','utiliser_bon'),('prive','raison_bon'),('prive','donner_bon_programme'),('public','passer_commande'),
    ('public','changer_statut_commande'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','bons_apres_statut')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bons_apres_statut=bdd1ffb334b87f6cef2fe350040f5ec0,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,donner_bon_programme=07c68f57d8b60505e1b6fcbff0e750d0,passer_commande=d18a962833a100d12f0b317e46973640,raison_bon=84d557a918e400bd125a0349d62d64a2,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,utiliser_bon=6ded97cf884bac444cf82f89b7f5a254', 'utiliser_bon, raison_bon, commandes, numéro, blocage : définitions inchangées');

-- Données : deux boutiques et leurs commerçants, deux clients, une campagne Aïd (plafond 30) et une fermée.
insert into auth.users (id, phone, phone_confirmed_at)
select ('c3340000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2135553340' || lpad(i::text, 2, '0'), now() from generate_series(1, 2) i;
insert into auth.users (id, email) values ('c3340000-0000-0000-0000-00000000000a', 'nour@example.test'), ('c3340000-0000-0000-0000-00000000000b', 'sara@example.test');
update profils set nom = 'Client ' || upper(right(id::text, 1)) where id::text like 'c3340000-%' and right(id::text, 1) in ('a', 'b');
update profils set nom = 'Client ' || chr(64 + right(id::text, 1)::integer) where id::text like 'c3340000-%' and right(id::text, 1) in ('1', '2');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3340000-0000-0000-0000-00000000000a', 'Boutique Bon Nour', 'boutique-bon-nour', 'Gambetta', '+213555334901', 'validee', 'oran'),
  ('d3340000-0000-0000-0000-00000000000b', 'Boutique Bon Sara', 'boutique-bon-sara', 'Centre', '+213555334902', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd3340000-0000-0000-0000-00000000000a' where id = 'c3340000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd3340000-0000-0000-0000-00000000000b' where id = 'c3340000-0000-0000-0000-00000000000b';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3340000-0000-0000-0000-00000000000a', 'd3340000-0000-0000-0000-00000000000a', 'Robe Bon', 'Robes', 5000, 'femme');
insert into tailles (article_id, libelle, disponible, quantite) values ('e3340000-0000-0000-0000-00000000000a', 'M', true, 50);
insert into programmes_bons (id, type, nom_fr, nom_ar, code, montant, minimum_achat, univers, villes, fin, budget, plafond_par_boutique, actif) values
  ('f3340000-0000-0000-0000-00000000000a', 'campagne', 'Aïd 2026', 'العيد 2026', 'AIDBON', 500, 4000, null, '{}', now() + interval '20 days', 100000, 30, true),
  ('f3340000-0000-0000-0000-00000000000b', 'campagne', 'Ancienne', 'القديمة', 'ANCIENNE', 500, 4000, null, '{}', now() + interval '20 days', 100000, 30, false);

-- Client 1 : bon Aïd posé sur une commande chez Nour ; client 2 : commande sans bon.
select pg_temp.compte('c3340000-0000-0000-0000-000000000001');
select (ajouter_code_bon('AIDBON') ->> 'etat') = 'ajoute';
select passer_commande('d3340000-0000-0000-0000-00000000000a', '[{"article_id":"e3340000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') as c1 \gset
select utiliser_bon(:'c1') = 'applique';
select pg_temp.compte('c3340000-0000-0000-0000-000000000002');
select passer_commande('d3340000-0000-0000-0000-00000000000a', '[{"article_id":"e3340000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') as c2 \gset

create function pg_temp.bons(cid uuid, commandes uuid[]) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.compte(cid); r := bons_des_commandes(commandes); perform pg_temp.compte(null); return r;
end $$;

-- 1. bons_des_commandes : la boutique, le client, l'admin ; jamais une autre boutique ou un autre client.
select pg_temp.ok(pg_temp.bons('c3340000-0000-0000-0000-00000000000a', array[:'c1', :'c2']::uuid[])
  = jsonb_build_array(jsonb_build_object('commande', :'c1'::uuid, 'origine', 'campagne', 'nom_fr', 'Aïd 2026', 'nom_ar', 'العيد 2026')),
  'boutique : nom du bon de sa commande (commande sans bon absente)');
select pg_temp.ok(jsonb_array_length(pg_temp.bons('c3340000-0000-0000-0000-000000000001', array[:'c1']::uuid[])) = 1, 'client : son bon');
select pg_temp.ok(pg_temp.bons('c3340000-0000-0000-0000-00000000000b', array[:'c1']::uuid[]) = '[]'::jsonb, 'autre boutique : rien');
select pg_temp.ok(pg_temp.bons('c3340000-0000-0000-0000-000000000002', array[:'c1']::uuid[]) = '[]'::jsonb, 'autre client : rien');
select pg_temp.ok(pg_temp.bons(null, array[:'c1']::uuid[]) = '[]'::jsonb and pg_temp.bons('c3340000-0000-0000-0000-00000000000a', null) = '[]'::jsonb,
  'sans compte ou sans liste : rien');
update bons set origine = 'bienvenue', programme_id = (select id from programmes_bons where type = 'bienvenue') where commande_id = :'c1';
select pg_temp.ok(pg_temp.bons('c3340000-0000-0000-0000-00000000000a', array[:'c1']::uuid[]) -> 0 ->> 'origine' = 'bienvenue', 'bon de bienvenue : origine « bienvenue »');
update bons set origine = 'campagne', programme_id = 'f3340000-0000-0000-0000-00000000000a' where commande_id = :'c1';
select pg_temp.ok(not has_function_privilege('anon', 'public.bons_des_commandes(uuid[])', 'execute'), 'bons_des_commandes : pas pour anon');

-- 2. bon_par_lien : nom du bon de la commande du lien du proche ; jeton faux ou commande sans bon : null.
insert into prive.retraits (commande_id, boutique_id, jeton, code) values
  (:'c1', 'd3340000-0000-0000-0000-00000000000a', 'AbCdEfGhIjKlMnOpQrStU1', '123456'),
  (:'c2', 'd3340000-0000-0000-0000-00000000000a', 'AbCdEfGhIjKlMnOpQrStU2', '654321')
on conflict (commande_id) do update set jeton = excluded.jeton;
set local role anon;
select pg_temp.ok(bon_par_lien('AbCdEfGhIjKlMnOpQrStU1') = '{"origine": "campagne", "nom_fr": "Aïd 2026", "nom_ar": "العيد 2026"}'::jsonb, 'proche (sans compte) : nom du bon');
select pg_temp.ok(bon_par_lien('AbCdEfGhIjKlMnOpQrStU2') is null, 'commande sans bon : null');
select pg_temp.ok(bon_par_lien('nimportequoi') is null and bon_par_lien(null) is null, 'jeton faux : null');
reset role;

-- 3. Plafond par campagne ouverte dans la boutique du compte (bons réservés ou utilisés).
create function pg_temp.plafonds(cid uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.compte(cid); r := plafonds_bons_boutique(); perform pg_temp.compte(null); return r;
end $$;
select pg_temp.ok(pg_temp.plafonds('c3340000-0000-0000-0000-00000000000a')
  = '[{"nom_fr": "Aïd 2026", "nom_ar": "العيد 2026", "plafond": 30, "utilises": 1}]'::jsonb, 'Nour : Aïd 2026, 1 / 30 (campagne fermée absente)');
select pg_temp.ok(pg_temp.plafonds('c3340000-0000-0000-0000-00000000000b') -> 0 ->> 'utilises' = '0', 'Sara : 0 / 30');
select pg_temp.ok(pg_temp.plafonds('c3340000-0000-0000-0000-000000000001') = '[]'::jsonb, 'client sans boutique : rien');
select pg_temp.ok(not has_function_privilege('anon', 'public.plafonds_bons_boutique()', 'execute'), 'plafonds : pas pour anon');

-- 4. Relevé : noms des programmes de ses lignes seulement.
insert into releves_bons (id, boutique_id, mois) values
  ('a3340000-0000-0000-0000-00000000000a', 'd3340000-0000-0000-0000-00000000000a', date_trunc('month', now())::date),
  ('a3340000-0000-0000-0000-00000000000b', 'd3340000-0000-0000-0000-00000000000b', date_trunc('month', now())::date);
insert into lignes_releve (releve_id, commande_id, boutique_id, montant, remise_le, mode_remise, numero_commande, total_commande, client, origine, programme_id) values
  ('a3340000-0000-0000-0000-00000000000a', :'c1', 'd3340000-0000-0000-0000-00000000000a', 500, now(), 'qr', 1, 5000, 'Client 1.', 'campagne', 'f3340000-0000-0000-0000-00000000000a'),
  ('a3340000-0000-0000-0000-00000000000b', null, 'd3340000-0000-0000-0000-00000000000b', 500, now(), 'qr', 2, 5000, 'Client 2.', 'campagne', 'f3340000-0000-0000-0000-00000000000b');
select pg_temp.compte('c3340000-0000-0000-0000-00000000000a');
select pg_temp.ok(noms_programmes_releve() = '[{"id": "f3340000-0000-0000-0000-00000000000a", "type": "campagne", "nom_fr": "Aïd 2026", "nom_ar": "العيد 2026"}]'::jsonb,
  'Nour : Aïd 2026 seulement (pas le programme du relevé de Sara)');
select pg_temp.compte(null);
select pg_temp.ok(noms_programmes_releve() = '[]'::jsonb, 'sans compte : rien');
select pg_temp.ok(not has_function_privilege('anon', 'public.noms_programmes_releve()', 'execute'), 'noms du relevé : pas pour anon');

rollback;

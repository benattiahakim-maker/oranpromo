-- Tests SQL de la migration 20261018110000_campagnes.sql (US-33.3) : code tapé par le client (une fois par numéro,
-- 5 codes faux par heure), campagnes ouvertes (bandeau, conditions), raisons au panier identiques à utiliser_bon.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/campagnes.test.sql
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

-- 0. Définitions inchangées (bons, commandes, vérification du numéro, blocage).
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','utiliser_bon'),('prive','raison_bon'),('prive','donner_bon_programme'),('public','passer_commande'),
    ('public','changer_statut_commande'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','bons_apres_statut')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bons_apres_statut=bdd1ffb334b87f6cef2fe350040f5ec0,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,donner_bon_programme=07c68f57d8b60505e1b6fcbff0e750d0,passer_commande=d18a962833a100d12f0b317e46973640,raison_bon=84d557a918e400bd125a0349d62d64a2,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,utiliser_bon=6ded97cf884bac444cf82f89b7f5a254', 'utiliser_bon, raison_bon, commandes, numéro, blocage : définitions inchangées');

-- Données : deux boutiques (Oran, Mostaganem), une campagne Aïd 500 DA dès 4 000 DA d'articles Femme à Oran.
insert into auth.users (id, phone, phone_confirmed_at)
select ('c3330000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2135553330' || lpad(i::text, 2, '0'), now() from generate_series(1, 4) i;
insert into auth.users (id, phone) values ('c3330000-0000-0000-0000-000000000009', '213555333009');  -- numéro non vérifié
update profils set nom = 'Client ' || chr(64 + right(id::text, 1)::integer) where id::text like 'c3330000-%';
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3330000-0000-0000-0000-00000000000a', 'Boutique Aid Oran', 'boutique-aid-oran', 'Gambetta', '+213555333901', 'validee', 'oran'),
  ('d3330000-0000-0000-0000-00000000000b', 'Boutique Aid Mosta', 'boutique-aid-mosta', 'Centre', '+213555333902', 'validee', 'mostaganem');
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3330000-0000-0000-0000-00000000000a', 'd3330000-0000-0000-0000-00000000000a', 'Robe Aid', 'Robes', 2500, 'femme'),
  ('e3330000-0000-0000-0000-00000000000b', 'd3330000-0000-0000-0000-00000000000a', 'Polo Aid', 'T-shirts et polos', 3000, 'homme'),
  ('e3330000-0000-0000-0000-00000000000c', 'd3330000-0000-0000-0000-00000000000b', 'Robe Mosta', 'Robes', 2500, 'femme');
insert into tailles (article_id, libelle, disponible, quantite)
select a, 'M', true, 50 from unnest(array['e3330000-0000-0000-0000-00000000000a','e3330000-0000-0000-0000-00000000000b','e3330000-0000-0000-0000-00000000000c']::uuid[]) a;
insert into programmes_bons (id, type, nom_fr, nom_ar, code, montant, minimum_achat, univers, villes, fin, budget, plafond_par_boutique, actif) values
  ('f3330000-0000-0000-0000-00000000000a', 'campagne', 'Aïd 2026', 'العيد 2026', 'AID2026', 500, 4000, 'femme', '{oran}', now() + interval '20 days', 1500, 30, true),
  ('f3330000-0000-0000-0000-00000000000b', 'campagne', 'Rentrée', 'الدخول', 'RENTREE', 500, 4000, null, '{}', now() + interval '20 days', 0, 30, true),
  ('f3330000-0000-0000-0000-00000000000c', 'campagne', 'Hiver', 'الشتا', 'HIVER', 500, 4000, null, '{}', now() + interval '20 days', 5000, 30, false);

create function pg_temp.code(client uuid, saisi text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.compte(client); r := ajouter_code_bon(saisi); perform pg_temp.compte(null); return r;
end $$;

-- 1. Code valable : bon ajouté (espaces et minuscules acceptés) ; une fois par numéro.
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000001', ' aid 2026 ')
  = '{"etat": "ajoute", "nom_fr": "Aïd 2026", "nom_ar": "العيد 2026", "montant": 500, "minimum_achat": 4000}'::jsonb, 'code valable : bon Aïd 2026 ajouté');
select pg_temp.ok((select count(*) from bons where profil_id = 'c3330000-0000-0000-0000-000000000001' and origine = 'campagne' and univers = 'femme'
  and villes = '{oran}' and minimum_achat = 4000 and statut = 'disponible') = 1, 'bon copié du programme (univers, ville, minimum)');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000001', 'AID2026') ->> 'etat' = 'deja', 'même code une 2e fois : déjà eu');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000009', 'AID2026') ->> 'etat' = 'numero', 'numéro non vérifié : refusé');
select pg_temp.ok((select count(*) from bons where profil_id = 'c3330000-0000-0000-0000-000000000009') = 0, 'numéro non vérifié : aucun bon');

-- 2. Codes faux, campagne inactive, budget épuisé : « inconnu » ; au 6e essai faux dans l'heure : « trop ».
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'FAUX01') ->> 'etat' = 'inconnu', 'code inconnu');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'HIVER') ->> 'etat' = 'inconnu', 'campagne inactive : inconnu');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'RENTREE') ->> 'etat' = 'inconnu', 'budget épuisé : inconnu');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'FAUX02') ->> 'etat' = 'inconnu', '4e essai faux');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'FAUX03') ->> 'etat' = 'inconnu', '5e essai faux');
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'AID2026') ->> 'etat' = 'trop', '5 codes faux dans l''heure : même un bon code attend');
update prive.essais_code_bon set le = le - interval '61 minutes' where profil_id = 'c3330000-0000-0000-0000-000000000002';
select pg_temp.ok(pg_temp.code('c3330000-0000-0000-0000-000000000002', 'AID2026') ->> 'etat' = 'ajoute', 'une heure après : code accepté');
select pg_temp.ok(not has_function_privilege('anon', 'public.ajouter_code_bon(text)', 'execute'), 'ajouter_code_bon : pas pour anon');

-- 3. Campagnes ouvertes : actives, dans les dates, avec du budget, pour la ville (vide = toutes).
select pg_temp.ok((select jsonb_agg(c ->> 'code') from jsonb_array_elements(campagnes_ouvertes('oran')) c) = '["AID2026"]'::jsonb,
  'Oran : Aïd 2026 seulement (Rentrée sans budget, Hiver inactive)');
select pg_temp.ok(campagnes_ouvertes('mostaganem') = '[]'::jsonb, 'Mostaganem : aucune campagne');
select pg_temp.ok((select (c ->> 'montant')::int = 500 and (c ->> 'minimum_achat')::int = 4000 and c ->> 'univers' = 'femme' and c -> 'villes' = '["oran"]'
  and not (c ? 'budget') and not (c ? 'plafond_par_boutique') from jsonb_array_elements(campagnes_ouvertes(null)) c), 'champs affichés seulement (ni budget ni plafond)');
set local role anon;
select pg_temp.ok(jsonb_array_length(campagnes_ouvertes('oran')) = 1, 'bandeau lisible sans compte');
reset role;

-- 4. Raisons au panier = réponses d'utiliser_bon (minimum, univers, ville), sur les prix de la base.
create function pg_temp.panier(client uuid, boutique uuid, lignes jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.compte(client); r := bons_panier(boutique, lignes); perform pg_temp.compte(null); return r;
end $$;
create function pg_temp.commander(client uuid, boutique uuid, lignes jsonb) returns text language plpgsql as $$
declare c uuid; r text;
begin
  perform pg_temp.compte(client);
  c := passer_commande(boutique, lignes);
  r := utiliser_bon(c);
  perform pg_temp.compte(null);
  update commandes set statut = 'annulee', motif_annulation = 'autre' where id = c and r <> 'applique';
  return r;
end $$;
-- Client 3 : bon Aïd seulement.
select pg_temp.code('c3330000-0000-0000-0000-000000000003', 'AID2026') is not null;
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') -> 0 ->> 'raison' = 'minimum', 'panier 2 500 DA : minimum');
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":1},{"article_id":"e3330000-0000-0000-0000-00000000000b","taille":"M","quantite":1}]') -> 0 ->> 'raison' = 'univers',
  'panier 5 500 DA dont 2 500 DA Femme : univers');
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000b',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000c","taille":"M","quantite":2}]') -> 0 ->> 'raison' = 'ville', 'Mostaganem : ville');
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') -> 0 ->> 'raison' = 'ok', 'panier 5 000 DA Femme à Oran : ok');
-- Prix envoyé par le navigateur ignoré ; article d'une autre boutique ignoré.
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","quantite":1,"prix":9000},{"article_id":"e3330000-0000-0000-0000-00000000000c","quantite":3}]') -> 0 ->> 'raison' = 'minimum',
  'prix du navigateur et article d''une autre boutique ignorés');
-- Promotion en cours : prix promo (comme passer_commande).
insert into promos (article_id, prix_promo, date_fin) values ('e3330000-0000-0000-0000-00000000000a', 1900, now() + interval '1 day');
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') -> 0 ->> 'raison' = 'minimum', 'promotion : 3 800 DA, sous le minimum');
select pg_temp.ok(pg_temp.commander('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') = 'minimum', 'utiliser_bon donne la même raison (minimum)');
select pg_temp.ok(pg_temp.commander('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000b',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000c","taille":"M","quantite":2}]') = 'ville', 'utiliser_bon donne la même raison (ville)');
delete from promos where article_id = 'e3330000-0000-0000-0000-00000000000a';
-- Plafond par boutique atteint : même raison au panier et à la commande.
update programmes_bons set plafond_par_boutique = 1 where id = 'f3330000-0000-0000-0000-00000000000a';
select pg_temp.ok(pg_temp.commander('c3330000-0000-0000-0000-000000000001', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') = 'applique', 'client 1 : bon Aïd posé (1 sur 1)');
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') -> 0 ->> 'raison' = 'plafond_boutique', 'panier : plafond de la boutique');
select pg_temp.ok(pg_temp.commander('c3330000-0000-0000-0000-000000000003', 'd3330000-0000-0000-0000-00000000000a',
  '[{"article_id":"e3330000-0000-0000-0000-00000000000a","taille":"M","quantite":2}]') = 'plafond_boutique', 'commande : même raison (plafond)');
-- Bons d'un autre compte jamais renvoyés ; anon refusé.
select pg_temp.ok(pg_temp.panier('c3330000-0000-0000-0000-000000000004', 'd3330000-0000-0000-0000-00000000000a', '[]') = '[]'::jsonb, 'aucun bon : liste vide');
select pg_temp.ok(not has_function_privilege('anon', 'public.bons_panier(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'prive.raison_bon_panier(bons, uuid, jsonb)', 'execute'), 'droits : bons_panier pour les comptes, fonctions internes fermées');

-- 5. « campagne » réservé (page des conditions).
do $$ declare contrainte text; begin
  begin
    insert into villes (code, pays, numero_wilaya, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng, zoom, ouverte, ordre)
    values ('campagne', 'DZ', 99, 'Campagne', 'حملة', 35, 36, 0, 1, 35.5, 0.5, 12, false, 99);
    raise exception 'ÉCHEC - code campagne accepté';
  exception when check_violation then
    get stacked diagnostics contrainte = constraint_name;
    if contrainte <> 'villes_code_libre_campagne' then raise exception 'ÉCHEC - autre contrainte : %', contrainte; end if;
  end;
end $$;
select pg_temp.ok(true, 'code de ville « campagne » refusé (page des conditions)');

rollback;

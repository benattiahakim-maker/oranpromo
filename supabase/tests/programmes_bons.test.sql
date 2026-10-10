-- Tests SQL de la migration 20261018090000_programmes_bons.sql (US-33.1) : programmes de bons, budget du parrainage
-- inchangé, une fois par numéro, raisons d'utiliser_bon (minimum, univers, ville, plafond), règle de la carte à
-- l'annulation, relevé avec l'origine.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/programmes_bons.test.sql
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

-- 0. Définitions inchangées (empreintes prises sur main avant la migration).
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','passer_commande'),('public','changer_statut_commande'),('public','declarer_no_show'),
    ('prive','recalculer_no_shows'),('prive','no_shows_actifs'),('public','bloquer_client'),('public','debloquer_client'),
    ('prive','proteger_profil'),('public','contester_no_show'),('public','valider_no_show'),('public','annuler_no_show'),
    ('prive','expirer_commande'),('prive','expirer_commandes'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),
    ('public','remettre_commande'),('prive','poser_mode_remise'),('prive','messages_suivi_commande')))
  = 'annuler_no_show=8d072e620e7ce627c26be113bd3e33e7,blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bloquer_client=7016b3730777461fcba4654207debc91,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,contester_no_show=60a19d7bfb9e0c60bf04fbc2f09f5a9e,debloquer_client=202036ff24f2f8042ed0b775f4e1615b,declarer_no_show=0457027879fe08544fca36316f8056b1,expirer_commande=31d29119776460514fb33baa36bc3ee7,expirer_commandes=e4ee7b0282e4c4ee78bbbd537c5dc455,messages_suivi_commande=936e6401ec17e51226b8f9ac816f93ad,no_shows_actifs=63d33574d1bec195b1346e64f78f0f5d,passer_commande=d18a962833a100d12f0b317e46973640,poser_mode_remise=bc051011d9a715dd37c6426599af21b8,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,remettre_commande=8eae2e162ca810ef5a4cfab1d7615ee8,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,valider_no_show=cc02b62a4c1b3dd6f872bf4967ad3df9',
  'passer_commande, changer_statut_commande, no-shows, blocage, vérification du numéro, remise : définitions inchangées');

-- 1. Programme de bienvenue : créé inactif, budget 0 (à fixer par le propriétaire), 300 DA dès 2 000 DA, 30 jours.
select pg_temp.ok((select count(*) from programmes_bons where type = 'bienvenue' and not actif and budget = 0 and montant = 300
  and minimum_achat = 2000 and validite_jours = 30 and nom_fr = 'Bienvenue') = 1, 'bienvenue : inactif, budget 0, 300 DA dès 2 000 DA, 30 jours');
select pg_temp.erreur($q$insert into programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat) values ('bienvenue', 'Autre', 'آخر', 100, 100)$q$,
  '23505', 'programmes_bons_un_bienvenue', 'un seul programme de bienvenue');
select pg_temp.erreur($q$insert into programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat) values ('campagne', 'Sans code', 'بلا', 500, 4000)$q$,
  '23514', 'programmes_code_campagne', 'une campagne a un code');
select pg_temp.erreur($q$insert into programmes_bons (type, nom_fr, nom_ar, code, montant, minimum_achat) values ('campagne', 'Petit', 'صغير', 'PETIT1', 500, 100)$q$,
  '23514', 'programmes_minimum', 'minimum d''achat au moins égal au montant');

insert into auth.users (id, email) values ('b3300000-0000-0000-0000-00000000000a', 'boutique33a@test.dz'),
  ('b3300000-0000-0000-0000-00000000000b', 'boutique33b@test.dz'), ('a3300000-0000-0000-0000-00000000000a', 'admin33@test.dz'),
  ('c3300000-0000-0000-0000-0000000000ff', 'nonverifie33@test.dz');
insert into auth.users (id, phone, phone_confirmed_at)
select ('c3300000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2135553300' || lpad(i::text, 2, '0'), now()
from generate_series(1, 9) i;
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3300000-0000-0000-0000-00000000000a', 'Boutique Prog A', 'boutique-prog-a', 'Gambetta', '+213555330901', 'validee', 'oran'),
  ('d3300000-0000-0000-0000-00000000000b', 'Boutique Prog B', 'boutique-prog-b', 'Centre', '+213555330902', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd3300000-0000-0000-0000-00000000000a' where id = 'b3300000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd3300000-0000-0000-0000-00000000000b' where id = 'b3300000-0000-0000-0000-00000000000b';
update profils set role = 'admin' where id = 'a3300000-0000-0000-0000-00000000000a';
update profils set nom = 'Client ' || chr(64 + right(id::text, 1)::integer) where id::text like 'c3300000-%' and id::text not like '%ff';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3300000-0000-0000-0000-00000000000a', 'd3300000-0000-0000-0000-00000000000a', 'Robe prog', 'Robes', 2500, 'femme'),
  ('e3300000-0000-0000-0000-00000000000b', 'd3300000-0000-0000-0000-00000000000a', 'Polo prog', 'T-shirts et polos', 3500, 'homme'),
  ('e3300000-0000-0000-0000-00000000000c', 'd3300000-0000-0000-0000-00000000000a', 'Parfum prog', 'Parfums', 4500, 'mixte'),
  ('e3300000-0000-0000-0000-00000000000d', 'd3300000-0000-0000-0000-00000000000b', 'Robe B', 'Robes', 2500, 'femme'),
  ('e3300000-0000-0000-0000-00000000000e', 'd3300000-0000-0000-0000-00000000000a', 'Foulard prog', 'Hijabs et foulards', 1500, 'femme');
insert into tailles (article_id, libelle, disponible, quantite)
select a, 'M', true, 200 from unnest(array['e3300000-0000-0000-0000-00000000000a','e3300000-0000-0000-0000-00000000000b',
  'e3300000-0000-0000-0000-00000000000c','e3300000-0000-0000-0000-00000000000d','e3300000-0000-0000-0000-00000000000e']::uuid[]) a;
-- Commande d'un client (vieillie de 2 h pour ne pas toucher aux limites par heure), confirmée puis prête.
create function pg_temp.vieillir(c uuid) returns void language sql security definer as $$
  update commandes set cree_le = cree_le - interval '2 hours' where id = c;
$$;
create function pg_temp.commande(client uuid, article uuid, quantite integer default 1, bon boolean default false) returns uuid language plpgsql as $$
declare c uuid; b uuid := (select boutique_id from articles where id = article);
begin
  perform pg_temp.compte(client);
  c := passer_commande(b, format('[{"article_id":"%s","taille":"M","quantite":%s}]', article, quantite)::jsonb);
  if bon then perform utiliser_bon(c); end if;
  perform pg_temp.compte(null);
  perform pg_temp.vieillir(c);
  return c;
end $$;
create function pg_temp.commercant(c uuid) returns uuid language sql security definer as $$
  select p.id from profils p join commandes x on x.boutique_id = p.boutique_id where x.id = c and p.role = 'commercant'
$$;
create function pg_temp.retrait(c uuid) returns prive.retraits language sql security definer as $$
  select * from prive.retraits where commande_id = c
$$;
create function pg_temp.prete(c uuid) returns uuid language plpgsql as $$
declare m uuid := pg_temp.commercant(c);
begin
  perform pg_temp.compte(m);
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;
-- Remise par QR code (jeton), par code à 6 chiffres, ou « Remis sans QR code » (bouton manuel).
create function pg_temp.remettre(c uuid, mode text) returns text language plpgsql as $$
declare m uuid := pg_temp.commercant(c);
  j text := (pg_temp.retrait(c)).jeton; k text := (pg_temp.retrait(c)).code; r jsonb;
begin
  perform pg_temp.compte(m);
  if mode = 'qr' then r := remettre_commande(j);
  elsif mode = 'code' then r := remettre_commande(code => k);
  else perform changer_statut_commande(c, 'recuperee'); r := '{"etat":"remise"}';
  end if;
  perform pg_temp.compte(null);
  return r ->> 'etat';
end $$;

create function pg_temp.donner(programme uuid, client uuid) returns text language sql security definer as $$
  select prive.donner_bon_programme(programme, client)
$$;
create function pg_temp.utiliser(client uuid, c uuid, bon uuid default null) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.compte(client); r := utiliser_bon(c, bon); perform pg_temp.compte(null); return r;
end $$;
create function pg_temp.annuler(c uuid, par text) returns void language plpgsql as $$
begin
  perform pg_temp.compte(case when par = 'client' then (select client_id from commandes where id = c) else pg_temp.commercant(c) end);
  perform changer_statut_commande(c, 'annulee', case when par = 'client' then null else 'plus_en_stock' end);
  perform pg_temp.compte(null);
end $$;
create function pg_temp.statut_bon(c uuid) returns text language sql security definer as $$
  select b.statut from bons b where b.commande_id = c or b.id = (select bon_id from commandes where id = c)
$$;

\set bienvenue '(select id from programmes_bons where type = ''bienvenue'')'
\set c1 c3300000-0000-0000-0000-000000000001
\set c2 c3300000-0000-0000-0000-000000000002
\set c3 c3300000-0000-0000-0000-000000000003
\set c4 c3300000-0000-0000-0000-000000000004
\set c5 c3300000-0000-0000-0000-000000000005
\set c6 c3300000-0000-0000-0000-000000000006
\set c7 c3300000-0000-0000-0000-000000000007
\set robe e3300000-0000-0000-0000-00000000000a
\set polo e3300000-0000-0000-0000-00000000000b
\set parfum e3300000-0000-0000-0000-00000000000c
\set robeb e3300000-0000-0000-0000-00000000000d
\set foulard e3300000-0000-0000-0000-00000000000e

-- 2. Donner un bon : programme fermé, budget, une fois par numéro, numéro vérifié obligatoire
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c1') = 'ferme', 'programme inactif : aucun bon');
update programmes_bons set actif = true where type = 'bienvenue';
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c1') = 'budget', 'budget 0 : aucun bon');
update programmes_bons set budget = 1200 where type = 'bienvenue';
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c1') = 'donne', 'programme actif avec budget : bon donné');
select pg_temp.ok((select count(*) from bons where profil_id = :'c1' and origine = 'bienvenue' and statut = 'disponible' and montant = 300
  and minimum_achat = 2000 and expire_le between now() + interval '29 days' and now() + interval '31 days') = 1,
  'bon de bienvenue : 300 DA, minimum 2 000 DA, 30 jours');
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c1') = 'deja', 'un seul bon par numéro et par programme');
select pg_temp.ok(pg_temp.donner(:bienvenue, 'c3300000-0000-0000-0000-0000000000ff') = 'numero', 'sans numéro vérifié : aucun bon');
delete from auth.users where id = :'c1';
insert into auth.users (id, phone, phone_confirmed_at) values ('c3300000-0000-0000-0000-000000000011', '213555330001', now());
select pg_temp.ok(pg_temp.donner(:bienvenue, 'c3300000-0000-0000-0000-000000000011') = 'deja', 'compte supprimé puis recréé avec le même numéro : pas de 2e bon');
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c2') = 'donne' and pg_temp.donner(:bienvenue, :'c3') = 'donne'
  and pg_temp.donner(:bienvenue, :'c4') = 'donne' and pg_temp.donner(:bienvenue, :'c5') = 'donne' and pg_temp.donner(:bienvenue, :'c6') = 'budget', 'budget de 1 200 DA : 4 bons (le bon d''un compte supprimé ne compte plus)');

-- 3. Budget du parrainage inchangé : il ne compte que les bons de parrainage
select pg_temp.ok(prive.bons_emis(prive.mois_alger()) = 0, 'bons de bienvenue hors du budget du parrainage');
select pg_temp.ok(prive.budget_programme_restant(:bienvenue) = 0, 'budget du programme : bons non annulés du programme');

-- 4. Utiliser : minimum (articles), univers, ville, plafond, choix
select pg_temp.ok(pg_temp.utiliser(:'c2', pg_temp.commande(:'c2', :'foulard')) = 'minimum', 'bienvenue : 1 500 DA < 2 000 DA → minimum');
select pg_temp.ok(pg_temp.utiliser(:'c2', pg_temp.commande(:'c2', :'robe')) = 'applique', 'bienvenue : 2 500 DA → bon appliqué');
select pg_temp.ok((select remise_bon from commandes where client_id = :'c2' and bon_id is not null) = 300, 'remise de 300 DA sur la commande');

insert into programmes_bons (id, type, nom_fr, nom_ar, code, montant, minimum_achat, univers, budget, plafond_par_boutique, actif, fin)
values ('f3300000-0000-0000-0000-00000000000a', 'campagne', 'Aïd 2026', 'العيد 2026', 'AID2026', 500, 3000, 'femme', 100000, 1, true, now() + interval '20 days'),
       ('f3300000-0000-0000-0000-00000000000b', 'campagne', 'Alger', 'الجزائر', 'ALGER26', 500, 1000, null, 100000, 30, true, null);
update programmes_bons set villes = '{alger}' where code = 'ALGER26';
select pg_temp.ok(pg_temp.donner('f3300000-0000-0000-0000-00000000000a', :'c3') = 'donne', 'campagne : bon donné');
select pg_temp.ok((select expire_le from bons where profil_id = :'c3' and origine = 'campagne') <= now() + interval '20 days',
  'campagne : échéance au plus tard à la fin de la campagne');
-- c3 a deux bons : bienvenue 300 (2 000) et Aïd 500 (3 000 d'articles Femme).
select pg_temp.ok(pg_temp.utiliser(:'c3', pg_temp.commande(:'c3', :'polo')) = 'applique', 'polo homme 3 500 DA : un bon appliqué');
select pg_temp.ok((select remise_bon from commandes where client_id = :'c3' and bon_id is not null) = 300,
  'polo homme : Aïd (Femme) ne s''applique pas, bienvenue (300 DA) appliqué');
select pg_temp.ok(pg_temp.utiliser(:'c3', pg_temp.commande(:'c3', :'parfum'), (select id from bons where profil_id = :'c3' and origine = 'campagne')) = 'univers',
  'parfum 4 500 DA, bon Aïd choisi : articles Femme seulement → univers');
select pg_temp.commande(:'c3', :'robe', 2) is not null;
select pg_temp.ok(prive.montant_univers((select id from commandes where client_id = :'c3' and total = 5000), 'femme') = 5000
  and prive.montant_univers((select id from commandes where client_id = :'c3' and total = 5000), 'homme') = 0,
  'montant de l''univers calculé sur les lignes (Femme 5 000, Homme 0)');
select pg_temp.ok(pg_temp.utiliser(:'c3', (select id from commandes where client_id = :'c3' and total = 5000)) = 'applique', 'robes 5 000 DA : bon appliqué');
select pg_temp.ok((select remise_bon from commandes where client_id = :'c3' and total = 5000) = 500, 'robes 5 000 DA : bon Aïd de 500 DA (le plus gros)');
select pg_temp.ok(pg_temp.donner('f3300000-0000-0000-0000-00000000000a', :'c4') = 'donne', 'c4 : bon Aïd donné');
select pg_temp.ok(pg_temp.utiliser(:'c4', pg_temp.commande(:'c4', :'robe', 2)) = 'applique', 'c4 : robes 5 000 DA, un bon appliqué');
select pg_temp.ok((select remise_bon from commandes where client_id = :'c4' and bon_id is not null) = 300,
  'plafond de 1 bon Aïd par boutique atteint : le bon de bienvenue passe à la place');
select pg_temp.ok(pg_temp.utiliser(:'c4', pg_temp.commande(:'c4', :'robe', 2), (select id from bons where profil_id = :'c4' and origine = 'campagne')) = 'plafond_boutique',
  'bon Aïd choisi dans la même boutique : plafond_boutique');
select pg_temp.ok(pg_temp.utiliser(:'c4', pg_temp.commande(:'c4', :'robeb', 2)) = 'applique', 'autre boutique : bon appliqué');
select pg_temp.ok((select remise_bon from commandes c where client_id = :'c4' and boutique_id = 'd3300000-0000-0000-0000-00000000000b') = 500,
  'autre boutique : le bon Aïd s''applique');
select pg_temp.ok(pg_temp.donner('f3300000-0000-0000-0000-00000000000b', :'c6') = 'donne', 'c6 : bon Alger donné');
select pg_temp.ok(pg_temp.utiliser(:'c6', pg_temp.commande(:'c6', :'robe')) = 'ville', 'bon réservé à Alger, boutique à Oran : ville');
update boutiques set bons_acceptes = false where id = 'd3300000-0000-0000-0000-00000000000b';
select pg_temp.ok(pg_temp.utiliser(:'c6', pg_temp.commande(:'c6', :'robeb')) = 'ville', 'première raison du meilleur bon gardée');
select pg_temp.ok(pg_temp.utiliser(:'c7', pg_temp.commande(:'c7', :'robe')) = 'aucun_bon'
  and pg_temp.utiliser(:'c7', pg_temp.commande(:'c7', :'foulard')) = 'aucun_bon'
  and pg_temp.utiliser(:'c7', pg_temp.commande(:'c7', :'robeb')) = 'boutique_exclue',
  'sans bon : mêmes réponses qu''avant US-33');
update boutiques set bons_acceptes = true where id = 'd3300000-0000-0000-0000-00000000000b';

-- 5. Règle de la carte : annulée par le client ou expirée → bon expiré ; annulée par la boutique → bon rendu
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c7') = 'budget', 'budget épuisé');
update programmes_bons set budget = 100000 where type = 'bienvenue';
select pg_temp.ok(pg_temp.donner(:bienvenue, :'c7') = 'donne', 'budget relevé : bon donné');
do $$ declare c uuid; begin
  c := pg_temp.commande('c3300000-0000-0000-0000-000000000007', 'e3300000-0000-0000-0000-00000000000a');
  perform pg_temp.utiliser('c3300000-0000-0000-0000-000000000007', c);
  perform pg_temp.annuler(c, 'boutique');
  perform pg_temp.ok((select statut from bons where profil_id = 'c3300000-0000-0000-0000-000000000007') = 'disponible'
    and (select remise_bon from commandes where id = c) = 0, 'annulée par la boutique : le bon revient');
  c := pg_temp.commande('c3300000-0000-0000-0000-000000000007', 'e3300000-0000-0000-0000-00000000000a');
  perform pg_temp.utiliser('c3300000-0000-0000-0000-000000000007', c);
  perform pg_temp.annuler(c, 'client');
  perform pg_temp.ok((select statut from bons where profil_id = 'c3300000-0000-0000-0000-000000000007') = 'expire', 'annulée par le client : le bon expire');
end $$;
select 'ok - règle de la carte à l''annulation';
do $$ declare c uuid; begin
  perform pg_temp.donner((select id from programmes_bons where type = 'bienvenue'), 'c3300000-0000-0000-0000-000000000005');
  c := pg_temp.commande('c3300000-0000-0000-0000-000000000005', 'e3300000-0000-0000-0000-00000000000a');
  perform pg_temp.utiliser('c3300000-0000-0000-0000-000000000005', c);
  perform pg_temp.prete(c);
  perform prive.expirer_commande(c);
  perform pg_temp.ok((select statut from bons where profil_id = 'c3300000-0000-0000-0000-000000000005') = 'expire', 'pas venu (expirée) : le bon expire');
end $$;
select 'ok - commande expirée';

-- 6. Remise : QR code → utilisé + ligne de relevé avec l'origine ; code à 6 chiffres → bon rendu, rien à rembourser
do $$ declare c uuid; begin
  c := (select id from commandes where client_id = 'c3300000-0000-0000-0000-000000000002' and bon_id is not null);
  perform pg_temp.prete(c);
  perform pg_temp.ok(pg_temp.remettre(c, 'qr') = 'remise', 'remise par QR code');
  perform pg_temp.ok((select statut from bons where commande_id = c) = 'utilise'
    and (select origine || ':' || coalesce(programme_id::text, '') || ':' || montant from lignes_releve where commande_id = c)
        = 'bienvenue:' || (select id from programmes_bons where type = 'bienvenue') || ':300', 'ligne de relevé : origine bienvenue, programme, 300 DA');
  c := (select id from commandes where client_id = 'c3300000-0000-0000-0000-000000000003' and total = 5000);
  perform pg_temp.prete(c);
  perform pg_temp.remettre(c, 'code');
  perform pg_temp.ok((select statut from bons where profil_id = 'c3300000-0000-0000-0000-000000000003' and origine = 'campagne') = 'disponible'
    and not exists (select 1 from lignes_releve where commande_id = c), 'remise par code : bon rendu, pas de remboursement (QR code seulement)');
end $$;
select 'ok - remise';

-- 7. Droits et lecture
select pg_temp.compte(:'c3');
set local role authenticated;
select pg_temp.ok((select count(*) from programmes_bons) = 0, 'un client ne lit pas les programmes');
select pg_temp.ok((select count(*) from jsonb_array_elements(mes_bons()) e where e ->> 'nom_fr' = 'Aïd 2026' and e ->> 'nom_ar' = 'العيد 2026'
  and (e ->> 'minimum_achat')::int = 3000 and e ->> 'univers' = 'femme') = 1, 'mes_bons : nom, minimum, univers du programme');
select pg_temp.erreur($q$insert into programmes_bons (type, nom_fr, nom_ar, code, montant, minimum_achat) values ('campagne', 'Pirate', 'قرصان', 'PIRATE', 5000, 5000)$q$,
  '42501', 'permission denied', 'un client ne crée pas de programme');
select pg_temp.erreur($q$select prive.donner_bon_programme('f3300000-0000-0000-0000-00000000000a', auth.uid())$q$,
  '42501', 'permission denied', 'un client n''appelle pas donner_bon_programme');
reset role;
select pg_temp.compte('a3300000-0000-0000-0000-00000000000a');
set local role authenticated;
select pg_temp.ok((select count(*) from programmes_bons) = 3, 'l''admin lit les programmes');
select pg_temp.ok((budget_parrainage() ->> 'utilise')::int = 0, 'budget du parrainage : bons de bienvenue utilisés non comptés');
reset role;
select pg_temp.erreur($q$insert into bons (profil_id, origine, programme_id, statut, expire_le) values ('c3300000-0000-0000-0000-000000000002', 'parrainage_filleul', 'f3300000-0000-0000-0000-00000000000a', 'disponible', now())$q$,
  '23514', 'bons_programme_origine', 'un bon de parrainage n''a pas de programme');

rollback;

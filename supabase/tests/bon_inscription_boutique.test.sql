-- Tests SQL de la migration 20261020090000_bon_inscription_boutique.sql (US-31.4 : bon de bienvenue pour
-- l'inscription en boutique). Programme inactif par défaut ; bon à la place du bon de bienvenue ; pas le jour même
-- dans la boutique d'origine ; part de la boutique d'origine hors remboursement ; plafond par boutique et par mois ;
-- budget ; signaux admin ; règles des commandes, du blocage et du numéro inchangées.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bon_inscription_boutique.test.sql
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

-- 0. Définitions inchangées : commandes, remise, blocage, no-shows, numéro, choix du parrain, bons de programme.
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','recalculer_no_shows'),
    ('public','passer_commande'),('public','changer_statut_commande'),('public','remettre_commande'),('public','choisir_parrain'),
    ('public','utiliser_bon'),('prive','donner_bon_programme'),('prive','donner_bon_bienvenue'),('prive','droit_bon_bienvenue'),('prive','proteger_profil')))
  = 'blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,choisir_parrain=c15c674b039da99a5370b4f3e70e0b9c,donner_bon_bienvenue=3c27430b4d11bc39cc59a2c93f4db571,donner_bon_programme=07c68f57d8b60505e1b6fcbff0e750d0,droit_bon_bienvenue=3009389b130f6d636449cccfa9022251,passer_commande=d18a962833a100d12f0b317e46973640,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,remettre_commande=8eae2e162ca810ef5a4cfab1d7615ee8,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,utiliser_bon=6ded97cf884bac444cf82f89b7f5a254',
  'commandes, remise, blocage, no-shows, numéro, parrain, bons : définitions inchangées');

-- 1. Programme créé inactif, budget 0 : 500 DA dès 4 000 DA, part boutique 250 DA, 20 par boutique et par mois, 30 jours.
select pg_temp.ok((select count(*) from programmes_bons where type = 'inscription_boutique' and not actif and budget = 0 and montant = 500
  and minimum_achat = 4000 and part_boutique = 250 and plafond_inscriptions_mois = 20 and validite_jours = 30) = 1,
  'programme inscription_boutique : inactif, budget 0, 500 DA dès 4 000 DA, part 250 DA, 20 par mois');
select pg_temp.erreur($q$insert into programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat) values ('inscription_boutique', 'Autre', 'آخر', 100, 100)$q$,
  '23505', 'programmes_bons_un_inscription', 'un seul programme d''inscription');
select pg_temp.erreur($q$update programmes_bons set part_boutique = 500 where type = 'inscription_boutique'$q$,
  '23514', 'programmes_part_boutique', 'part de la boutique plus petite que le bon');

-- Données : 2 boutiques qui prennent les bons (X inscrit, Y ailleurs), 1 qui ne les prend pas (Z), commerçants, admin.
select pg_temp.compte(null);
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville, bons_acceptes) values
  ('d3140000-0000-0000-0000-00000000000a', 'Boutique Inscrit', 'boutique-inscrit-314', 'Gambetta', '+213555314901', 'validee', 'oran', true),
  ('d3140000-0000-0000-0000-00000000000b', 'Boutique Ailleurs', 'boutique-ailleurs-314', 'Centre', '+213555314902', 'validee', 'oran', true),
  ('d3140000-0000-0000-0000-00000000000c', 'Boutique Sans Bons', 'boutique-sans-bons-314', 'Centre', '+213555314903', 'validee', 'oran', false);
insert into auth.users (id, email) values ('b3140000-0000-0000-0000-00000000000a', 'boutique314a@test.dz'),
  ('b3140000-0000-0000-0000-00000000000b', 'boutique314b@test.dz'), ('a3140000-0000-0000-0000-00000000000a', 'admin314@test.dz');
update profils set role = 'commercant', boutique_id = 'd3140000-0000-0000-0000-00000000000a' where id = 'b3140000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd3140000-0000-0000-0000-00000000000b' where id = 'b3140000-0000-0000-0000-00000000000b';
update profils set role = 'admin' where id = 'a3140000-0000-0000-0000-00000000000a';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3140000-0000-0000-0000-00000000000a', 'd3140000-0000-0000-0000-00000000000a', 'Parfum X', 'Parfums', 4500, 'mixte'),
  ('e3140000-0000-0000-0000-00000000000b', 'd3140000-0000-0000-0000-00000000000b', 'Parfum Y', 'Parfums', 4500, 'mixte'),
  ('e3140000-0000-0000-0000-00000000000c', 'd3140000-0000-0000-0000-00000000000a', 'Foulard X', 'Hijabs et foulards', 1500, 'femme');
insert into tailles (article_id, libelle, disponible, quantite)
select a, 'M', true, 200 from unnest(array['e3140000-0000-0000-0000-00000000000a','e3140000-0000-0000-0000-00000000000b','e3140000-0000-0000-0000-00000000000c']::uuid[]) a;

create function pg_temp.client(i integer, verifie boolean default true) returns uuid language plpgsql as $$
declare cid uuid := ('c3140000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;
begin
  insert into auth.users (id, phone, phone_confirmed_at) values (cid, '2135553140' || lpad(i::text, 2, '0'), case when verifie then now() end);
  update profils set nom = 'Client ' || chr(64 + i) where profils.id = cid;
  return cid;
end $$;
create function pg_temp.verifier(cid uuid) returns void language sql as $$
  update auth.users set phone_confirmed_at = now() where auth.users.id = cid;
$$;
create function pg_temp.rattacher(cid uuid, slug text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.compte(cid); r := rattacher_inscription(slug); perform pg_temp.compte(null); return r;
end $$;
create function pg_temp.bons(cid uuid, o text) returns text language sql as $$
  select string_agg(statut, ',' order by cree_le) from bons where profil_id = cid and origine = o
$$;
create function pg_temp.bon(cid uuid) returns bons language sql as $$
  select * from bons where profil_id = cid and origine = 'inscription_boutique'
$$;
create function pg_temp.commande(client uuid, article uuid) returns uuid language plpgsql as $$
declare c uuid; b uuid := (select boutique_id from articles where id = article);
begin
  perform pg_temp.compte(client);
  c := passer_commande(b, format('[{"article_id":"%s","taille":"M","quantite":1}]', article)::jsonb);
  perform pg_temp.compte(null);
  update commandes set cree_le = cree_le - interval '2 hours' where id = c;
  return c;
end $$;
create function pg_temp.utiliser(client uuid, c uuid) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.compte(client); r := utiliser_bon(c); perform pg_temp.compte(null); return r;
end $$;
create function pg_temp.remettre_qr(c uuid) returns text language plpgsql as $$
declare m uuid := (select p.id from profils p join commandes x on x.boutique_id = p.boutique_id where x.id = c and p.role = 'commercant');
  r jsonb;
begin
  perform pg_temp.compte(m);
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  r := remettre_commande((select jeton from prive.retraits where commande_id = c));
  perform pg_temp.compte(null);
  return r ->> 'etat';
end $$;

\set prog '(select id from programmes_bons where type = ''inscription_boutique'')'
\set X d3140000-0000-0000-0000-00000000000a
\set Y d3140000-0000-0000-0000-00000000000b

-- 2. Programme inactif : le rattachement se fait, sans bon ; pas d'offre sur la vitrine.
select pg_temp.client(1);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000001', 'boutique-inscrit-314') @> '{"rattache": true}'
  and pg_temp.rattacher('c3140000-0000-0000-0000-000000000001', 'boutique-inscrit-314') ->> 'bon' is null
  and pg_temp.bons('c3140000-0000-0000-0000-000000000001', 'inscription_boutique') is null, 'programme inactif : rattaché, aucun bon');
select pg_temp.ok(offre_inscription('boutique-inscrit-314') is null, 'programme inactif : pas d''offre');
delete from inscriptions_boutique where profil_id = 'c3140000-0000-0000-0000-000000000001';

-- 3. Programme actif (budget 1 500 DA, 2 inscriptions récompensées par boutique et par mois) et bon de bienvenue actif.
update programmes_bons set actif = true, budget = 1500, plafond_inscriptions_mois = 2 where type = 'inscription_boutique';
update programmes_bons set actif = true, budget = 900 where type = 'bienvenue';
select pg_temp.ok(offre_inscription('boutique-inscrit-314') = '{"montant": 500, "minimum_achat": 4000}', 'offre ouverte : 500 DA dès 4 000 DA');
select pg_temp.ok(offre_inscription('boutique-sans-bons-314') is null, 'boutique qui ne prend pas les bons : pas d''offre');
select pg_temp.ok(offre_inscription('inconnue-314') is null, 'boutique inconnue : pas d''offre');

-- 3a. Numéro déjà vérifié : bon de bienvenue reçu à la vérification, remplacé par le bon d'inscription au rattachement.
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000001', 'bienvenue') is null, 'client A : pas de bon de bienvenue (vérifié avant l''activation)');
select pg_temp.client(2);
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000002', 'bienvenue') = 'disponible', 'client B : bon de bienvenue à la vérification');
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000002', 'boutique-inscrit-314') @> '{"rattache": true, "bon": "donne"}',
  'client B rattaché : « bon donne »');
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000002', 'bienvenue') = 'annule'
  and pg_temp.bons('c3140000-0000-0000-0000-000000000002', 'inscription_boutique') = 'disponible', 'client B : bon d''inscription à la place du bon de bienvenue');
select pg_temp.ok((select b.montant = 500 and b.minimum_achat = 4000 and b.boutique_origine = :'X' and b.part_boutique = 250
    and b.utilisable_des = (date_trunc('day', now() at time zone 'Africa/Algiers') + interval '1 day') at time zone 'Africa/Algiers'
    and b.expire_le between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour'
  from pg_temp.bon('c3140000-0000-0000-0000-000000000002') b), 'bon : 500 DA dès 4 000 DA, boutique d''origine, part 250, utilisable dès demain 0 h (Alger), 30 jours');
select pg_temp.ok(prive.budget_programme_restant((select id from programmes_bons where type = 'bienvenue')) = 900, 'bon de bienvenue annulé : budget de bienvenue rendu');

-- 3b. Numéro pas encore vérifié : « numero » au rattachement, bon à la vérification (bienvenue donné puis remplacé).
select pg_temp.client(3, false);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000003', 'boutique-inscrit-314') @> '{"rattache": true, "bon": "numero"}',
  'client C non vérifié : « bon numero »');
select pg_temp.verifier('c3140000-0000-0000-0000-000000000003');
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000003', 'inscription_boutique') = 'disponible'
  and pg_temp.bons('c3140000-0000-0000-0000-000000000003', 'bienvenue') = 'annule', 'client C vérifié ensuite : bon d''inscription, bienvenue annulé');

-- 3c. Plafond de la boutique atteint (2 ce mois) : inscription sans bon, le bon de bienvenue reste ; ailleurs l'offre reste.
select pg_temp.client(4);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000004', 'boutique-inscrit-314') @> '{"rattache": true}'
  and pg_temp.bons('c3140000-0000-0000-0000-000000000004', 'inscription_boutique') is null
  and pg_temp.bons('c3140000-0000-0000-0000-000000000004', 'bienvenue') = 'disponible', 'plafond du mois atteint : rattaché, sans bon d''inscription, bienvenue gardé');
select pg_temp.ok(prive.donner_bon_inscription('c3140000-0000-0000-0000-000000000004') = 'plafond', 'raison : plafond');
select pg_temp.ok(offre_inscription('boutique-inscrit-314') is null and offre_inscription('boutique-ailleurs-314') is not null,
  'plafond atteint : plus d''offre dans cette boutique, toujours ailleurs');

-- 3d. Un seul bon d'inscription par compte ; pas de nouveau bon si le compte n'est pas rattaché ; commerçant : jamais.
select pg_temp.ok(prive.donner_bon_inscription('c3140000-0000-0000-0000-000000000002') in ('deja', 'plafond'), 'client B : pas de 2e bon');
update programmes_bons set plafond_inscriptions_mois = 20 where type = 'inscription_boutique';
select pg_temp.ok(prive.donner_bon_inscription('c3140000-0000-0000-0000-000000000002') = 'deja', 'client B : un seul bon d''inscription par compte');
select pg_temp.ok(prive.donner_bon_inscription('c3140000-0000-0000-0000-000000000001') = 'inscription', 'compte non rattaché : pas de bon');
select pg_temp.ok(prive.donner_bon_inscription('b3140000-0000-0000-0000-00000000000a') = 'inscription', 'commerçant : pas de bon');

-- 3e. Numéro qui a déjà eu le bon de bienvenue sur un autre compte : pas de bon d'inscription.
delete from auth.users where id = 'c3140000-0000-0000-0000-000000000004';
insert into auth.users (id, phone, phone_confirmed_at) values ('c3140000-0000-0000-0000-000000000044', '213555314004', now());
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000044', 'boutique-ailleurs-314') @> '{"rattache": true}'
  and pg_temp.bons('c3140000-0000-0000-0000-000000000044', 'inscription_boutique') is null, 'compte recréé avec un numéro déjà récompensé : pas de bon');
select pg_temp.ok(prive.donner_bon_inscription('c3140000-0000-0000-0000-000000000044') = 'deja', 'raison : deja');

-- 3f. Filleul : bon d'inscription annulé quand le parrain est trouvé.
select pg_temp.client(5);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000005', 'boutique-ailleurs-314') @> '{"bon": "donne"}', 'client E rattaché à Y : bon');
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000005', 'inscription_boutique') = 'disponible', 'client E : bon d''inscription (boutique Y)');
insert into parrainages (filleul_id, parrain_id) values ('c3140000-0000-0000-0000-000000000005', 'c3140000-0000-0000-0000-000000000002');
select pg_temp.ok(pg_temp.bons('c3140000-0000-0000-0000-000000000005', 'inscription_boutique') = 'annule', 'parrain trouvé : bon d''inscription annulé');

-- 4. Utilisation : pas le jour même dans la boutique d'origine, tout de suite ailleurs.
select pg_temp.commande('c3140000-0000-0000-0000-000000000002', 'e3140000-0000-0000-0000-00000000000a') as bx \gset
select pg_temp.ok(pg_temp.utiliser('c3140000-0000-0000-0000-000000000002', :'bx') = 'pas_aujourdhui', 'boutique d''origine le jour même : « pas_aujourdhui »');
select pg_temp.ok((select remise_bon = 0 and bon_id is null from commandes where id = :'bx'), 'commande gardée au prix plein');
select pg_temp.compte('c3140000-0000-0000-0000-000000000002');
select pg_temp.ok(bons_panier(:'X', '[{"article_id":"e3140000-0000-0000-0000-00000000000a","taille":"M","quantite":1}]') -> 0 ->> 'raison' = 'pas_aujourdhui'
  and bons_panier(:'Y', '[{"article_id":"e3140000-0000-0000-0000-00000000000b","taille":"M","quantite":1}]') -> 0 ->> 'raison' = 'ok',
  'panier : « pas_aujourdhui » dans la boutique d''origine, « ok » ailleurs');
select pg_temp.ok((select e ->> 'boutique_origine' = 'Boutique Inscrit' and (e ->> 'utilisable_des') is not null
  from jsonb_array_elements(mes_bons()) e where e ->> 'origine' = 'inscription_boutique'), 'Mes bons : boutique d''origine et « utilisable dès »');
select pg_temp.compte(null);
-- Ailleurs : bon posé, remboursé en entier par BleDeal.
select pg_temp.commande('c3140000-0000-0000-0000-000000000002', 'e3140000-0000-0000-0000-00000000000b') as by \gset
select pg_temp.ok(pg_temp.utiliser('c3140000-0000-0000-0000-000000000002', :'by') = 'applique', 'autre boutique le jour même : bon posé');
select pg_temp.ok(pg_temp.remettre_qr(:'by') = 'remise', 'remise par QR code');
select pg_temp.ok((select l.montant = 500 and l.part_boutique = 0 and l.origine = 'inscription_boutique' from lignes_releve l where l.commande_id = :'by')
  and (select r.montant = 500 from releves_bons r where r.boutique_id = :'Y'), 'ailleurs : BleDeal rembourse les 500 DA');
-- Dès le lendemain dans la boutique d'origine : bon posé, la boutique paie sa part (250), BleDeal rembourse 250.
update bons set utilisable_des = now() - interval '1 second' where profil_id = 'c3140000-0000-0000-0000-000000000003' and origine = 'inscription_boutique';
select pg_temp.commande('c3140000-0000-0000-0000-000000000003', 'e3140000-0000-0000-0000-00000000000c') as petite \gset
select pg_temp.ok(pg_temp.utiliser('c3140000-0000-0000-0000-000000000003', :'petite') = 'minimum', 'commande de 1 500 DA : minimum de 4 000 DA');
select pg_temp.commande('c3140000-0000-0000-0000-000000000003', 'e3140000-0000-0000-0000-00000000000a') as cx \gset
select pg_temp.ok(pg_temp.utiliser('c3140000-0000-0000-0000-000000000003', :'cx') = 'applique', 'boutique d''origine le lendemain : bon posé');
select pg_temp.ok(pg_temp.remettre_qr(:'cx') = 'remise', 'remise par QR code dans la boutique d''origine');
select pg_temp.ok((select l.montant = 500 and l.part_boutique = 250 from lignes_releve l where l.commande_id = :'cx')
  and (select r.montant = 250 and r.nombre = 1 from releves_bons r where r.boutique_id = :'X'), 'boutique d''origine : relevé de 250 DA (500 − part 250)');

-- 5. Budget : seulement la part de BleDeal (500 ailleurs + 250 dans la boutique d'origine ; bon annulé non compté).
select pg_temp.ok(prive.budget_programme_restant(:prog) = 1500 - 500 - 250, 'budget restant : 750 DA (bon de E annulé non compté)');
select pg_temp.compte('a3140000-0000-0000-0000-00000000000a');
select pg_temp.ok((select (e ->> 'rembourse')::int = 750 and (e ->> 'part_boutique')::int = 250 and (e ->> 'plafond_inscriptions_mois')::int = 20
  from jsonb_array_elements(programmes_admin()) e where e ->> 'type' = 'inscription_boutique'), 'admin : remboursé 750 DA, part 250, plafond 20');

-- 6. Signaux admin (jamais bloquants) : 3 inscriptions dans la même minute chez X, 1 client qui n'achète que chez X.
select pg_temp.compte(null);
select pg_temp.client(7);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000007', 'boutique-inscrit-314') @> '{"bon": "donne"}', 'client G rattaché à X : bon');
select pg_temp.compte('a3140000-0000-0000-0000-00000000000a');
select pg_temp.ok((select (e ->> 'inscrits')::int = 3 and (e ->> 'meme_minute')::int = 3 and (e ->> 'jamais_ailleurs')::int = 1
  and (e ->> 'sans_commande')::int = 0 from jsonb_array_elements(signaux_inscriptions()) e where e ->> 'slug' = 'boutique-inscrit-314'),
  'signaux X : 3 inscrits, 3 dans la même minute, 1 n''achète que chez X');
update inscriptions_boutique set cree_le = now() - interval '8 days' where profil_id = 'c3140000-0000-0000-0000-000000000044';
update commandes set terminee_le = cree_le + interval '10 minutes' where id = :'cx';
select pg_temp.ok((select (e ->> 'sans_commande')::int = 1 from jsonb_array_elements(signaux_inscriptions()) e where e ->> 'slug' = 'boutique-ailleurs-314')
  and (select (e ->> 'remises_rapides')::int = 1 from jsonb_array_elements(signaux_inscriptions()) e where e ->> 'slug' = 'boutique-inscrit-314'),
  'signaux : inscrit depuis 8 jours sans commande (Y), remise moins de 30 min après la commande (X)');
select pg_temp.compte('c3140000-0000-0000-0000-000000000002');
select pg_temp.erreur($q$select signaux_inscriptions()$q$, '42501', 'Réservé', 'client : pas de signaux');

-- 7. Espace de la boutique : nombres seulement (inscrits, bons du mois, plafond, part).
select pg_temp.compte('b3140000-0000-0000-0000-00000000000a');
select pg_temp.ok(abonnes_boutique() @> '{"inscrits": 3, "bons_inscription_mois": 3, "plafond_inscriptions_mois": 20, "part_boutique": 250, "montant_bon_inscription": 500}',
  'espace X : 3 inscrits, 3 bons ce mois sur 20, part 250');
update programmes_bons set actif = false where type = 'inscription_boutique';
select pg_temp.ok(abonnes_boutique() @> '{"inscrits": 3}' and abonnes_boutique() ->> 'bons_inscription_mois' is null, 'programme arrêté : inscrits seulement');
update programmes_bons set actif = true where type = 'inscription_boutique';
select pg_temp.compte(null);

-- 8. Une panne du bon n'empêche ni le rattachement ni la vérification du numéro.
create or replace function prive.donner_bon_inscription(compte uuid) returns text language plpgsql as $$
begin raise exception 'panne simulée'; end $$;
select pg_temp.client(6, false);
select pg_temp.ok(pg_temp.rattacher('c3140000-0000-0000-0000-000000000006', 'boutique-ailleurs-314') @> '{"rattache": true}', 'panne : rattachement fait');
select pg_temp.verifier('c3140000-0000-0000-0000-000000000006');
select pg_temp.ok((select telephone_verifie_le is not null from profils where id = 'c3140000-0000-0000-0000-000000000006'), 'panne : numéro vérifié quand même');

-- 9. Droits : fonctions internes fermées ; offre lisible par les visiteurs ; signaux réservés aux comptes.
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.donner_bon_inscription(uuid)', 'execute')
  and not has_function_privilege('anon', 'prive.offre_inscription_ouverte(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.bons_inscription_mois(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.bon_inscription_filleul()', 'execute'),
  'fonctions internes : aucun droit pour anon et authenticated');
select pg_temp.ok(has_function_privilege('anon', 'public.offre_inscription(text)', 'execute')
  and not has_function_privilege('anon', 'public.signaux_inscriptions()', 'execute'), 'offre : visiteurs ; signaux : pas les visiteurs');
-- Les bons de parrainage, bienvenue et campagne n'ont jamais de part de boutique.
select pg_temp.ok(not exists (select 1 from bons where origine <> 'inscription_boutique' and (part_boutique <> 0 or boutique_origine is not null)),
  'autres bons : sans part ni boutique d''origine');

rollback;

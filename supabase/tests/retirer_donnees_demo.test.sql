-- Test SQL du script supabase/scripts/retirer_donnees_demo.sql (retrait des données de démonstration).
-- Le script n'est PAS une migration : ce test le lance sur une base locale (toutes les migrations),
-- avec des données qui imitent la base de production du 9 octobre 2026 + de « vraies » données à garder.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/retirer_donnees_demo.test.sql
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

-- ---------------------------------------------------------------------------
-- Données : la démo de production (mêmes identifiants) ...
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('78b03d9d-299d-480b-b2b9-f6149523bb27', 'benattia.hakim@gmail.com'),  -- admin : à garder
  ('da9f4aa4-9bfa-4312-9a8f-05c3eefffc99', 'hakim3142@gmail.com'),       -- compte de test : à supprimer
  ('c4000000-0000-0000-0000-000000000001', 'vraie-cliente@test.dz'),     -- vraie cliente : à garder
  ('c4000000-0000-0000-0000-000000000002', 'vrai-commercant@test.dz');   -- vrai commerçant : à garder
-- Boutique Nour a un numéro volontairement invalide (+213000000002), créé avant la règle de format.
alter table boutiques disable trigger coordonnees_boutique_protegees;
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('11111111-1111-1111-1111-111111111111', 'Maison Ilyes', 'maison-ilyes', 'Centre', '+213555940011', 'validee', 'oran'),
  ('22222222-2222-2222-2222-222222222222', 'Boutique Nour', 'boutique-nour', 'Akid Lotfi', '+213000000002', 'validee', 'oran');
alter table boutiques enable trigger coordonnees_boutique_protegees;
-- Vraie boutique du vrai commerçant, créée ici (relecture n°6, point 5 : le test ne dépend d'aucune donnée hors du dépôt).
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('c6000000-0000-0000-0000-000000000001', 'Vraie Boutique', 'vraie-boutique', 'Gambetta', '+213555940066', 'validee', 'oran');
update profils set role = 'admin', boutique_id = '11111111-1111-1111-1111-111111111111' where id = '78b03d9d-299d-480b-b2b9-f6149523bb27';
update profils set role = 'commercant', boutique_id = '22222222-2222-2222-2222-222222222222', telephone = '+213555940099' where id = 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99';
update profils set role = 'client', nom = 'Vraie Cliente', telephone = '+213555940001' where id = 'c4000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'c6000000-0000-0000-0000-000000000001' where id = 'c4000000-0000-0000-0000-000000000002';

insert into articles (id, boutique_id, titre, categorie, prix, genre, statut) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Polo piqué bleu marine', 'T-shirts et polos', 4500, 'homme', 'disponible'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Chemise en lin blanche', 'Chemises', 5000, 'homme', 'disponible'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Jean droit brut', 'Pantalons et jeans', 6000, 'homme', 'disponible'),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Robe longue fleurie', 'Robes', 7000, 'femme', 'disponible'),
  ('a0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Foulard en soie', 'Hijabs et foulards', 2000, 'femme', 'disponible'),
  -- ... et un vrai article de Maison Ilyes, à garder.
  ('c5000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Vrai polo', 'T-shirts et polos', 3900, 'homme', 'disponible');
insert into tailles (article_id, libelle, quantite) values
  ('a0000000-0000-0000-0000-000000000001', 'M', 5), ('a0000000-0000-0000-0000-000000000001', 'L', 5),
  ('a0000000-0000-0000-0000-000000000002', 'M', 3), ('a0000000-0000-0000-0000-000000000003', '42', 1),
  ('a0000000-0000-0000-0000-000000000004', '38', 2), ('a0000000-0000-0000-0000-000000000005', 'Unique', 4),
  ('c5000000-0000-0000-0000-000000000001', 'M', 5);
insert into promos (article_id, prix_promo, date_fin) values
  ('a0000000-0000-0000-0000-000000000001', 3500, now() + interval '3 days'),
  ('a0000000-0000-0000-0000-000000000004', 5000, now() - interval '1 day'),
  ('c5000000-0000-0000-0000-000000000001', 2900, now() + interval '3 days');
-- Photos placehold.co créées avant la règle d'adresse ; une vraie photo sur le vrai article.
alter table photos disable trigger photo_adresse_verifiee;
insert into photos (article_id, adresse, ordre) values
  ('a0000000-0000-0000-0000-000000000001', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Polo+1', 0),
  ('a0000000-0000-0000-0000-000000000001', 'https://placehold.co/600x800/E6E6E6/0A0A0A/png?text=Polo+2', 1),
  ('a0000000-0000-0000-0000-000000000004', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Robe', 0),
  ('c5000000-0000-0000-0000-000000000001', 'https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/11111111-1111-1111-1111-111111111111/c5000000-0000-0000-0000-000000000001/vrai.jpg', 0),
  ('c5000000-0000-0000-0000-000000000001', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Oubli', 1);
alter table photos enable trigger photo_adresse_verifiee;
insert into evenements (type, boutique_id, article_id) values
  ('vue_article', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001'),
  ('clic_reserver', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001'),
  ('vue_boutique', '22222222-2222-2222-2222-222222222222', null),
  ('vue_article', '11111111-1111-1111-1111-111111111111', 'c5000000-0000-0000-0000-000000000001');
insert into signalements (id, article_id, motif) values
  ('c6000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Contenu inapproprié'),
  ('c6000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001', 'Contenu inapproprié');
insert into decisions (signalement_id, action, auteur_id) values
  ('c6000000-0000-0000-0000-000000000001', 'masquer', '78b03d9d-299d-480b-b2b9-f6149523bb27'),  -- article de démo : supprimée
  ('c6000000-0000-0000-0000-000000000002', 'garder', 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99'),   -- écrite par le compte de démo : supprimée
  ('c6000000-0000-0000-0000-000000000002', 'garder', '78b03d9d-299d-480b-b2b9-f6149523bb27');   -- à garder
-- Commandes : vraie cliente chez Nour (démo), compte de démo chez Maison Ilyes (démo),
-- vraie cliente chez Maison Ilyes avec un article de démo et un vrai article (à garder).
insert into commandes (id, client_id, boutique_id, client_nom, client_telephone, total) values
  ('c7000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Vraie Cliente', '+213555940001', 7000),
  ('c7000000-0000-0000-0000-000000000002', 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99', '11111111-1111-1111-1111-111111111111', 'Compte Demo', '+213555940099', 4500),
  ('c7000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Vraie Cliente', '+213555940001', 8400);
insert into lignes_commande (commande_id, article_id, titre, taille, quantite, prix_unitaire) values
  ('c7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Robe longue fleurie', '38', 1, 7000),
  ('c7000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Polo piqué bleu marine', 'M', 1, 4500),
  ('c7000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Polo piqué bleu marine', 'M', 1, 4500),
  ('c7000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000001', 'Vrai polo', 'M', 1, 3900);
insert into suivi_commandes (commande_id, statut, auteur) values
  ('c7000000-0000-0000-0000-000000000001', 'demandee', 'client'),
  ('c7000000-0000-0000-0000-000000000003', 'demandee', 'client');
insert into messages_whatsapp (destinataire, modele, texte, commande_id) values
  ('+213555940001', 'oranpromo_commande_prete', 'commande de démo chez Nour', 'c7000000-0000-0000-0000-000000000001'),
  ('+213555940099', 'oranpromo_compte_bloque', 'au numéro du compte de démo, sans commande', null),
  ('+213555940001', 'oranpromo_compte_bloque', 'à la vraie cliente, sans commande : à garder', null),
  ('+213555940001', 'oranpromo_commande_prete', 'vraie commande : à garder', 'c7000000-0000-0000-0000-000000000003');
-- US-25 : boutique de démonstration « Parfumerie Démo » (script de démo lancé deux fois : rien en double),
-- avec une commande d'une vraie cliente (son numéro de test +213000000003 est refusé par la file WhatsApp :
-- aucun message ne peut partir vers lui).
\o /dev/null
\ir ../scripts/demo_parfumerie.sql
\ir ../scripts/demo_parfumerie.sql
\o
insert into commandes (id, client_id, boutique_id, client_nom, client_telephone, total) values
  ('c7000000-0000-0000-0000-000000000004', 'c4000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Vraie Cliente', '+213555940001', 4900);
insert into lignes_commande (commande_id, article_id, titre, taille, quantite, prix_unitaire) values
  ('c7000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 'Eau de parfum oud boisé', '100 ml', 1, 4900);
insert into evenements (type, boutique_id, article_id) values
  ('vue_article', '33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000007');
select pg_temp.ok((select count(*) from boutiques where id = '33333333-3333-3333-3333-333333333333' and statut = 'validee' and slug = 'parfumerie-demo') = 1
  and (select count(*) from articles where boutique_id = '33333333-3333-3333-3333-333333333333' and categorie = 'Parfums') = 5
  and (select count(*) from tailles where article_id in (select id from articles where boutique_id = '33333333-3333-3333-3333-333333333333')) = 6
  and (select count(*) from promos where article_id in (select id from articles where boutique_id = '33333333-3333-3333-3333-333333333333')) = 4
  and (select count(*) from photos where article_id in (select id from articles where boutique_id = '33333333-3333-3333-3333-333333333333') and adresse like 'https://placehold.co/%') = 5,
  'démo Parfumerie : lancée deux fois, 1 boutique, 5 parfums, 6 contenances, 4 promos, 5 photos (rien en double)');
select pg_temp.ok((select latitude between 35.33 and 35.92 and longitude between -1.15 and -0.10 from boutiques where id = '33333333-3333-3333-3333-333333333333')
  and (select promos_en_cours from boutiques_carte() where slug = 'parfumerie-demo') = 4
  and (select bool_and(p.prix_promo < a.prix) from promos p join articles a on a.id = p.article_id where a.boutique_id = '33333333-3333-3333-3333-333333333333'),
  'démo Parfumerie : dans la wilaya d''Oran, 4 promos en cours sur la carte, prix promo < prix');
insert into appels_ia (utilisateur_id) values ('da9f4aa4-9bfa-4312-9a8f-05c3eefffc99'), ('78b03d9d-299d-480b-b2b9-f6149523bb27');
insert into prive.envois_codes (telephone) values ('+213555940099'), ('+213555940001');

-- ---------------------------------------------------------------------------
-- Photo de la base avant le script, et ce qui doit rester après.
-- ---------------------------------------------------------------------------
create temp table etat (tbl text, cle text);
create function pg_temp.photographier() returns setof etat language sql as $$
  select 'auth.users', id::text from auth.users union all
  select 'profils', id::text || '|' || coalesce(boutique_id::text, '-') from profils union all
  select 'boutiques', id::text from boutiques union all
  select 'articles', id::text from articles union all
  select 'photos', id::text from photos union all
  select 'tailles', id::text from tailles union all
  select 'promos', article_id::text from promos union all
  select 'evenements', id::text from evenements union all
  select 'signalements', id::text from signalements union all
  select 'decisions', id::text from decisions union all
  select 'commandes', id::text from commandes union all
  select 'lignes_commande', id::text || '|' || coalesce(article_id::text, '-') from lignes_commande union all
  select 'suivi_commandes', id::text from suivi_commandes union all
  select 'contestations', commande_id::text from contestations union all
  select 'messages_whatsapp', id::text from messages_whatsapp union all
  select 'appels_ia', utilisateur_id::text || '|' || date::text from appels_ia union all
  select 'prive.envois_codes', telephone || '|' || envoye_le::text from prive.envois_codes;
$$;
insert into etat select * from pg_temp.photographier();
create temp table attendu as select * from etat;
-- Lignes de démonstration attendues (et seulement elles) :
delete from attendu where tbl = 'auth.users' and cle = 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99';
delete from attendu where tbl = 'profils' and cle like 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99|%';
delete from attendu where tbl = 'boutiques' and cle in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
delete from attendu where tbl = 'articles' and cle like 'a0000000-0000-0000-0000-%';
delete from attendu where tbl = 'photos' and cle in (select id::text from photos where adresse like 'https://placehold.co/%');
delete from attendu where tbl = 'tailles' and cle in (select id::text from tailles where article_id::text like 'a0000000-%');
delete from attendu where tbl = 'promos' and cle like 'a0000000-%';
delete from attendu where tbl = 'evenements' and cle in (select id::text from evenements where article_id::text like 'a0000000-%' or boutique_id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'));
delete from attendu where tbl = 'signalements' and cle = 'c6000000-0000-0000-0000-000000000001';
delete from attendu where tbl = 'decisions' and cle in (select id::text from decisions where signalement_id = 'c6000000-0000-0000-0000-000000000001' or auteur_id = 'da9f4aa4-9bfa-4312-9a8f-05c3eefffc99');
delete from attendu where tbl = 'commandes' and cle in ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000004');
delete from attendu where tbl = 'lignes_commande' and cle in (select id::text || '|' || coalesce(article_id::text, '-') from lignes_commande where commande_id in ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000004'));
-- La ligne de la vraie commande qui citait le polo de démo reste, sans lien vers l'article.
update attendu set cle = split_part(cle, '|', 1) || '|-' where tbl = 'lignes_commande' and cle like '%|a0000000-%';
delete from attendu where tbl = 'suivi_commandes' and cle in (select id::text from suivi_commandes where commande_id in ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002'));
delete from attendu where tbl = 'messages_whatsapp' and cle in (select id::text from messages_whatsapp where destinataire in ('+213000000002', '+213555940099') or commande_id in ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000004'));
delete from attendu where tbl = 'appels_ia' and cle like 'da9f4aa4-%';
delete from attendu where tbl = 'prive.envois_codes' and cle like '+213555940099|%';

-- ---------------------------------------------------------------------------
-- 1. Essai à blanc : rien ne change, le rapport annonce les suppressions
-- ---------------------------------------------------------------------------
\o /dev/null
\ir ../scripts/retirer_donnees_demo.sql
\o
select pg_temp.ok(not exists (select * from pg_temp.photographier() except select * from etat)
  and not exists (select * from etat except select * from pg_temp.photographier()), 'essai à blanc : aucune ligne supprimée ni modifiée');
select pg_temp.ok((select objet like 'ESSAI À BLANC%' from rapport_retrait_demo where ordre = 0), 'essai à blanc : le rapport le dit');
select pg_temp.ok((select nombre from rapport_retrait_demo where objet = 'articles') = 10
  and (select nombre from rapport_retrait_demo where objet = 'boutiques') = 2
  and (select nombre from rapport_retrait_demo where objet = 'auth.users') = 1
  and (select nombre from rapport_retrait_demo where objet = 'photos') = 9,
  'essai à blanc : le rapport annonce 1 compte, 2 boutiques (Nour, Parfumerie Démo), 10 articles, 9 photos placehold.co');
select pg_temp.ok(not exists (
    select e.tbl from (select tbl, count(*) n from etat group by tbl) e
    left join (select tbl, count(*) n from attendu group by tbl) a using (tbl)
    left join rapport_retrait_demo r on r.objet = e.tbl
    where e.n - coalesce(a.n, 0) is distinct from r.nombre),
  'essai à blanc : pour chaque table, le nombre annoncé = nombre exact de lignes de démo');

-- ---------------------------------------------------------------------------
-- 2. Suppression réelle : exactement les données de démo
-- ---------------------------------------------------------------------------
set local oranpromo.retirer_demo = 'oui';
\o /dev/null
\ir ../scripts/retirer_donnees_demo.sql
\o
select pg_temp.ok((select objet = 'SUPPRESSION EFFECTUÉE' from rapport_retrait_demo where ordre = 0), 'suppression : le rapport le dit');
select pg_temp.ok(not exists (select * from pg_temp.photographier() except select * from attendu), 'suppression : aucune ligne de démo ne reste');
select pg_temp.ok(not exists (select * from attendu except select * from pg_temp.photographier()), 'suppression : toutes les autres lignes sont gardées (rien de plus n''est supprimé)');
select pg_temp.ok((select role = 'admin' and boutique_id = '11111111-1111-1111-1111-111111111111' from profils where id = '78b03d9d-299d-480b-b2b9-f6149523bb27')
  and exists (select 1 from auth.users where email = 'benattia.hakim@gmail.com'), 'admin gardé, toujours rattaché à Maison Ilyes');
select pg_temp.ok((select boutique_id = 'c6000000-0000-0000-0000-000000000001' from profils where id = 'c4000000-0000-0000-0000-000000000002')
  and exists (select 1 from boutiques where slug = 'vraie-boutique'), 'vrai commerçant gardé, toujours rattaché à sa boutique');
select pg_temp.ok(exists (select 1 from boutiques where slug = 'maison-ilyes') and not exists (select 1 from boutiques where slug in ('boutique-nour', 'parfumerie-demo')), 'Maison Ilyes gardée, Boutique Nour et Parfumerie Démo supprimées');
select pg_temp.ok((select article_id is null and titre = 'Polo piqué bleu marine' and prix_unitaire = 4500 from lignes_commande
  where commande_id = 'c7000000-0000-0000-0000-000000000003' and taille = 'M' and titre like 'Polo%'),
  'vraie commande : la ligne du polo de démo garde titre et prix, sans lien vers l''article');
select pg_temp.ok(not exists (select 1 from photos where adresse like 'https://placehold.co/%')
  and exists (select 1 from photos where article_id = 'c5000000-0000-0000-0000-000000000001'), 'plus aucune photo placehold.co ; la vraie photo reste');
select pg_temp.ok((select nombre from rapport_retrait_demo where objet like 'lignes_commande gardées%') = 1, 'rapport : 1 ligne de vraie commande détachée');

-- ---------------------------------------------------------------------------
-- 3. Idempotent : une deuxième fois, rien à supprimer
-- ---------------------------------------------------------------------------
\o /dev/null
\ir ../scripts/retirer_donnees_demo.sql
\o
select pg_temp.ok((select coalesce(sum(nombre), 0) from rapport_retrait_demo where ordre > 0) = 0, 'deuxième passage : 0 ligne supprimée');
select pg_temp.ok(not exists (select * from attendu except select * from pg_temp.photographier()), 'deuxième passage : les vraies données sont toujours là');

select 'Tous les tests SQL du retrait des données de démonstration passent.';
rollback;

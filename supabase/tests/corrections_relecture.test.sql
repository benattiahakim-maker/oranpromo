-- Tests SQL de la migration 20261009230000_corrections_relecture.sql (relecture US-20).
-- À lancer sur une base où toutes les migrations sont appliquées (base locale PostgreSQL 17 avec les rôles
-- anon / authenticated et auth.uid() lu dans request.jwt.claim.sub, comme Supabase) :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/corrections_relecture.test.sql
-- Tout se passe dans une transaction annulée à la fin : aucune donnée n'est gardée.
-- Chaque test affiche « ok - <nom> » ; le premier échec arrête le script.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
begin;

-- ---------------------------------------------------------------------------
-- Outils
-- ---------------------------------------------------------------------------
create function pg_temp.ok(condition boolean, nom text) returns text language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'ÉCHEC - %', nom; end if;
  return 'ok - ' || nom;
end $$;

-- Exécute une requête et vérifie qu'elle échoue avec ce code (et ce morceau de message).
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

-- Comptes : admin, deux commerçants, trois clients.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.dz'),
  ('b0000000-0000-0000-0000-000000000001', 'boutique1@test.dz'),
  ('b0000000-0000-0000-0000-000000000002', 'boutique2@test.dz'),
  ('c0000000-0000-0000-0000-000000000001', 'client1@test.dz'),
  ('c0000000-0000-0000-0000-000000000002', 'client2@test.dz'),
  ('c0000000-0000-0000-0000-000000000003', 'client3@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d0000000-0000-0000-0000-000000000001', 'Boutique Test Un', 'test-un', 'Centre', '+213555900001', 'validee'),
  ('d0000000-0000-0000-0000-000000000002', 'Boutique Test Deux', 'test-deux', 'Centre', '+213555900002', 'validee');
update profils set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd0000000-0000-0000-0000-000000000001' where id = 'b0000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd0000000-0000-0000-0000-000000000002' where id = 'b0000000-0000-0000-0000-000000000002';
update profils set nom = 'Samia', telephone = '+213555100001' where id = 'c0000000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555100002' where id = 'c0000000-0000-0000-0000-000000000002';
update profils set nom = 'Yacine', telephone = '+213555100003' where id = 'c0000000-0000-0000-0000-000000000003';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Polo test', 'T-shirts et polos', 4000, 'homme'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Robe test', 'Robes', 6000, 'femme'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Chemise test', 'Chemises', 3000, 'homme');
insert into tailles (article_id, libelle, disponible) values
  ('e0000000-0000-0000-0000-000000000001', 'M', true),
  ('e0000000-0000-0000-0000-000000000002', 'S', true), ('e0000000-0000-0000-0000-000000000002', 'M', true),
  ('e0000000-0000-0000-0000-000000000003', 'L', true);
update tailles set quantite = 50 where article_id = 'e0000000-0000-0000-0000-000000000003';
insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('jeton-de-test-0123456789', 'UTF8')), 'hex'))
  on conflict (cle) do update set valeur = excluded.valeur;

-- Une commande « prête » de la Chemise (1 pièce) pour un client, dont le délai de 24 h est passé.
create function pg_temp.commande_prete_expiree(client uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]');
  perform pg_temp.compte('b0000000-0000-0000-0000-000000000001');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  reset role;
  -- Commande vieillie de 2 h : la limite de 3 commandes par heure et par boutique (relecture n°4) ne gêne pas.
  update commandes set expire_le = now() - interval '1 minute', cree_le = now() - interval '2 hours' where id = c;
  set local role authenticated;
  return c;
end $$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 1 : confirmation refusée si le stock ne suffit plus ; l'annulation ne gonfle pas le stock.
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000001') \g /dev/null
select passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000001","taille":"M","quantite":1}]') as c1 \gset
-- La boutique vend la pièce en direct : stock 0.
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
update tailles set quantite = 0 where article_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.erreur(format('select changer_statut_commande(%L, ''confirmee'')', :'c1'), '23514', 'Stock insuffisant pour « Polo test » en taille M',
  'point 1 : confirmation refusée « Stock insuffisant pour … » (23514)');
select pg_temp.ok((select statut from commandes where id = :'c1') = 'demandee', 'point 1 : la commande reste « demandée »');
select changer_statut_commande(:'c1', 'annulee', 'plus_en_stock') \g /dev/null
select pg_temp.ok((select quantite from tailles where article_id = 'e0000000-0000-0000-0000-000000000001') = 0,
  'point 1 : annuler ne remet pas de stock fantôme (reste 0)');

-- ---------------------------------------------------------------------------
-- Point 2 : S×1 + M×1 sur un article à 2 pièces, confirmer puis annuler → l'article redevient disponible.
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000001') \g /dev/null
select passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000002","taille":"S","quantite":1},{"article_id":"e0000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]') as c2 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select changer_statut_commande(:'c2', 'confirmee') \g /dev/null
select pg_temp.ok((select statut from articles where id = 'e0000000-0000-0000-0000-000000000002') = 'vendu', 'point 2 : stock à 0 → article « vendu »');
select changer_statut_commande(:'c2', 'annulee', 'autre') \g /dev/null
select pg_temp.ok((select statut from articles where id = 'e0000000-0000-0000-0000-000000000002') = 'disponible'
  and (select sum(quantite) from tailles where article_id = 'e0000000-0000-0000-0000-000000000002') = 2,
  'point 2 : confirmer puis annuler S×1 + M×1 → article de nouveau « disponible »');

-- ---------------------------------------------------------------------------
-- Point 4 : nom limité aux lettres, espaces, apostrophe, tiret (base).
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur('update profils set nom = ''Samia https://x.co'' where id = auth.uid()', '23514', 'Nom invalide', 'point 4 : lien refusé dans le nom');
select pg_temp.erreur('update profils set nom = ''Samia ' || E'\n' || 'Cliquez'' where id = auth.uid()', '23514', 'Nom invalide', 'point 4 : retour à la ligne refusé');
select pg_temp.erreur('update profils set nom = ''Samia 0555'' where id = auth.uid()', '23514', 'Nom invalide', 'point 4 : chiffres refusés');
select pg_temp.erreur('update profils set nom = repeat(''a'', 61) where id = auth.uid()', '23514', 'Nom invalide', 'point 4 : plus de 60 caractères refusé');
update profils set nom = 'Éloïse d’Arc-Ben  Ali' where id = auth.uid();
select pg_temp.ok((select nom from profils where id = auth.uid()) = 'Éloïse d’Arc-Ben Ali', 'point 4 : accents, apostrophe, tiret acceptés (espaces doubles réduits)');
update profils set nom = 'كريم بن علي' where id = auth.uid();
select pg_temp.ok((select nom from profils where id = auth.uid()) = 'كريم بن علي', 'point 4 : nom en arabe accepté');
reset role;
select pg_temp.erreur('update profils set nom = ''Admin www.x.co'' where id = ''c0000000-0000-0000-0000-000000000002''', '23514', 'Nom invalide', 'point 4 : refusé aussi pour le service (contrainte)');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 8 : ligne de commande incomplète → message clair ; statut manquant → refus clair.
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur('select passer_commande(''d0000000-0000-0000-0000-000000000001'', ''[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L"}]'')',
  '22023', 'incomplète', 'point 8 : quantité manquante refusée clairement');
select pg_temp.erreur('select passer_commande(''d0000000-0000-0000-0000-000000000001'', ''[{"taille":"L","quantite":1}]'')',
  '22023', 'incomplète', 'point 8 : article manquant refusé clairement');
select pg_temp.erreur('select passer_commande(''d0000000-0000-0000-0000-000000000001'', null)', '23514', 'de 1 à 10 lignes', 'point 8 : panier absent refusé');
select passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]') as c8 \gset
select pg_temp.erreur(format('select changer_statut_commande(%L, null)', :'c8'), '22023', 'statut manquant', 'point 8 : statut manquant refusé clairement');
select pg_temp.ok((select statut from commandes where id = :'c8') = 'demandee', 'point 8 : la commande n''a pas bougé');

-- ---------------------------------------------------------------------------
-- Point 9 : tailles verrouillées dans un ordre fixe.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.ok(pg_get_functiondef('prive.retirer_stock(uuid)'::regprocedure) like '%order by t.id for update of t%'
  and pg_get_functiondef('prive.remettre_stock(uuid)'::regprocedure) like '%order by t.id for update of t%',
  'point 9 : retirer_stock et remettre_stock verrouillent les tailles par id');

-- ---------------------------------------------------------------------------
-- Point 10 : search_path fixé.
-- ---------------------------------------------------------------------------
select pg_temp.ok((select bool_and(coalesce(array_to_string(proconfig, ','), '') like '%search_path=%') from pg_proc
  where oid in ('prive.numero_whatsapp(text)'::regprocedure, 'prive.montant_da(integer)'::regprocedure)),
  'point 10 : search_path fixé sur numero_whatsapp et montant_da');
select pg_temp.ok(prive.numero_whatsapp('0555 12 34 56') = '+213555123456' and prive.montant_da(12500) = '12 500 DA', 'point 10 : les deux fonctions marchent toujours');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 5 : le résultat d'un envoi exige le jeton de la tâche d'envoi.
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000003') \g /dev/null
select id as m5, reservation as r5 from messages_whatsapp_commande(:'c8') limit 1 \gset
select pg_temp.erreur(format('select resultat_message_whatsapp(null, %L, %L, true, ''faux'')', :'m5', :'r5'), '42501', 'Accès refusé', 'point 5 : sans jeton, un participant ne marque pas « envoyé »');
select pg_temp.erreur(format('select resultat_message_whatsapp(''mauvais-jeton-0123456789'', %L, %L, true)', :'m5', :'r5'), '42501', 'Accès refusé', 'point 5 : mauvais jeton refusé');
select pg_temp.erreur(format('select resultat_message_whatsapp(%L, %L, true)', :'m5', :'r5'), '42883', '', 'point 5 : l''ancienne signature sans jeton n''existe plus');
set local role anon;
select resultat_message_whatsapp('jeton-de-test-0123456789', :'m5', :'r5', true, 'wamid.TEST') \g /dev/null
reset role;
select pg_temp.ok((select statut from messages_whatsapp where id = :'m5') = 'envoye', 'point 5 : avec le jeton du serveur, le résultat est enregistré');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 11 (option C) : l'expiration ne compte plus de no-show ; la boutique déclare « Client pas venu ».
-- ---------------------------------------------------------------------------
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e1 \gset
reset role;
select prive.expirer_commandes() \g /dev/null
select pg_temp.ok((select statut from commandes where id = :'e1') = 'expiree'
  and (select no_shows from profils where id = 'c0000000-0000-0000-0000-000000000001') = 0,
  'point 11 : la commande expire sans compter de no-show');
select pg_temp.ok((select count(*) from messages_whatsapp where commande_id = :'e1' and modele = 'oranpromo_commande_expiree' and jsonb_array_length(parametres) = 3 and texte not like '%bloqué%') = 1,
  'point 11 : le rappel d''expiration part sans compte d''essais');
set local role authenticated;
select pg_temp.compte('b0000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select declarer_no_show(%L)', :'e1'), 'P0002', 'introuvable', 'point 11 : une autre boutique ne déclare pas');
select pg_temp.compte('c0000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select declarer_no_show(%L)', :'e1'), 'P0002', 'introuvable', 'point 11 : le client ne déclare pas');
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e1') \g /dev/null
reset role;
select pg_temp.ok((select no_shows from profils where id = 'c0000000-0000-0000-0000-000000000001') = 1
  and (select parametres ->> 3 || '/' || (parametres ->> 4) from messages_whatsapp where commande_id = :'e1' and modele = 'oranpromo_no_show') = '1/4',
  'point 11 : « Client pas venu » compte 1 no-show et avertit le client (encore 4)');
set local role authenticated;
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select declarer_no_show(%L)', :'e1'), '23514', 'déjà signalé', 'point 11 : une seule déclaration par commande');
select pg_temp.compte('c0000000-0000-0000-0000-000000000003') \g /dev/null
select passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]') as c11 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select changer_statut_commande(:'c11', 'confirmee') \g /dev/null
select changer_statut_commande(:'c11', 'prete') \g /dev/null
select pg_temp.erreur(format('select declarer_no_show(%L)', :'c11'), '23514', 'possible seulement', 'point 11 : pas de no-show avant les 24 h');
-- Prête depuis plus de 24 h (la tâche planifiée n'est pas encore passée) : déclarer l'expire d'abord.
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e2 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e2') \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'e2') = 'expiree'
  and (select no_shows from profils where id = 'c0000000-0000-0000-0000-000000000001') = 2,
  'point 11 : prête depuis plus de 24 h → expirée puis no-show (2)');
set local role authenticated;
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
-- Annulation par l'admin seulement.
select pg_temp.erreur(format('select annuler_no_show(%L)', :'e2'), '42501', 'administrateurs', 'point 11 : la boutique n''annule pas un no-show');
select pg_temp.compte('a0000000-0000-0000-0000-000000000001') \g /dev/null
select annuler_no_show(:'e2') \g /dev/null
select pg_temp.ok((select no_shows from profils where id = 'c0000000-0000-0000-0000-000000000001') = 1, 'point 11 : l''admin annule un no-show (2 → 1)');
select pg_temp.erreur(format('select annuler_no_show(%L)', :'e2'), 'P0002', 'Aucun no-show', 'point 11 : un no-show annulé ne s''annule pas deux fois');

-- 5e no-show : blocage, message de blocage à la place de l'avertissement.
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e3 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e3') \g /dev/null
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e4 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e4') \g /dev/null
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e5 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e5') \g /dev/null
select pg_temp.commande_prete_expiree('c0000000-0000-0000-0000-000000000001') as e6 \gset
select pg_temp.compte('b0000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'e6') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 5 and bloque and bloque_le is not null from profils where id = 'c0000000-0000-0000-0000-000000000001')
  and (select count(*) from messages_whatsapp where commande_id = :'e6' and modele = 'oranpromo_no_show') = 0
  and (select count(*) from messages_whatsapp where modele = 'oranpromo_compte_bloque' and destinataire = '+213555100001') = 1,
  'point 11 : 5e no-show → compte bloqué, message de blocage');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 3 : le blocage suit le numéro.
-- ---------------------------------------------------------------------------
select pg_temp.compte('c0000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur('update profils set telephone = ''+213555199999'' where id = auth.uid()', '42501', 'bloqué', 'point 3 : un compte bloqué ne change pas de numéro');
-- Un autre compte prend le numéro du compte bloqué. Règle changée par la migration 20261009233000
-- (numéro non vérifié) : il n'est plus bloqué ni ne compte les no-shows de l'autre compte (voir numero_non_verifie.test.sql).
select pg_temp.compte('c0000000-0000-0000-0000-000000000002') \g /dev/null
update profils set telephone = '+213555100001' where id = auth.uid();
select pg_temp.ok(passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]') is not null,
  'point 3 (20261009233000) : un autre compte avec le même numéro n''est pas bloqué');
reset role;
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = 'c0000000-0000-0000-0000-000000000002'), 'point 3 (20261009233000) : no-shows comptés par compte seulement (0 sur le 2e compte)');
set local role authenticated;
-- Admin : annuler un no-show débloque le compte (5 → 4) ; débloquer remet tout à 0.
select pg_temp.compte('a0000000-0000-0000-0000-000000000001') \g /dev/null
select annuler_no_show(:'e6') \g /dev/null
select pg_temp.ok((select no_shows = 4 and not bloque and bloque_le is null from profils where id = 'c0000000-0000-0000-0000-000000000001')
  and (select no_shows = 0 and not bloque from profils where id = 'c0000000-0000-0000-0000-000000000002'),
  'point 11 : annuler un no-show sous 5 débloque le compte');
select debloquer_client('c0000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select bool_and(no_shows = 0 and not bloque) from profils
  where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')),
  'point 11 : débloquer remet le compteur à 0');
select pg_temp.compte('c0000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok(passer_commande('d0000000-0000-0000-0000-000000000001', '[{"article_id":"e0000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]') is not null,
  'point 3 : le 2e compte commande toujours');

-- ---------------------------------------------------------------------------
-- Point 4 (suite) : un nom invalide n'entre jamais dans un message WhatsApp.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.ok((select count(*) from messages_whatsapp where texte ~ '[0-9]{4}|://' and modele <> 'oranpromo_nouvelle_commande') = 0,
  'point 4 : aucun message ne contient de lien ou de numéro venant du nom');

rollback;
\echo 'Tous les tests SQL de la relecture US-20 passent.'

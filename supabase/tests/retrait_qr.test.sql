-- Tests SQL de la migration 20261011110000_retrait_qr.sql (US-26.1 : retrait par QR code).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/retrait_qr.test.sql
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

-- Deux boutiques (A et B), quatre clients ; un article à 20 pièces dans chaque boutique.
insert into auth.users (id, email) values
  ('b2600000-0000-0000-0000-00000000000a', 'boutique26a@test.dz'),
  ('b2600000-0000-0000-0000-00000000000b', 'boutique26b@test.dz'),
  ('c2600000-0000-0000-0000-000000000001', 'client261@test.dz'),
  ('c2600000-0000-0000-0000-000000000002', 'client262@test.dz'),
  ('c2600000-0000-0000-0000-000000000003', 'client263@test.dz'),
  ('c2600000-0000-0000-0000-000000000004', 'client264@test.dz');
insert into boutiques (id, nom, slug, quartier, adresse, whatsapp, statut, ville) values
  ('d2600000-0000-0000-0000-00000000000a', 'Boutique Retrait A', 'boutique-retrait-a', 'Gambetta', '12 rue de Mostaganem', '+213555260001', 'validee', 'oran'),
  ('d2600000-0000-0000-0000-00000000000b', 'Boutique Retrait B', 'boutique-retrait-b', 'Centre', null, '+213555260002', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd2600000-0000-0000-0000-00000000000a' where id = 'b2600000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd2600000-0000-0000-0000-00000000000b' where id = 'b2600000-0000-0000-0000-00000000000b';
update profils set nom = 'Amine Benali', telephone = '+213555261001' where id = 'c2600000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555261002' where id = 'c2600000-0000-0000-0000-000000000002';
update profils set nom = 'Nadia', telephone = '+213555261003' where id = 'c2600000-0000-0000-0000-000000000003';
update profils set nom = 'Sofiane', telephone = '+213555261004' where id = 'c2600000-0000-0000-0000-000000000004';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e2600000-0000-0000-0000-00000000000a', 'd2600000-0000-0000-0000-00000000000a', 'Eau de parfum test', 'Parfums', 3900, 'mixte'),
  ('e2600000-0000-0000-0000-00000000000b', 'd2600000-0000-0000-0000-00000000000b', 'Polo test', 'T-shirts et polos', 2500, 'homme');
insert into tailles (article_id, libelle, disponible) values
  ('e2600000-0000-0000-0000-00000000000a', '50 ml', true), ('e2600000-0000-0000-0000-00000000000b', 'M', true);
update tailles set quantite = 20 where article_id in ('e2600000-0000-0000-0000-00000000000a', 'e2600000-0000-0000-0000-00000000000b');

-- Commande passée par le client, confirmée puis mise « prête » par la boutique.
create function pg_temp.commande_prete(client uuid, boutique uuid, article uuid, taille text, commercant uuid, quantite integer default 1) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande(boutique, format('[{"article_id":"%s","taille":"%s","quantite":%s}]', article, taille, quantite)::jsonb);
  perform pg_temp.compte(commercant);
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;

set local role authenticated;
select pg_temp.commande_prete('c2600000-0000-0000-0000-000000000001', 'd2600000-0000-0000-0000-00000000000a', 'e2600000-0000-0000-0000-00000000000a', '50 ml', 'b2600000-0000-0000-0000-00000000000a', 2) as c1 \gset
select pg_temp.commande_prete('c2600000-0000-0000-0000-000000000002', 'd2600000-0000-0000-0000-00000000000a', 'e2600000-0000-0000-0000-00000000000a', '50 ml', 'b2600000-0000-0000-0000-00000000000a') as c2 \gset
select pg_temp.commande_prete('c2600000-0000-0000-0000-000000000003', 'd2600000-0000-0000-0000-00000000000a', 'e2600000-0000-0000-0000-00000000000a', '50 ml', 'b2600000-0000-0000-0000-00000000000a') as c3 \gset
select pg_temp.commande_prete('c2600000-0000-0000-0000-000000000004', 'd2600000-0000-0000-0000-00000000000a', 'e2600000-0000-0000-0000-00000000000a', '50 ml', 'b2600000-0000-0000-0000-00000000000a') as c4 \gset
select pg_temp.commande_prete('c2600000-0000-0000-0000-000000000001', 'd2600000-0000-0000-0000-00000000000b', 'e2600000-0000-0000-0000-00000000000b', 'M', 'b2600000-0000-0000-0000-00000000000b') as cb \gset
-- Une commande seulement confirmée (pas encore prête).
select pg_temp.compte('c2600000-0000-0000-0000-000000000002') \g /dev/null
select passer_commande('d2600000-0000-0000-0000-00000000000b', '[{"article_id":"e2600000-0000-0000-0000-00000000000b","taille":"M","quantite":1}]'::jsonb) as cd \gset
select pg_temp.compte(null) \g /dev/null
reset role;

select r.jeton as j1, r.code as k1 from prive.retraits r where r.commande_id = :'c1' \gset
select r.jeton as j2, r.code as k2 from prive.retraits r where r.commande_id = :'c2' \gset
select r.jeton as j3 from prive.retraits r where r.commande_id = :'c3' \gset
select r.jeton as j4, r.code as k4 from prive.retraits r where r.commande_id = :'c4' \gset
select r.jeton as jb, r.code as kb from prive.retraits r where r.commande_id = :'cb' \gset

-- ---------------------------------------------------------------------------
-- 1. Jeton et code créés au passage « prête »
-- ---------------------------------------------------------------------------
select pg_temp.ok((select count(*) from prive.retraits where commande_id in (:'c1', :'c2', :'c3', :'c4', :'cb') and actif) = 5,
  'un retrait actif par commande prête');
select pg_temp.ok(not exists (select 1 from prive.retraits where commande_id = :'cd'), 'commande pas encore prête : aucun jeton');
select pg_temp.ok(:'j1' ~ '^[A-Za-z0-9_-]{22}$' and :'k1' ~ '^[0-9]{6}$', 'jeton de 22 caractères base64url (128 bits), code de 6 chiffres (relecture 6 suivi)');
select pg_temp.ok((select count(distinct jeton) from prive.retraits) = (select count(*) from prive.retraits), 'jetons tous différents');
select pg_temp.ok((select count(distinct code) from prive.retraits where boutique_id = 'd2600000-0000-0000-0000-00000000000a' and actif) = 4,
  'codes différents parmi les commandes prêtes d''une boutique');
select pg_temp.ok((select boutique_id from prive.retraits where commande_id = :'cb') = 'd2600000-0000-0000-0000-00000000000b', 'retrait rattaché à la boutique de la commande');
select pg_temp.ok((select count(distinct prive.nouveau_jeton_retrait()) from generate_series(1, 2000)) = 2000
  and (select bool_and(prive.nouveau_jeton_retrait() ~ '^[A-Za-z0-9_-]{22}$') from generate_series(1, 200))
  and (select bool_and(prive.nouveau_code_retrait() ~ '^[0-9]{6}$') from generate_series(1, 200)),
  'générateurs : 2000 jetons distincts, formats corrects');
-- Code déjà pris : la contrainte refuse un doublon actif dans une même boutique.
select pg_temp.erreur(format('insert into prive.retraits (commande_id, boutique_id, jeton, code) values (%L, %L, %L, %L)',
  :'cd', 'd2600000-0000-0000-0000-00000000000a', 'AAAAAAAAAAAAAAAAAAAAAA', :'k1'), '23505', 'retraits_code_actif', 'deux commandes prêtes d''une boutique : même code refusé');

-- ---------------------------------------------------------------------------
-- 2. Invisible pour la boutique et le public ; client seulement
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.erreur('select * from prive.retraits', '42501', 'permission denied', 'boutique : table des retraits illisible');
select pg_temp.ok(not exists (select 1 from retrait_client(:'c1')), 'boutique : retrait_client ne rend rien');
select pg_temp.ok(position(:'j1' in (select row_to_json(c)::text from commandes c where c.id = :'c1')) = 0
  and position(:'j1' in coalesce((select string_agg(row_to_json(s)::text, '') from suivi_commandes s where s.commande_id = :'c1'), '')) = 0,
  'boutique : ni la commande ni le suivi ne contiennent le jeton');
select pg_temp.compte('c2600000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok(not exists (select 1 from retrait_client(:'c1')), 'autre client : rien');
select pg_temp.compte('c2600000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select jeton from retrait_client(:'c1')) = :'j1' and (select code from retrait_client(:'c1')) = :'k1', 'client de la commande : son jeton et son code');
select pg_temp.compte(null) \g /dev/null
reset role;
set local role anon;
select pg_temp.erreur('select * from prive.retraits', '42501', 'permission denied', 'anonyme : table des retraits illisible');
select pg_temp.erreur(format('select retrait_client(%L)', :'c1'), '42501', 'permission denied', 'anonyme : retrait_client refusé');
select pg_temp.erreur(format('select retrait_boutique(%L)', :'j1'), '42501', 'permission denied', 'anonyme : retrait_boutique refusé');
select pg_temp.erreur(format('select remettre_commande(%L)', :'j1'), '42501', 'permission denied', 'anonyme : remettre_commande refusé');

-- ---------------------------------------------------------------------------
-- 3. Page du proche (sans connexion) : articles et montant, jamais le nom ni le téléphone
-- ---------------------------------------------------------------------------
select retrait_par_lien(:'j1') as vue \gset
reset role;
select pg_temp.ok((:'vue'::jsonb)->>'etat' = 'prete' and ((:'vue'::jsonb)->>'total')::int = 7800
  and (:'vue'::jsonb)->'boutique'->>'nom' = 'Boutique Retrait A' and (:'vue'::jsonb)->'boutique'->>'adresse' = '12 rue de Mostaganem'
  and jsonb_array_length((:'vue'::jsonb)->'lignes') = 1 and (:'vue'::jsonb)->'lignes'->0->>'taille' = '50 ml'
  and ((:'vue'::jsonb)->'lignes'->0->>'quantite')::int = 2 and (:'vue'::jsonb)->>'code' = :'k1',
  'page du proche : boutique, articles, total, code');
select pg_temp.ok(position('Amine' in :'vue') = 0 and position('Benali' in :'vue') = 0 and position('+213' in :'vue') = 0
  and position('client' in :'vue') = 0, 'page du proche : ni nom ni téléphone du client');
set local role anon;
select pg_temp.ok(retrait_par_lien('AAAAAAAAAAAAAAAAAAAAAA') is null and retrait_par_lien('pas un jeton') is null and retrait_par_lien(null) is null,
  'page du proche : jeton inconnu ou abîmé → rien');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Boutique : lecture par QR code ou par code, seulement ses commandes
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c2600000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select retrait_boutique(%L)', :'j1'), '42501', 'Connectez-vous', 'client (pas une boutique) : refusé');
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select retrait_boutique(:'j1') as r1 \gset
select pg_temp.ok((:'r1'::jsonb)->>'etat' = 'ok' and ((:'r1'::jsonb)->>'numero')::bigint = (select numero from commandes where id = :'c1')
  and (:'r1'::jsonb)->>'prenom' = 'Amine' and ((:'r1'::jsonb)->>'total')::int = 7800 and jsonb_array_length((:'r1'::jsonb)->'lignes') = 1,
  'QR code : résumé (numéro, prénom seulement, lignes, total)');
select pg_temp.ok(position('Benali' in :'r1') = 0 and position('+213' in :'r1') = 0 and position(:'j1' in :'r1') = 0,
  'résumé : ni nom de famille, ni téléphone, ni jeton');
select pg_temp.ok((select statut from commandes where id = :'c1') = 'prete', 'lire le QR code ne remet rien');
select pg_temp.ok((retrait_boutique(code => :'k2'))->>'etat' = 'ok' and ((retrait_boutique(code => :'k2'))->>'commande')::uuid = :'c2'::uuid,
  'code à 6 chiffres : la bonne commande');
select pg_temp.ok((retrait_boutique(:'jb'))::text = '{"etat": "invalide"}', 'QR code d''une autre boutique : « invalide »');
select pg_temp.ok((retrait_boutique('AAAAAAAAAAAAAAAAAAAAAA'))::text = '{"etat": "invalide"}'
  and (retrait_boutique('https://exemple/x'))::text = '{"etat": "invalide"}', 'QR code inconnu ou abîmé : même réponse');
select pg_temp.compte('b2600000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'invalide' or :'k1' = :'kb', 'boutique B : code d''une commande de A → « invalide »');
select pg_temp.ok((retrait_boutique(:'j1'))::text = '{"etat": "invalide"}', 'boutique B : QR code de A → « invalide »');
select pg_temp.ok((retrait_boutique(code => 'abcd'))::text = '{"etat": "invalide"}' and (retrait_boutique(code => '1234567'))::text = '{"etat": "invalide"}' and (retrait_boutique(code => '1234'))::text = '{"etat": "invalide"}',
  'code mal formé : « invalide »');
select pg_temp.erreur('select retrait_boutique()', '22023', 'QR code ou le code', 'ni QR code ni code : refusé');
select pg_temp.erreur(format('select retrait_boutique(%L, %L)', :'jb', :'kb'), '22023', 'QR code ou le code', 'les deux à la fois : refusé');
-- Relecture n°6 et suivi : 20 codes faux en une heure bloquent la saisie du code (retrait_code_limite.test.sql) ;
-- le QR code n'est jamais limité.
select count(*) from generate_series(1, 16) i, lateral (select retrait_boutique(code => lpad(i::text, 6, '9'))) x \g /dev/null
select pg_temp.ok((retrait_boutique(:'jb'))->>'etat' = 'ok', 'après 20 codes faux : le bon QR code marche');
select pg_temp.compte(null) \g /dev/null
reset role;

-- ---------------------------------------------------------------------------
-- 5. Remise par QR code, par code, sans QR code ; usage unique
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('b2600000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.ok((remettre_commande(:'j1'))::text = '{"etat": "invalide"}', 'boutique B ne peut pas remettre une commande de A');
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select remettre_commande(:'j1') as m1 \gset
select pg_temp.ok((:'m1'::jsonb)->>'etat' = 'remise' and (:'m1'::jsonb)->>'mode_remise' = 'qr', 'QR code : commande remise');
select pg_temp.ok((remettre_commande(:'j1'))->>'etat' = 'deja_remise', 'deuxième scan : « déjà remise » (usage unique)');
select pg_temp.ok((retrait_boutique(:'j1'))->>'etat' = 'deja_remise' and (retrait_boutique(:'j1'))->>'terminee_le' is not null,
  'lecture après remise : « déjà remise » avec la date');
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'invalide' or :'k1' in (:'k2', :'k4'), 'code d''une commande remise : plus valable');
select pg_temp.ok((remettre_commande(code => :'k2'))->>'mode_remise' = 'code', 'code à 6 chiffres : commande remise');
select changer_statut_commande(:'c3', 'recuperee', null, 'Remise sans QR code') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'c1') = 'recuperee' and (select terminee_le from commandes where id = :'c1') is not null
  and (select mode_remise from commandes where id = :'c1') = 'qr', 'base : récupérée, date de fin, mode « qr »');
select pg_temp.ok((select mode_remise from commandes where id = :'c2') = 'code', 'base : mode « code »');
select pg_temp.ok((select mode_remise from commandes where id = :'c3') = 'manuel', 'bouton « Remis sans QR code » : mode « manuel »');
select pg_temp.ok(exists (select 1 from suivi_commandes where commande_id = :'c1' and statut = 'recuperee' and auteur = 'boutique'
  and auteur_id = 'b2600000-0000-0000-0000-00000000000a' and note = 'Remise par QR code')
  and exists (select 1 from suivi_commandes where commande_id = :'c2' and note = 'Remise par code')
  and exists (select 1 from suivi_commandes where commande_id = :'c3' and note = 'Remise sans QR code'),
  'suivi : « Remise par QR code », « Remise par code », « Remise sans QR code »');
select pg_temp.ok(not (select actif from prive.retraits where commande_id = :'c1') and not (select actif from prive.retraits where commande_id = :'c3'),
  'retraits désactivés après la remise (QR code ou bouton)');
select pg_temp.ok((select quantite from tailles where article_id = 'e2600000-0000-0000-0000-00000000000a') = 15, 'stock inchangé par la remise (20 − 5 à la confirmation)');

-- Mode de remise : impossible à poser ou à changer autrement.
update commandes set mode_remise = 'qr' where id = :'c3';
update commandes set mode_remise = 'manuel' where id = :'c1';
select pg_temp.ok((select mode_remise from commandes where id = :'c3') = 'manuel' and (select mode_remise from commandes where id = :'c1') = 'qr',
  'mode de remise : jamais modifiable après coup (même par le service)');
update commandes set statut = 'recuperee', terminee_le = now(), mode_remise = 'qr' where id = :'c4';
select pg_temp.ok((select mode_remise from commandes where id = :'c4') = 'manuel', 'remise sans remettre_commande : toujours « manuel », jamais « qr »');
set local role authenticated;
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.erreur(format('update commandes set mode_remise = %L where id = %L', 'qr', :'c3'), '42501', 'permission denied', 'boutique : aucune écriture directe sur la commande');
select pg_temp.compte(null) \g /dev/null
reset role;
update commandes set mode_remise = 'qr' where id = :'cd';
select pg_temp.ok((select mode_remise from commandes where id = :'cd') is null, 'commande non récupérée : mode impossible à poser');

-- ---------------------------------------------------------------------------
-- 6. Expire avec la commande ; annulée
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c2600000-0000-0000-0000-000000000003') \g /dev/null
select passer_commande('d2600000-0000-0000-0000-00000000000a', '[{"article_id":"e2600000-0000-0000-0000-00000000000a","taille":"50 ml","quantite":1}]'::jsonb) as c5 \gset
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select changer_statut_commande(:'c5', 'confirmee') \g /dev/null
select changer_statut_commande(:'c5', 'prete') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select r.jeton as j5, r.code as k5 from prive.retraits r where r.commande_id = :'c5' \gset
update commandes set expire_le = now() - interval '1 minute' where id = :'c5';
set local role authenticated;
select pg_temp.compte('c2600000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.ok(not exists (select 1 from retrait_client(:'c5')), 'date limite passée : le client ne voit plus le QR code');
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.ok((retrait_boutique(:'j5'))->>'etat' = 'expiree' and (remettre_commande(:'j5'))->>'etat' = 'expiree',
  'date limite passée (avant la tâche d''expiration) : « expirée », rien n''est remis');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'c5') = 'prete' and (select mode_remise from commandes where id = :'c5') is null, 'commande toujours « prête », pas de mode');
select prive.expirer_commandes() \g /dev/null
select pg_temp.ok((select statut from commandes where id = :'c5') = 'expiree' and not (select actif from prive.retraits where commande_id = :'c5'),
  'tâche d''expiration : commande expirée, retrait désactivé');
set local role anon;
select pg_temp.ok((retrait_par_lien(:'j5'))->>'etat' = 'expiree' and (retrait_par_lien(:'j5'))->>'code' is null, 'page du proche : « expirée », plus de code');
reset role;
-- Annulée par la boutique.
set local role authenticated;
select pg_temp.compte('b2600000-0000-0000-0000-00000000000b') \g /dev/null
select changer_statut_commande(:'cb', 'annulee', 'autre') \g /dev/null
select pg_temp.ok((retrait_boutique(:'jb'))->>'etat' = 'annulee' and (remettre_commande(:'jb'))->>'etat' = 'annulee', 'commande annulée : « annulée », rien n''est remis');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'cb') = 'annulee' and (select mode_remise from commandes where id = :'cb') is null, 'annulée : pas de mode de remise');

-- ---------------------------------------------------------------------------
-- 7. Règles inchangées (définitions comparées avant/après la migration dans la PR)
-- ---------------------------------------------------------------------------
-- No-show toujours impossible sur une commande récupérée.
set local role authenticated;
select pg_temp.compte('b2600000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.erreur(format('select declarer_no_show(%L)', :'c1'), '23514', '', 'commande remise par QR code : pas de « client pas venu »');
select pg_temp.compte(null) \g /dev/null
reset role;

rollback;

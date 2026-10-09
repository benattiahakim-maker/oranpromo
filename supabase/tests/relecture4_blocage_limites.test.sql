-- Tests SQL de la migration 20261010130000_relecture4_blocage_limites.sql (relecture n°4, point 1).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/relecture4_blocage_limites.test.sql
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

-- Comptes : admin, deux commerçants, un client bloqué (B), un client à 4 no-shows (Q), deux abuseurs, un vrai client.
insert into auth.users (id, email) values
  ('a4000000-0000-0000-0000-000000000001', 'admin4@test.dz'),
  ('b4000000-0000-0000-0000-000000000001', 'boutique41@test.dz'),
  ('b4000000-0000-0000-0000-000000000002', 'boutique42@test.dz'),
  ('c4000000-0000-0000-0000-000000000001', 'bloque4@test.dz'),
  ('c4000000-0000-0000-0000-000000000002', 'quatre4@test.dz'),
  ('c4000000-0000-0000-0000-000000000003', 'abuseur1@test.dz'),
  ('c4000000-0000-0000-0000-000000000004', 'abuseur2@test.dz'),
  ('c4000000-0000-0000-0000-000000000005', 'vrai4@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d4000000-0000-0000-0000-000000000001', 'Boutique Quatre Un', 'quatre-un', 'Centre', '+213555940001', 'validee'),
  ('d4000000-0000-0000-0000-000000000002', 'Boutique Quatre Deux', 'quatre-deux', 'Centre', '+213555940002', 'validee');
update profils set role = 'admin' where id = 'a4000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd4000000-0000-0000-0000-000000000001' where id = 'b4000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd4000000-0000-0000-0000-000000000002' where id = 'b4000000-0000-0000-0000-000000000002';
update profils set nom = 'Client Bloque', telephone = '+213555400101' where id = 'c4000000-0000-0000-0000-000000000001';
update profils set nom = 'Client Quatre', telephone = '+213555400102' where id = 'c4000000-0000-0000-0000-000000000002';
update profils set nom = 'Abuseur Un', telephone = '+213555400103' where id = 'c4000000-0000-0000-0000-000000000003';
update profils set nom = 'Abuseur Deux', telephone = '+213555400104' where id = 'c4000000-0000-0000-0000-000000000004';
update profils set nom = 'Vrai Client', telephone = '+213555400105' where id = 'c4000000-0000-0000-0000-000000000005';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'Chemise quatre', 'Chemises', 3000, 'homme'),
  ('e4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000002', 'Robe quatre', 'Robes', 6000, 'femme');
insert into tailles (article_id, libelle, disponible) values
  ('e4000000-0000-0000-0000-000000000001', 'L', true), ('e4000000-0000-0000-0000-000000000002', 'M', true);
update tailles set quantite = 100 where article_id in ('e4000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000002');
delete from prive.reglages where cle = 'blocage_par_numero';

-- Commande prête puis non récupérée, déclarée « Client pas venu » par la boutique 1 (vieillie de 2 h).
create function pg_temp.no_show(client uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d4000000-0000-0000-0000-000000000001', '[{"article_id":"e4000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]');
  perform pg_temp.compte('b4000000-0000-0000-0000-000000000001');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  reset role;
  update commandes set expire_le = now() - interval '1 minute', cree_le = now() - interval '2 hours' where id = c;
  set local role authenticated;
  perform pg_temp.compte('b4000000-0000-0000-0000-000000000001');
  perform declarer_no_show(c);
  return c;
end $$;

create function pg_temp.messages_blocage(telephone text) returns bigint language sql as $$
  select count(*) from messages_whatsapp where modele = 'oranpromo_compte_bloque' and destinataire = telephone;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- a. Bloqué à 5 → conteste → reste bloqué, sans message en double.
-- ---------------------------------------------------------------------------
select pg_temp.no_show('c4000000-0000-0000-0000-000000000001') as b1 \gset
select pg_temp.no_show('c4000000-0000-0000-0000-000000000001') as b2 \gset
select pg_temp.no_show('c4000000-0000-0000-0000-000000000001') as b3 \gset
select pg_temp.no_show('c4000000-0000-0000-0000-000000000001') as b4 \gset
select pg_temp.no_show('c4000000-0000-0000-0000-000000000001') as b5 \gset
reset role;
select pg_temp.ok((select no_shows = 5 and bloque and not bloque_par_admin from profils where id = 'c4000000-0000-0000-0000-000000000001')
  and pg_temp.messages_blocage('+213555400101') = 1, 'bloqué automatiquement au 5e no-show, un message « compte bloqué »');
set local role authenticated;
select pg_temp.compte('c4000000-0000-0000-0000-000000000001') \g /dev/null
select contester_no_show(:'b5', 'La boutique était fermée ce jour-là.') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and bloque and bloque_le is not null from profils where id = 'c4000000-0000-0000-0000-000000000001'),
  'déjà bloqué, conteste le 5e : compteur 4 mais reste bloqué (5 avec la contestation en attente)');
select pg_temp.ok(prive.no_shows_avec_contestations('c4000000-0000-0000-0000-000000000001', '+213555400101') = 5
  and prive.no_shows_actifs('c4000000-0000-0000-0000-000000000001', '+213555400101') = 4, 'compteurs : 5 avec contestation, 4 sans');
set local role authenticated;
select pg_temp.compte('c4000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur($$select passer_commande('d4000000-0000-0000-0000-000000000002', '[{"article_id":"e4000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]')$$,
  '42501', 'bloqué', 'contestation en attente : le compte bloqué ne commande toujours pas');
select pg_temp.compte('a4000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'b5') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c4000000-0000-0000-0000-000000000001')
  and pg_temp.messages_blocage('+213555400101') = 1, 'admin valide : 5, toujours bloqué, pas de 2e message « compte bloqué »');

-- Seule une décision de l'admin débloque : contestation en attente + annulation d'un autre no-show → 4 → débloqué.
set local role authenticated;
select pg_temp.compte('a4000000-0000-0000-0000-000000000001') \g /dev/null
select annuler_no_show(:'b1') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and not bloque from profils where id = 'c4000000-0000-0000-0000-000000000001'),
  'admin annule un no-show : 4 en tout, débloqué');
set local role authenticated;
select pg_temp.compte('c4000000-0000-0000-0000-000000000001') \g /dev/null
select contester_no_show(:'b4', 'Je n''ai jamais reçu le message de la boutique.') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 3 and not bloque from profils where id = 'c4000000-0000-0000-0000-000000000001'),
  'non bloqué : une contestation fait toujours baisser le compteur');

-- Une contestation en attente empêche toujours un NOUVEAU blocage.
set local role authenticated;
select pg_temp.no_show('c4000000-0000-0000-0000-000000000002') as q1 \gset
select pg_temp.no_show('c4000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.no_show('c4000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.no_show('c4000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.compte('c4000000-0000-0000-0000-000000000002') \g /dev/null
select contester_no_show(:'q1', 'Commande prête puis no-show tout de suite.') \g /dev/null
select pg_temp.no_show('c4000000-0000-0000-0000-000000000002') as q5 \gset
reset role;
select pg_temp.ok((select no_shows = 4 and not bloque from profils where id = 'c4000000-0000-0000-0000-000000000002')
  and pg_temp.messages_blocage('+213555400102') = 0,
  'pas encore bloqué : 5e no-show avec une contestation en attente → compteur 4, pas de blocage ni de message');
set local role authenticated;
select pg_temp.compte('a4000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'q1') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c4000000-0000-0000-0000-000000000002')
  and pg_temp.messages_blocage('+213555400102') = 1, 'contestation validée : bloqué, un message');

-- ---------------------------------------------------------------------------
-- b. Boutique saturée : 3 commandes par heure et par client dans une boutique ; annulations rapides non comptées.
-- ---------------------------------------------------------------------------
set local role authenticated;
-- Deux clients commandent et annulent en boucle dans la boutique 2.
create function pg_temp.commander_annuler(client uuid) returns void language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d4000000-0000-0000-0000-000000000002', '[{"article_id":"e4000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]');
  perform changer_statut_commande(c, 'annulee');
end $$;
select pg_temp.commander_annuler('c4000000-0000-0000-0000-000000000003'), pg_temp.commander_annuler('c4000000-0000-0000-0000-000000000004') from generate_series(1, 3) \g /dev/null
select pg_temp.erreur($$select pg_temp.commander_annuler('c4000000-0000-0000-0000-000000000003')$$,
  '54000', '3 commandes dans cette boutique', 'un client : 4e commande de l''heure dans la même boutique refusée');
select pg_temp.compte('c4000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.ok(passer_commande('d4000000-0000-0000-0000-000000000001', '[{"article_id":"e4000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') is not null,
  'la limite est par boutique : il commande encore ailleurs');
reset role;
-- La boutique 2 a déjà 14 autres commandes dans l'heure, plus 20 commandes annulées par le client dans les 2 minutes
-- (clients variés, insérées directement) : ces annulations rapides ne comptent pas.
insert into auth.users (id, email)
select ('c4900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'boucle' || i || '@test.dz' from generate_series(1, 40) i;
insert into commandes (client_id, boutique_id, client_nom, client_telephone)
select ('c4900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'd4000000-0000-0000-0000-000000000002', 'Client masse', '+213555400199' from generate_series(1, 13) i;
insert into commandes (client_id, boutique_id, client_nom, client_telephone, statut, motif_annulation, cree_le, terminee_le)
select ('c4900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'd4000000-0000-0000-0000-000000000002', 'Client masse', '+213555400199',
  'annulee', 'client_a_annule', now() - interval '10 minutes', now() - interval '9 minutes' from generate_series(14, 33) i;
select pg_temp.ok((select count(*) from commandes where boutique_id = 'd4000000-0000-0000-0000-000000000002' and cree_le > now() - interval '1 hour') = 39,
  '39 commandes dans l''heure pour la boutique 2, dont 26 annulées par le client dans les 2 minutes');
set local role authenticated;
select pg_temp.compte('c4000000-0000-0000-0000-000000000005') \g /dev/null
select pg_temp.ok(passer_commande('d4000000-0000-0000-0000-000000000002', '[{"article_id":"e4000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]') is not null,
  'les commandes en boucle des abuseurs ne saturent pas la boutique : le vrai client commande (14e commande comptée)');
reset role;
-- Annulation par le client après plus de 2 minutes, ou par la boutique : elle compte.
insert into commandes (client_id, boutique_id, client_nom, client_telephone, statut, motif_annulation, cree_le, terminee_le)
select ('c4900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'd4000000-0000-0000-0000-000000000002', 'Client masse', '+213555400199',
  'annulee', case when i % 2 = 0 then 'client_a_annule' else 'plus_en_stock' end, now() - interval '10 minutes', now() - interval '5 minutes'
from generate_series(34, 39) i;
set local role authenticated;
select pg_temp.compte('c4900000-0000-0000-0000-000000000040') \g /dev/null
update profils set nom = 'Client Quarante', telephone = '+213555400140' where id = auth.uid();
select pg_temp.erreur($$select passer_commande('d4000000-0000-0000-0000-000000000002', '[{"article_id":"e4000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]')$$,
  '54000', 'trop de commandes dans la dernière heure', '20 commandes comptées (annulations tardives ou par la boutique comprises) : la suivante est refusée');

rollback;
\echo 'Tous les tests SQL de la relecture n°4 (point 1) passent.'

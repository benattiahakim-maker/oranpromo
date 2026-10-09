-- Tests SQL de la migration 20261009234500_contestation_no_show.sql (contestation d'un no-show par le client).
-- Depuis 20261009235500_contestation_regles.sql, le motif est dans la table contestations.
-- Même mode d'emploi que corrections_relecture.test.sql :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/contestation_no_show.test.sql
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

-- Comptes : admin, deux commerçants, un fraudeur, une victime, un client de passage.
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'admin@test.dz'),
  ('b1000000-0000-0000-0000-000000000001', 'boutique1@test.dz'),
  ('b1000000-0000-0000-0000-000000000002', 'boutique2@test.dz'),
  ('c1000000-0000-0000-0000-000000000001', 'fraudeur@test.dz'),
  ('c1000000-0000-0000-0000-000000000002', 'victime@test.dz'),
  ('c1000000-0000-0000-0000-000000000003', 'passage@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d1000000-0000-0000-0000-000000000001', 'Boutique Essai Un', 'essai-un', 'Centre', '+213555910001', 'validee'),
  ('d1000000-0000-0000-0000-000000000002', 'Boutique Essai Deux', 'essai-deux', 'Centre', '+213555910002', 'validee');
update profils set role = 'admin' where id = 'a1000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd1000000-0000-0000-0000-000000000001' where id = 'b1000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd1000000-0000-0000-0000-000000000002' where id = 'b1000000-0000-0000-0000-000000000002';
update profils set nom = 'Victime', telephone = '+213555200002' where id = 'c1000000-0000-0000-0000-000000000002';
-- Le fraudeur met le numéro de la victime sur son compte (le numéro n'est pas vérifié).
update profils set nom = 'Fraudeur', telephone = '+213555200002' where id = 'c1000000-0000-0000-0000-000000000001';
update profils set nom = 'Passage', telephone = '+213555200003' where id = 'c1000000-0000-0000-0000-000000000003';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Chemise essai', 'Chemises', 3000, 'homme'),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'Robe essai', 'Robes', 6000, 'femme');
insert into tailles (article_id, libelle, disponible) values
  ('e1000000-0000-0000-0000-000000000001', 'L', true), ('e1000000-0000-0000-0000-000000000002', 'M', true);
update tailles set quantite = 100 where article_id in ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002');
delete from prive.reglages where cle = 'blocage_par_numero';

-- Commande prête puis non récupérée, déclarée « Client pas venu » par la boutique 1.
create function pg_temp.no_show(client uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d1000000-0000-0000-0000-000000000001', '[{"article_id":"e1000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]');
  perform pg_temp.compte('b1000000-0000-0000-0000-000000000001');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  reset role;
  -- Commande vieillie de 2 h : la limite de 3 commandes par heure et par boutique (relecture n°4) ne gêne pas.
  update commandes set expire_le = now() - interval '1 minute', cree_le = now() - interval '2 hours' where id = c;
  set local role authenticated;
  perform pg_temp.compte('b1000000-0000-0000-0000-000000000001');
  perform declarer_no_show(c);
  return c;
end $$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Contester : seulement le compte de la commande, une fois, avec un motif court.
-- ---------------------------------------------------------------------------
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n1 \gset
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''Je suis venue samedi'')', :'n1'), 'P0002', 'introuvable', 'un autre client ne conteste pas');
select pg_temp.compte('b1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''Je suis venue samedi'')', :'n1'), 'P0002', 'introuvable', 'la boutique ne conteste pas');
select pg_temp.compte(null) \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''Je suis venue samedi'')', :'n1'), '42501', 'Connectez-vous', 'sans compte : refus');
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''  ok  '')', :'n1'), '23514', '5 à 300', 'motif trop court refusé');
select pg_temp.erreur(format('select contester_no_show(%L, %L)', :'n1', repeat('a', 301)), '23514', '5 à 300', 'motif trop long refusé');
select pg_temp.erreur(format('select contester_no_show(%L, null)', :'n1'), '23514', '5 à 300', 'motif absent refusé');
select pg_temp.ok((select no_shows from profils where id = auth.uid()) = 1, 'avant contestation : 1 no-show');
select contester_no_show(:'n1', '  Je suis venue   samedi, la boutique était fermée  ') \g /dev/null
select pg_temp.ok((select motif from contestations where commande_id = :'n1') = 'Je suis venue samedi, la boutique était fermée',
  'le motif est enregistré (espaces nettoyés), lisible par le client');
select pg_temp.ok((select no_shows from profils where id = auth.uid()) = 0, 'contestation en attente : le no-show ne compte plus (1 → 0)');
select pg_temp.erreur(format('select contester_no_show(%L, ''Encore une fois'')', :'n1'), '23514', 'déjà contesté', 'une seule contestation par no-show');
reset role;
select pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and tablename = 'commandes' and cmd <> 'SELECT') = 0,
  'aucune politique d''écriture sur commandes : la contestation passe seulement par contester_no_show');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
update profils set bloque_par_admin = true, no_shows = 9 where id = auth.uid();
select pg_temp.ok((select not bloque_par_admin and no_shows = 0 from profils where id = auth.uid()), 'le client ne modifie ni bloque_par_admin ni no_shows');

-- ---------------------------------------------------------------------------
-- Admin : valider (le no-show compte de nouveau) ; seul l'admin valide.
-- ---------------------------------------------------------------------------
select pg_temp.compte('b1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select valider_no_show(%L)', :'n1'), '42501', 'administrateurs', 'la boutique ne valide pas une contestation');
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'n1') \g /dev/null
select pg_temp.ok((select no_shows from profils where id = 'c1000000-0000-0000-0000-000000000002') = 1, 'contestation rejetée : le no-show compte de nouveau (0 → 1)');
select pg_temp.erreur(format('select valider_no_show(%L)', :'n1'), 'P0002', 'Aucune contestation', 'on ne valide pas deux fois');
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''Je réessaie encore'')', :'n1'), '23514', 'déjà contesté', 'après validation, pas de nouvelle contestation');

-- ---------------------------------------------------------------------------
-- 5 no-shows → bloqué ; contester le 5e NE débloque PAS (relecture n°4) ; valider : toujours bloqué, sans nouveau
-- message ; annuler (décision de l'admin) débloque.
-- ---------------------------------------------------------------------------
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n2 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n3 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n4 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n5 \gset
reset role;
select pg_temp.ok((select no_shows = 5 and bloque and not bloque_par_admin from profils where id = 'c1000000-0000-0000-0000-000000000002'), '5e no-show : bloqué automatiquement');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select contester_no_show(:'n5', 'Commande prête puis no-show tout de suite') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and bloque and bloque_le is not null and not bloque_par_admin from profils where id = 'c1000000-0000-0000-0000-000000000002'),
  'relecture n°4 : un compte déjà bloqué conteste : compteur 4, mais toujours bloqué (5 avec la contestation)');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur($$select passer_commande('d1000000-0000-0000-0000-000000000002', '[{"article_id":"e1000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]')$$,
  '42501', 'bloqué', 'relecture n°4 : contester ne permet pas de commander de nouveau');
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'n5') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c1000000-0000-0000-0000-000000000002')
  and (select count(*) from messages_whatsapp where modele = 'oranpromo_compte_bloque' and destinataire = '+213555200002') = 1,
  'relecture n°4 : admin valide : 5, toujours bloqué, un seul message « compte bloqué » (pas de doublon)');
select pg_temp.ok((select count(*) from messages_whatsapp where texte ilike '%contest%') = 0, 'aucun nouveau message WhatsApp pour la contestation');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select contester_no_show(:'n4', 'La boutique ne m''a jamais appelée') \g /dev/null
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select annuler_no_show(:'n4') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and not bloque from profils where id = 'c1000000-0000-0000-0000-000000000002')
  and (select no_show_annule_le is not null from commandes where id = :'n4'),
  'admin annule le no-show contesté (annuler_no_show) : 4, débloqué');
set local role authenticated;
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select valider_no_show(%L)', :'n4'), 'P0002', 'Aucune contestation', 'un no-show annulé ne se valide plus');
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''Encore une fois'')', :'n4'), 'P0002', 'Aucun no-show', 'un no-show annulé ne se conteste pas');

-- ---------------------------------------------------------------------------
-- Un blocage décidé par l'admin n'est jamais levé par une contestation.
-- ---------------------------------------------------------------------------
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select bloquer_client('c1000000-0000-0000-0000-000000000002') \g /dev/null
reset role;
select pg_temp.ok((select bloque and bloque_par_admin and no_shows = 4 from profils where id = 'c1000000-0000-0000-0000-000000000002'), 'admin bloque à la main (bloque_par_admin)');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select contester_no_show(:'n3', 'Je conteste aussi celui-ci') \g /dev/null
reset role;
select pg_temp.ok((select bloque and bloque_par_admin and no_shows = 3 from profils where id = 'c1000000-0000-0000-0000-000000000002'),
  'contestation en attente sur un compte bloqué par l''admin : compteur 3, toujours bloqué');
set local role authenticated;
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select debloquer_client('c1000000-0000-0000-0000-000000000002') \g /dev/null
reset role;
select pg_temp.ok((select not bloque and not bloque_par_admin and no_shows = 0 from profils where id = 'c1000000-0000-0000-0000-000000000002'),
  'Débloquer lève le blocage de l''admin et remet à 0');
select pg_temp.ok((select count(*) from messages_whatsapp where modele = 'oranpromo_compte_bloque' and destinataire = '+213555200002') = 1,
  'le blocage par l''admin n''envoie pas de message (toujours un seul message « compte bloqué »)');

rollback;
\echo 'Tous les tests SQL de la contestation des no-shows passent.'

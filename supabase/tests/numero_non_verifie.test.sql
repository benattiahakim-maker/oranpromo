-- Tests SQL de la migration 20261009233000_numero_non_verifie.sql (relecture n°2 US-20).
-- Même mode d'emploi que corrections_relecture.test.sql :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/numero_non_verifie.test.sql
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
-- Point 1 : 5 no-shows avec le numéro d'une victime ne bloquent que le compte qui les a faits.
-- ---------------------------------------------------------------------------
select pg_temp.no_show('c1000000-0000-0000-0000-000000000001') as n1 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000001') as n2 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000001') as n3 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000001') as n4 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000001') as n5 \gset
reset role;
select pg_temp.ok(prive.blocage_par_numero() = false, 'point 1 : blocage par numéro désactivé par défaut (V2 SMS)');
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c1000000-0000-0000-0000-000000000001'),
  'point 1 : le compte qui a fait les 5 no-shows est bloqué');
select pg_temp.ok((select no_shows = 0 and not bloque and bloque_le is null from profils where id = 'c1000000-0000-0000-0000-000000000002'),
  'point 1 : la victime (même numéro, autre compte) n''est ni bloquée ni comptée');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok((select no_shows from profils where id = auth.uid()) = 0,
  'point 1 : /compte de la victime ne montre pas les no-shows de l''autre compte');
select passer_commande('d1000000-0000-0000-0000-000000000001', '[{"article_id":"e1000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') as v1 \gset
select pg_temp.ok(:'v1' is not null, 'point 1 : la victime commande toujours');
select pg_temp.compte('c1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur('select passer_commande(''d1000000-0000-0000-0000-000000000001'', ''[{"article_id":"e1000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]'')',
  '42501', 'bloqué', 'point 1 : le compte bloqué ne commande plus');
-- Un nouveau compte qui prend le numéro n'est pas bloqué non plus.
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
update profils set telephone = '+213555200002' where id = auth.uid();
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = auth.uid()),
  'point 1 : changer pour un numéro avec des no-shows ne bloque pas');

-- ---------------------------------------------------------------------------
-- Point 1 : l'admin bloque à la main (la section « numéro partagé » a disparu avec US-21.3).
-- ---------------------------------------------------------------------------
select pg_temp.erreur('select bloquer_client(''c1000000-0000-0000-0000-000000000002'')', '42501', 'administrateurs', 'point 1 : seul l''admin bloque un compte');
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select bloquer_client('c1000000-0000-0000-0000-000000000003') \g /dev/null
reset role;
select pg_temp.ok((select bloque and bloque_le is not null and no_shows = 0 from profils where id = 'c1000000-0000-0000-0000-000000000003'),
  'point 1 : l''admin bloque un compte du numéro partagé');
select pg_temp.ok((select count(*) from messages_whatsapp where modele = 'oranpromo_compte_bloque' and destinataire = '+213555200002') = 1,
  'point 1 : blocage par l''admin : aucun message « 5 commandes non récupérées » envoyé au numéro (seul celui du fraudeur)');
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur('select passer_commande(''d1000000-0000-0000-0000-000000000001'', ''[{"article_id":"e1000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]'')',
  '42501', 'bloqué', 'point 1 : le compte bloqué par l''admin ne commande plus');
-- Un recalcul (annulation d'un no-show du fraudeur) ne lève pas le blocage décidé par l'admin.
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select annuler_no_show(:'n5') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and not bloque from profils where id = 'c1000000-0000-0000-0000-000000000001')
  and (select bloque from profils where id = 'c1000000-0000-0000-0000-000000000003'),
  'point 1 : annuler un no-show débloque le fraudeur (4) sans lever le blocage de l''admin');
set local role authenticated;
-- Débloquer un compte n'annule que ses propres no-shows.
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select debloquer_client('c1000000-0000-0000-0000-000000000003') \g /dev/null
reset role;
select pg_temp.ok((select not bloque and no_shows = 0 from profils where id = 'c1000000-0000-0000-0000-000000000003')
  and (select no_shows from profils where id = 'c1000000-0000-0000-0000-000000000001') = 4,
  'point 1 : débloquer un compte ne touche pas aux no-shows d''un autre compte du même numéro');

-- ---------------------------------------------------------------------------
-- Point 1 : blocage par numéro (US-21.3) seulement sur des numéros vérifiés : ici, numéros saisis à la main.
-- ---------------------------------------------------------------------------
insert into prive.reglages (cle, valeur) values ('blocage_par_numero', 'on');
select pg_temp.ok(prive.no_shows_actifs('c1000000-0000-0000-0000-000000000002', '+213555200002') = 0,
  'point 1 (US-21.3) : réglage activé, numéro non vérifié → les no-shows d''un autre compte ne comptent pas');
delete from prive.reglages where cle = 'blocage_par_numero';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Point 2 : au plus 20 nouvelles commandes par boutique et par heure, tous clients confondus.
-- ---------------------------------------------------------------------------
reset role;
-- 19 commandes dans l'heure pour la boutique 2 (19 clients différents : relecture n°4, 3 par client et par
-- boutique au plus), et 5 plus anciennes qui ne comptent pas.
insert into auth.users (id, email)
select ('c9000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'masse' || i || '@test.dz' from generate_series(1, 24) i;
insert into commandes (client_id, boutique_id, client_nom, client_telephone)
select ('c9000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'd1000000-0000-0000-0000-000000000002', 'Client masse', '+213555200002' from generate_series(1, 19) i;
insert into commandes (client_id, boutique_id, client_nom, client_telephone, cree_le)
select ('c9000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'd1000000-0000-0000-0000-000000000002', 'Client masse', '+213555200002', now() - interval '61 minutes' from generate_series(20, 24) i;
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok(passer_commande('d1000000-0000-0000-0000-000000000002', '[{"article_id":"e1000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]') is not null,
  'point 2 : la 20e commande de l''heure passe (les plus anciennes ne comptent pas)');
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur('select passer_commande(''d1000000-0000-0000-0000-000000000002'', ''[{"article_id":"e1000000-0000-0000-0000-000000000002","taille":"M","quantite":1}]'')',
  '54000', 'trop de commandes dans la dernière heure', 'point 2 : la 21e commande de l''heure est refusée, même pour un autre client');
select pg_temp.ok(passer_commande('d1000000-0000-0000-0000-000000000001', '[{"article_id":"e1000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') is not null,
  'point 2 : les autres boutiques ne sont pas concernées');
reset role;
select pg_temp.erreur('insert into commandes (client_id, boutique_id, client_nom, client_telephone) values (''c1000000-0000-0000-0000-000000000001'', ''d1000000-0000-0000-0000-000000000002'', ''Fraudeur'', ''+213555200002'')',
  '54000', 'trop de commandes', 'point 2 : la limite s''applique à toute insertion (déclencheur)');
select pg_temp.ok((select count(*) from messages_whatsapp m join commandes c on c.id = m.commande_id
  where c.boutique_id = 'd1000000-0000-0000-0000-000000000002' and m.modele = 'oranpromo_nouvelle_commande') <= 20,
  'point 2 : au plus 20 messages « nouvelle commande » par heure pour la boutique');

rollback;
\echo 'Tous les tests SQL de la relecture n°2 US-20 passent.'

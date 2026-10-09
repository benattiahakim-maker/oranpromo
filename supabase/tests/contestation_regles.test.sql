-- Tests SQL de la migration 20261009235500_contestation_regles.sql (délai de 7 jours, une contestation à la fois,
-- motif invisible pour la boutique).
-- Même mode d'emploi que corrections_relecture.test.sql :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/contestation_regles.test.sql
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
  update commandes set expire_le = now() - interval '1 minute' where id = c;
  set local role authenticated;
  perform pg_temp.compte('b1000000-0000-0000-0000-000000000001');
  perform declarer_no_show(c);
  return c;
end $$;

set local role authenticated;

select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n1 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n2 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000002') as n3 \gset
select pg_temp.no_show('c1000000-0000-0000-0000-000000000003') as p1 \gset

-- ---------------------------------------------------------------------------
-- Point 1 : 7 jours pour contester.
-- ---------------------------------------------------------------------------
reset role;
update commandes set no_show_le = now() - interval '7 days 1 minute' where id = :'n3';
update commandes set no_show_le = now() - interval '6 days 23 hours' where id = :'n2';
set local role authenticated;
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select contester_no_show(%L, ''La boutique était fermée'')', :'n3'), '23514', 'délai pour contester est dépassé',
  'point 1 : plus de 7 jours après la déclaration, contestation refusée');
select contester_no_show(:'n2', 'La boutique était fermée') \g /dev/null
select pg_temp.ok((select contestee_le is not null from commandes where id = :'n2'), 'point 1 : 6 jours et 23 h après, contestation acceptée');

-- ---------------------------------------------------------------------------
-- Point 2 : une seule contestation en attente à la fois par compte.
-- ---------------------------------------------------------------------------
select pg_temp.erreur(format('select contester_no_show(%L, ''Autre erreur de la boutique'')', :'n1'), '23514', 'déjà une contestation en attente',
  'point 2 : une 2e contestation en attente est refusée');
-- Un autre client n'est pas gêné par la contestation du premier.
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
select contester_no_show(:'p1', 'Je suis passé, c''était fermé') \g /dev/null
select pg_temp.ok((select contestee_le is not null from commandes where id = :'p1'), 'point 2 : la limite est par compte');
-- Une fois la première traitée (validée), le client peut en contester une autre.
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'n2') \g /dev/null
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select contester_no_show(:'n1', 'Autre erreur de la boutique') \g /dev/null
select pg_temp.ok((select contestee_le is not null from commandes where id = :'n1'), 'point 2 : après validation de la 1re, une nouvelle contestation est possible');

-- ---------------------------------------------------------------------------
-- Point 3 : le motif est lisible par l'admin et par son auteur, jamais par la boutique.
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'commandes' and column_name = 'contestation_motif'),
  'point 3 : plus de motif dans commandes (lue en entier par la boutique)');
set local role authenticated;
select pg_temp.compte('b1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select count(*) from commandes where id in (:'n1', :'n2', :'p1')) = 3, 'point 3 : la boutique lit toujours ses commandes');
select pg_temp.ok((select contestee_le is not null from commandes where id = :'n1'), 'point 3 : la boutique voit qu''une commande est contestée');
select pg_temp.ok((select count(*) from contestations) = 0, 'point 3 : la boutique ne lit aucun motif');
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok((select array_agg(motif order by motif) from contestations) = array['Autre erreur de la boutique', 'La boutique était fermée'],
  'point 3 : le client lit ses propres motifs seulement');
select pg_temp.compte('c1000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.ok((select count(*) from contestations) = 1, 'point 3 : un autre client ne lit que le sien');
select pg_temp.compte('a1000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select count(*) from contestations where commande_id in (:'n1', :'n2', :'p1')) = 3, 'point 3 : l''admin lit tous les motifs');
select pg_temp.compte('c1000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('insert into contestations (commande_id, client_id, motif) values (%L, auth.uid(), ''Je triche un peu'')', :'n3'), '42501', 'permission denied',
  'point 3 : le client n''écrit pas directement dans contestations');
select pg_temp.erreur(format('update contestations set motif = ''Motif changé'' where commande_id = %L', :'n1'), '42501', 'permission denied',
  'point 3 : le client ne modifie pas son motif après coup');

rollback;
\echo 'Tous les tests SQL des règles de contestation passent.'

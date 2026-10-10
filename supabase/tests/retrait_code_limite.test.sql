-- Tests SQL de la migration 20261015100000_retrait_code_limite_bons_qr.sql (relecture n°6, point 2 a) :
-- après 10 codes faux en 15 minutes, la saisie du code à 4 chiffres est refusée 15 minutes ; le QR code marche toujours.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/retrait_code_limite.test.sql
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

-- Deux boutiques (A et B), deux clients ; un article à 20 pièces dans chaque boutique.
insert into auth.users (id, email) values
  ('b2650000-0000-0000-0000-00000000000a', 'boutique265a@test.dz'),
  ('b2650000-0000-0000-0000-00000000000b', 'boutique265b@test.dz'),
  ('c2650000-0000-0000-0000-000000000001', 'client2651@test.dz'),
  ('c2650000-0000-0000-0000-000000000002', 'client2652@test.dz');
insert into boutiques (id, nom, slug, quartier, adresse, whatsapp, statut, ville) values
  ('d2650000-0000-0000-0000-00000000000a', 'Boutique Limite A', 'boutique-limite-a', 'Gambetta', null, '+213555265001', 'validee', 'oran'),
  ('d2650000-0000-0000-0000-00000000000b', 'Boutique Limite B', 'boutique-limite-b', 'Centre', null, '+213555265002', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd2650000-0000-0000-0000-00000000000a' where id = 'b2650000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd2650000-0000-0000-0000-00000000000b' where id = 'b2650000-0000-0000-0000-00000000000b';
update profils set nom = 'Amine', telephone = '+213555265101' where id = 'c2650000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555265102' where id = 'c2650000-0000-0000-0000-000000000002';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e2650000-0000-0000-0000-00000000000a', 'd2650000-0000-0000-0000-00000000000a', 'Eau de parfum test', 'Parfums', 3900, 'mixte'),
  ('e2650000-0000-0000-0000-00000000000b', 'd2650000-0000-0000-0000-00000000000b', 'Polo test', 'T-shirts et polos', 2500, 'homme');
insert into tailles (article_id, libelle, disponible) values
  ('e2650000-0000-0000-0000-00000000000a', '50 ml', true), ('e2650000-0000-0000-0000-00000000000b', 'M', true);
update tailles set quantite = 20 where article_id in ('e2650000-0000-0000-0000-00000000000a', 'e2650000-0000-0000-0000-00000000000b');

create function pg_temp.commande_prete(client uuid, boutique uuid, article uuid, taille text, commercant uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande(boutique, format('[{"article_id":"%s","taille":"%s","quantite":1}]', article, taille)::jsonb);
  perform pg_temp.compte(commercant);
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;

\set A b2650000-0000-0000-0000-00000000000a
\set B b2650000-0000-0000-0000-00000000000b
set local role authenticated;
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000001', 'd2650000-0000-0000-0000-00000000000a', 'e2650000-0000-0000-0000-00000000000a', '50 ml', :'A') as c1 \gset
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000002', 'd2650000-0000-0000-0000-00000000000a', 'e2650000-0000-0000-0000-00000000000a', '50 ml', :'A') as c2 \gset
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000001', 'd2650000-0000-0000-0000-00000000000a', 'e2650000-0000-0000-0000-00000000000a', '50 ml', :'A') as c3 \gset
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000002', 'd2650000-0000-0000-0000-00000000000b', 'e2650000-0000-0000-0000-00000000000b', 'M', :'B') as cb \gset
reset role;
select r.jeton as j1, r.code as k1 from prive.retraits r where r.commande_id = :'c1' \gset
select r.jeton as j2 from prive.retraits r where r.commande_id = :'c2' \gset
select r.code as k3 from prive.retraits r where r.commande_id = :'c3' \gset
select r.code as kb from prive.retraits r where r.commande_id = :'cb' \gset
-- Codes faux pour la boutique A (aucune de ses commandes prêtes ne les a).
create temp table faux as
  select row_number() over () as n, k from (select lpad(i::text, 4, '0') as k from generate_series(0, 9999) i
    where lpad(i::text, 4, '0') not in (select code from prive.retraits where actif) order by i limit 40) x;
grant select on faux to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Boutique A : 9 codes faux (lecture et remise mêlées), le bon code marche encore
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((select bool_and((retrait_boutique(code => k))->>'etat' = 'invalide') from faux where n between 1 and 5),
  '5 codes faux en lecture : « invalide »');
select pg_temp.ok((select bool_and((remettre_commande(code => k))->>'etat' = 'invalide') from faux where n between 6 and 8),
  '3 codes faux en remise : « invalide »');
select pg_temp.ok((retrait_boutique(code => '12ab'))->>'etat' = 'invalide', 'code mal formé : compté comme un essai faux (9e)');
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'ok', 'après 9 codes faux : le bon code marche encore');
select pg_temp.ok((remettre_commande(code => (select k from faux where n = 9)))->>'etat' = 'invalide', '10e code faux : encore « invalide »');

-- ---------------------------------------------------------------------------
-- 2. 11e essai : refusé, même avec le bon code, en lecture comme en remise
-- ---------------------------------------------------------------------------
select pg_temp.erreur(format('select retrait_boutique(code => %L)', (select k from faux where n = 10)), '54000', 'Trop de codes faux',
  '11e essai (code faux) : refusé');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', :'k1'), '54000', 'bloquée 15 minutes', 'bloqué : le bon code est refusé en lecture');
select pg_temp.erreur(format('select remettre_commande(code => %L)', :'k1'), '54000', 'Scannez le QR code', 'bloqué : le bon code est refusé en remise');
-- QR code : pas concerné. Compte de la boutique : pas bloqué.
select pg_temp.ok((retrait_boutique(:'j1'))->>'etat' = 'ok', 'bloqué : le QR code se lit toujours');
select pg_temp.ok((remettre_commande(:'j2'))->>'etat' = 'remise' and (remettre_commande(:'j2'))->>'etat' = 'deja_remise', 'bloqué : remise par QR code possible');
select pg_temp.ok((select count(*) from commandes where boutique_id = 'd2650000-0000-0000-0000-00000000000a') = 3, 'bloqué : la boutique lit toujours ses commandes');
-- Boutique B : pas concernée.
select pg_temp.compte(:'B') \g /dev/null
select pg_temp.ok((retrait_boutique(code => :'kb'))->>'etat' = 'ok', 'autre boutique : son code marche');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'c1') = 'prete' and (select mode_remise from commandes where id = :'c2') = 'qr',
  'base : rien de remis par code pendant le blocage, remise QR enregistrée');
select pg_temp.ok((select jusqu_a between now() + interval '14 minutes 59 seconds' and now() + interval '15 minutes'
  from prive.blocages_code_retrait where boutique_id = 'd2650000-0000-0000-0000-00000000000a'), 'blocage de 15 minutes enregistré');
select pg_temp.ok(not exists (select 1 from prive.blocages_code_retrait where boutique_id = 'd2650000-0000-0000-0000-00000000000b'),
  'aucun blocage pour la boutique B');
select pg_temp.ok((select bloque from profils where id = :'A') = false, 'le compte du commerçant n''est pas bloqué');

-- ---------------------------------------------------------------------------
-- 3. 15 minutes plus tard : le code marche de nouveau
-- ---------------------------------------------------------------------------
update prive.blocages_code_retrait set jusqu_a = now() - interval '1 second' where boutique_id = 'd2650000-0000-0000-0000-00000000000a';
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((remettre_commande(code => :'k1'))->>'mode_remise' = 'code', 'après 15 minutes : remise par code de nouveau possible');
select pg_temp.ok((select bool_and((retrait_boutique(code => k))->>'etat' = 'invalide') from faux where n between 11 and 19),
  'après le blocage : 9 nouveaux codes faux acceptés comme essais');
select pg_temp.ok((retrait_boutique(code => :'k3'))->>'etat' = 'ok', 'compteur remis à zéro après le blocage : le bon code marche');
select pg_temp.compte(null) \g /dev/null
reset role;

-- ---------------------------------------------------------------------------
-- 4. Fenêtre de 15 minutes : les essais plus anciens ne comptent pas
-- ---------------------------------------------------------------------------
update prive.essais_code_retrait set le = now() - interval '16 minutes' where boutique_id = 'd2650000-0000-0000-0000-00000000000a';
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((retrait_boutique(code => (select k from faux where n = 20)))->>'etat' = 'invalide', 'essai faux après 16 minutes : « invalide »');
select pg_temp.ok((retrait_boutique(code => :'k3'))->>'etat' = 'ok', 'les 9 essais de plus de 15 minutes ne comptent plus : pas de blocage');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select count(*) from prive.essais_code_retrait where boutique_id = 'd2650000-0000-0000-0000-00000000000a') = 1,
  'essais de plus de 15 minutes effacés');

-- ---------------------------------------------------------------------------
-- 5. Tables invisibles pour l'API
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.erreur('select * from prive.essais_code_retrait', '42501', 'permission denied', 'boutique : essais illisibles');
select pg_temp.erreur('select * from prive.blocages_code_retrait', '42501', 'permission denied', 'boutique : blocages illisibles');
select pg_temp.erreur('delete from prive.blocages_code_retrait', '42501', 'permission denied', 'boutique : ne peut pas lever son blocage');
select pg_temp.compte(null) \g /dev/null
reset role;

rollback;

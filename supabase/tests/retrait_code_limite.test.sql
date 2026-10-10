-- Tests SQL des limites du code de retrait : migrations 20261015100000_retrait_code_limite_bons_qr.sql (relecture n°6, point 2 a)
-- et 20261015120000_code_retrait_6_chiffres.sql (suivi de la relecture n°6) :
--   code à 6 chiffres (codes existants régénérés) ; refus en lecture seule (25006) ; 5 codes faux à une faute de frappe près
--   d'une commande → code de cette commande refusé 15 minutes ; 20 codes faux en une heure par boutique → saisie du code refusée ;
--   le QR code et « Remis sans QR code » marchent toujours.
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
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000002', 'd2650000-0000-0000-0000-00000000000a', 'e2650000-0000-0000-0000-00000000000a', '50 ml', :'A') as c4 \gset
select pg_temp.commande_prete('c2650000-0000-0000-0000-000000000002', 'd2650000-0000-0000-0000-00000000000b', 'e2650000-0000-0000-0000-00000000000b', 'M', :'B') as cb \gset
reset role;
select r.jeton as j1, r.code as k1 from prive.retraits r where r.commande_id = :'c1' \gset
select r.jeton as j2, r.code as k2 from prive.retraits r where r.commande_id = :'c2' \gset
select r.code as k3 from prive.retraits r where r.commande_id = :'c3' \gset
select r.code as k4 from prive.retraits r where r.commande_id = :'c4' \gset
select r.code as kb from prive.retraits r where r.commande_id = :'cb' \gset
\set BA d2650000-0000-0000-0000-00000000000a
-- Codes faux « loin » : ni égaux ni à une faute de frappe près d'un code actif de la boutique A.
create temp table faux as
  select row_number() over () as n, k from (select lpad((i * 7919 % 1000000)::text, 6, '0') as k from generate_series(1, 400) i) x
  where not exists (select 1 from prive.retraits r where r.boutique_id = :'BA' and r.actif and (r.code = x.k or prive.codes_proches(r.code, x.k)))
  limit 40;
-- Codes faux « proches » de k1 : un chiffre changé (positions 1 à 4, puis 6) et, en 5e, deux chiffres voisins inversés.
create temp table proches as
  select p as n, overlay(:'k1' placing ((substr(:'k1', p, 1)::integer + 1) % 10)::text from p for 1) as k from generate_series(1, 4) p
  union all
  select 5, coalesce((select substr(:'k1', 1, i - 1) || substr(:'k1', i + 1, 1) || substr(:'k1', i, 1) || substr(:'k1', i + 2)
                      from generate_series(1, 5) i where substr(:'k1', i, 1) <> substr(:'k1', i + 1, 1) order by i limit 1),
                     overlay(:'k1' placing ((substr(:'k1', 5, 1)::integer + 1) % 10)::text from 5 for 1))
  union all
  select 6, overlay(:'k1' placing ((substr(:'k1', 6, 1)::integer + 1) % 10)::text from 6 for 1);
grant select on faux, proches to authenticated;
select pg_temp.ok((select count(*) from faux) = 40, '40 codes faux loin des codes actifs');
select pg_temp.ok((select count(distinct k) from proches) = 6 and (select bool_and(prive.codes_proches(:'k1', k)) from proches)
  and not exists (select 1 from proches p join prive.retraits r on r.code = p.k and r.boutique_id = :'BA' and r.actif),
  '6 codes proches de k1, aucun n''est le code d''une commande');

-- ---------------------------------------------------------------------------
-- 1. Code à 6 chiffres (point 1)
-- ---------------------------------------------------------------------------
select pg_temp.ok(:'k1' ~ '^[0-9]{6}$' and :'k2' ~ '^[0-9]{6}$' and :'kb' ~ '^[0-9]{6}$', 'commande prête : code de 6 chiffres');
select pg_temp.ok(not exists (select 1 from prive.retraits where code !~ '^[0-9]{6}$'), 'base : aucun code qui n''a pas 6 chiffres');
select pg_temp.ok((select bool_and(prive.nouveau_code_retrait() ~ '^[0-9]{6}$') from generate_series(1, 500))
  and (select count(distinct prive.nouveau_code_retrait()) from generate_series(1, 500)) > 480, 'générateur : 6 chiffres, presque tous différents');
select pg_temp.erreur(format('update prive.retraits set code = %L where commande_id = %L', '1234', :'c1'), '23514', 'retraits_code_check',
  'base : un code à 4 chiffres est refusé');
-- Migration : les codes à 4 chiffres existants sont régénérés en 6 chiffres, uniques parmi les commandes prêtes de la boutique.
savepoint migration;
alter table prive.retraits drop constraint retraits_code_check;
update prive.retraits set code = '1234' where commande_id = :'c1';
update prive.retraits set code = '5678' where commande_id = :'c2';
update prive.retraits set code = '1234' where commande_id = :'cb';
select pg_temp.ok(prive.regenerer_codes_retrait() = 3, 'migration : 3 codes à 4 chiffres régénérés');
select pg_temp.ok((select bool_and(code ~ '^[0-9]{6}$') from prive.retraits where commande_id in (:'c1', :'c2', :'cb'))
  and (select count(distinct code) from prive.retraits where boutique_id = :'BA' and actif) = (select count(*) from prive.retraits where boutique_id = :'BA' and actif)
  and (select code from prive.retraits where commande_id = :'c3') = :'k3', 'migration : 6 chiffres, uniques dans la boutique, autres codes inchangés');
alter table prive.retraits add constraint retraits_code_check check (code ~ '^[0-9]{6}$');
select pg_temp.ok(prive.regenerer_codes_retrait() = 0, 'migration : rien à régénérer une deuxième fois');
rollback to savepoint migration;
select pg_temp.ok((select code from prive.retraits where commande_id = :'c1') = :'k1', 'savepoint annulé : codes du test de nouveau en place');
-- Faute de frappe près : un chiffre faux ou deux chiffres voisins inversés.
select pg_temp.ok(prive.codes_proches('123456', '123457') and prive.codes_proches('123456', '923456') and prive.codes_proches('123456', '124356')
  and prive.codes_proches('123456', '213456') and not prive.codes_proches('123456', '123456') and not prive.codes_proches('123456', '125436')
  and not prive.codes_proches('123456', '654321') and not prive.codes_proches('123456', '113356') and not prive.codes_proches('1234', '123456'),
  'codes_proches : un chiffre faux ou deux voisins inversés seulement');

-- ---------------------------------------------------------------------------
-- 2. Lecture seule (point 2) : le code est refusé avant toute recherche, l'essai ne peut pas être perdu
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
savepoint lecture_seule;
set transaction read only;
select pg_temp.ok(current_setting('transaction_read_only') = 'on', 'transaction en lecture seule (comme GET /rest/v1/rpc/retrait_boutique)');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', :'k1'), '25006', 'lecture seule', 'lecture seule : le bon code est refusé');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', (select k from faux where n = 1)), '25006', 'lecture seule', 'lecture seule : un code faux est refusé');
select pg_temp.ok((retrait_boutique(:'j1'))->>'etat' = 'ok', 'lecture seule : le QR code se lit toujours');
rollback to savepoint lecture_seule;
select pg_temp.ok(current_setting('transaction_read_only') = 'off', 'retour en lecture-écriture');
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'ok', 'lecture-écriture : le bon code marche');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok(not exists (select 1 from prive.essais_code_retrait where boutique_id = :'BA'), 'aucun essai enregistré');

-- ---------------------------------------------------------------------------
-- 3. Par commande (point 3) : 5 codes faux proches de k1 → code de c1 refusé 15 minutes, les autres commandes non
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((select bool_and((retrait_boutique(code => k))->>'etat' = 'invalide') from proches where n <= 3)
  and (remettre_commande(code => (select k from proches where n = 4)))->>'etat' = 'invalide', '4 codes proches de k1 (lecture et remise) : « invalide »');
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'ok', 'après 4 : le bon code de c1 marche encore');
select pg_temp.ok((retrait_boutique(code => (select k from proches where n = 5)))->>'etat' = 'invalide', '5e code proche (deux chiffres inversés) : « invalide »');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', :'k1'), '54000', 'pour cette commande', 'c1 : son code est refusé en lecture');
select pg_temp.erreur(format('select remettre_commande(code => %L)', :'k1'), '54000', 'bloqué encore 15 min', 'c1 : son code est refusé en remise');
select pg_temp.ok((retrait_boutique(code => :'k2'))->>'etat' = 'ok' and (retrait_boutique(code => :'k3'))->>'etat' = 'ok',
  'les autres commandes de la boutique : leur code marche (une faute de frappe ne bloque pas la boutique)');
select pg_temp.ok((retrait_boutique(:'j1'))->>'etat' = 'ok', 'c1 bloquée : son QR code se lit toujours');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select jusqu_a between now() + interval '14 minutes 59 seconds' and now() + interval '15 minutes'
  from prive.blocages_code_commande where commande_id = :'c1'), 'blocage de 15 minutes enregistré pour c1');
select pg_temp.ok((select count(*) from prive.blocages_code_commande where commande_id in (:'c2', :'c3', :'c4', :'cb')) = 0, 'aucun blocage pour les autres commandes');
select pg_temp.ok((select count(*) from prive.essais_code_retrait where boutique_id = :'BA' and commande_id is null) = 5
  and not exists (select 1 from prive.essais_code_retrait where commande_id = :'c1'), '5 essais faux comptés pour la boutique ; compteur de c1 remis à zéro');
-- 15 minutes plus tard : le code de c1 marche de nouveau.
update prive.blocages_code_commande set jusqu_a = now() - interval '1 second' where commande_id = :'c1';
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((retrait_boutique(code => :'k1'))->>'etat' = 'ok', 'après 15 minutes : le code de c1 marche de nouveau');
-- c1 bloquée de nouveau, puis remise par QR code : jamais bloquée.
select pg_temp.ok((select bool_and((retrait_boutique(code => k))->>'etat' = 'invalide') from proches), '6 nouveaux codes proches de k1');
select pg_temp.erreur(format('select remettre_commande(code => %L)', :'k1'), '54000', 'pour cette commande', 'c1 de nouveau bloquée par code');
select pg_temp.ok((remettre_commande(:'j1'))->>'mode_remise' = 'qr', 'c1 bloquée : remise par QR code possible');
select pg_temp.compte(null) \g /dev/null
reset role;
-- 11 codes faux pour la boutique (5 + 6).

-- ---------------------------------------------------------------------------
-- 4. Par boutique (point 3) : 20 codes faux en une heure → saisie du code refusée ; QR et « Remis sans QR code » marchent
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((select bool_and((retrait_boutique(code => k))->>'etat' = 'invalide') from faux where n <= 7)
  and (retrait_boutique(code => '12ab'))->>'etat' = 'invalide', '8 codes faux de plus (dont un mal formé) : 19 en une heure');
select pg_temp.ok((retrait_boutique(code => :'k2'))->>'etat' = 'ok', 'après 19 codes faux : le bon code marche encore');
select pg_temp.ok((remettre_commande(code => (select k from faux where n = 8)))->>'etat' = 'invalide', '20e code faux : encore « invalide »');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', (select k from faux where n = 9)), '54000', '20 en une heure', '21e essai (code faux) : refusé');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', :'k2'), '54000', 'bloquée encore 60 min', 'boutique bloquée : le bon code est refusé en lecture');
select pg_temp.erreur(format('select remettre_commande(code => %L)', :'k2'), '54000', 'Scannez le QR code', 'boutique bloquée : le bon code est refusé en remise');
select pg_temp.ok((retrait_boutique(:'j2'))->>'etat' = 'ok' and (remettre_commande(:'j2'))->>'mode_remise' = 'qr', 'boutique bloquée : QR code lu et remis');
select changer_statut_commande(:'c3', 'recuperee', null, 'Remise sans QR code') \g /dev/null
-- Boutique B : pas concernée.
select pg_temp.compte(:'B') \g /dev/null
select pg_temp.ok((retrait_boutique(code => :'kb'))->>'etat' = 'ok', 'autre boutique : son code marche');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select mode_remise from commandes where id = :'c3') = 'manuel' and (select statut from commandes where id = :'c3') = 'recuperee',
  'boutique bloquée : « Remis sans QR code » marche (mode « manuel »)');
select pg_temp.ok((select statut from commandes where id = :'c4') = 'prete' and (select mode_remise from commandes where id = :'c2') = 'qr',
  'base : rien de remis par code pendant le blocage');
select pg_temp.ok((select count(*) from prive.essais_code_retrait where boutique_id = :'BA' and commande_id is null) = 20, 'les essais refusés ne comptent pas');
select pg_temp.ok((select bloque from profils where id = :'A') = false, 'le compte du commerçant n''est pas bloqué');
-- Fenêtre glissante d'une heure : l'essai le plus ancien a plus d'une heure → un essai de nouveau possible.
update prive.essais_code_retrait set le = now() - interval '61 minutes'
where id = (select min(id) from prive.essais_code_retrait where boutique_id = :'BA' and commande_id is null);
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((remettre_commande(code => :'k4'))->>'mode_remise' = 'code', 'un essai de plus d''une heure oublié : remise par code possible');
select pg_temp.ok((retrait_boutique(code => (select k from faux where n = 10)))->>'etat' = 'invalide', 'fenêtre glissante : de nouveau 20 codes faux dans l''heure');
select pg_temp.erreur(format('select retrait_boutique(code => %L)', (select k from faux where n = 11)), '54000', '20 en une heure', 'au-delà de 20 dans l''heure : refusé');
select pg_temp.compte(null) \g /dev/null
reset role;
update prive.essais_code_retrait set le = now() - interval '61 minutes' where boutique_id = :'BA';
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.ok((retrait_boutique(code => (select k from faux where n = 12)))->>'etat' = 'invalide', 'une heure plus tard : saisie du code de nouveau possible');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select count(*) from prive.essais_code_retrait where boutique_id = :'BA') = 1, 'essais de plus d''une heure effacés');

-- ---------------------------------------------------------------------------
-- 5. Tables invisibles pour l'API
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'A') \g /dev/null
select pg_temp.erreur('select * from prive.essais_code_retrait', '42501', 'permission denied', 'boutique : essais illisibles');
select pg_temp.erreur('select * from prive.blocages_code_commande', '42501', 'permission denied', 'boutique : blocages illisibles');
select pg_temp.erreur('delete from prive.blocages_code_commande', '42501', 'permission denied', 'boutique : ne peut pas lever un blocage');
select pg_temp.erreur('select prive.regenerer_codes_retrait()', '42501', 'permission denied', 'boutique : ne peut pas régénérer les codes');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok(to_regclass('prive.blocages_code_retrait') is null, 'ancien blocage de toute la boutique (15 minutes) supprimé');

rollback;

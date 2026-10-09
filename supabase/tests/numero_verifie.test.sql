-- Tests SQL de la migration 20261010090000_numero_verifie.sql (US-21.1 : numéro vérifié par code).
-- Même mode d'emploi que corrections_relecture.test.sql :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/numero_verifie.test.sql
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

delete from prive.reglages where cle in ('connexion_client', 'blocage_par_numero', 'jeton_notifications', 'jeton_codes_telephone');
-- Depuis 20261010150000_secret_codes_telephone.sql, les limites d'envoi ont leur propre secret.
insert into prive.reglages (cle, valeur) values ('jeton_codes_telephone', encode(sha256(convert_to('jeton-de-test-0123456789', 'UTF8')), 'hex'));

-- Comptes : un client ancien (e-mail), un client par numéro, une boutique.
insert into auth.users (id, email) values
  ('c2000000-0000-0000-0000-000000000001', 'ancien@test.dz'),
  ('b2000000-0000-0000-0000-000000000001', 'boutique@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d2000000-0000-0000-0000-000000000001', 'Boutique Numero', 'boutique-numero', 'Centre', '+213555920001', 'validee');
update profils set role = 'commercant', boutique_id = 'd2000000-0000-0000-0000-000000000001' where id = 'b2000000-0000-0000-0000-000000000001';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Chemise numero', 'Chemises', 3000, 'homme');
insert into tailles (article_id, libelle, disponible) values ('e2000000-0000-0000-0000-000000000001', 'L', true);
update tailles set quantite = 100 where article_id = 'e2000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Format
-- ---------------------------------------------------------------------------
select pg_temp.ok(prive.telephone_client_valide('+213555123456') and prive.telephone_client_valide('+213612345678')
  and prive.telephone_client_valide('+213798765432'), 'format : mobiles 5, 6, 7 acceptés');
select pg_temp.ok(not prive.telephone_client_valide('+213412345678') and not prive.telephone_client_valide('+21355512345')
  and not prive.telephone_client_valide('+2135551234567') and not prive.telephone_client_valide('+33612345678')
  and not prive.telephone_client_valide('0555123456') and not prive.telephone_client_valide(null),
  'format : fixe, trop court, trop long, étranger, sans indicatif ou vide refusés');

-- ---------------------------------------------------------------------------
-- Comptes Supabase Auth
-- ---------------------------------------------------------------------------
select pg_temp.erreur($$insert into auth.users (id, phone) values ('c2000000-0000-0000-0000-000000000009', '33612345678')$$,
  '23514', 'mobiles algériens', 'auth : création d''un compte avec un numéro étranger refusée (avant l''envoi du code)');
select pg_temp.erreur($$insert into auth.users (id, phone) values ('c2000000-0000-0000-0000-000000000009', '213212345678')$$,
  '23514', 'mobiles algériens', 'auth : création d''un compte avec un numéro fixe refusée');
insert into auth.users (id, phone) values ('c2000000-0000-0000-0000-000000000002', '213555300002');
select pg_temp.ok((select telephone is null and telephone_verifie_le is null and role = 'client' from profils
  where id = 'c2000000-0000-0000-0000-000000000002'), 'auth : compte créé par numéro, non confirmé : pas de numéro sur le profil');
update auth.users set phone_confirmed_at = now() where id = 'c2000000-0000-0000-0000-000000000002';
select pg_temp.ok((select telephone = '+213555300002' and telephone_verifie_le is not null from profils
  where id = 'c2000000-0000-0000-0000-000000000002'), 'auth : code confirmé → numéro vérifié recopié avec « + »');
select pg_temp.ok((select telephone is null from profils where id = 'c2000000-0000-0000-0000-000000000001'),
  'auth : compte e-mail créé sans numéro');

-- ---------------------------------------------------------------------------
-- Profil : numéro vérifié non modifiable à la main, date de vérification protégée
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c2000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur($$update profils set telephone = '+213555300099' where id = auth.uid()$$,
  '42501', 'vérifiez le nouveau numéro par code', 'profil : numéro vérifié non modifiable à la main');
update profils set nom = 'Client Numero' where id = auth.uid();
select pg_temp.ok((select nom = 'Client Numero' and telephone = '+213555300002' from profils where id = auth.uid()),
  'profil : le nom reste modifiable');
update profils set telephone_verifie_le = null where id = auth.uid();
select pg_temp.ok((select telephone_verifie_le is not null from profils where id = auth.uid()),
  'profil : le client ne retire pas la date de vérification');
select pg_temp.compte('c2000000-0000-0000-0000-000000000001') \g /dev/null
update profils set nom = 'Client Ancien', telephone = '+213555300001', telephone_verifie_le = now() where id = auth.uid();
select pg_temp.ok((select telephone = '+213555300001' and telephone_verifie_le is null from profils where id = auth.uid()),
  'profil : un compte e-mail saisit son numéro à la main, sans pouvoir se dire vérifié');
reset role;

-- ---------------------------------------------------------------------------
-- Changement de numéro par code (phone_change), unicité du numéro vérifié
-- ---------------------------------------------------------------------------
select pg_temp.erreur($$update auth.users set phone_change = '447700900123' where id = 'c2000000-0000-0000-0000-000000000001'$$,
  '23514', 'mobiles algériens', 'auth : vérification d''un numéro étranger refusée');
update auth.users set phone_change = '213555300001' where id = 'c2000000-0000-0000-0000-000000000001';
select pg_temp.ok((select telephone_verifie_le is null from profils where id = 'c2000000-0000-0000-0000-000000000001'),
  'auth : demande de code envoyée : rien ne change avant la confirmation');
update auth.users set phone = phone_change, phone_change = '', phone_confirmed_at = now() where id = 'c2000000-0000-0000-0000-000000000001';
select pg_temp.ok((select telephone = '+213555300001' and telephone_verifie_le is not null from profils
  where id = 'c2000000-0000-0000-0000-000000000001'), 'auth : compte e-mail vérifié par code');
-- Un ancien profil garde un numéro vérifié devenu faux (désynchronisé) : il le perd quand un autre compte vérifie ce numéro.
insert into auth.users (id, email) values ('c2000000-0000-0000-0000-000000000003', 'autre@test.dz');
update profils set telephone = '+213666300003', telephone_verifie_le = now() where id = 'c2000000-0000-0000-0000-000000000003';
insert into auth.users (id, phone, phone_confirmed_at) values ('c2000000-0000-0000-0000-000000000004', '213666300003', now());
select pg_temp.ok((select telephone_verifie_le is null from profils where id = 'c2000000-0000-0000-0000-000000000003')
  and (select telephone = '+213666300003' and telephone_verifie_le is not null from profils where id = 'c2000000-0000-0000-0000-000000000004'),
  'auth : le numéro vérifié passe au compte qui vient de le vérifier, l''autre profil le perd');
-- Un numéro saisi à la main par un autre compte (non vérifié) ne gêne pas la vérification.
insert into auth.users (id, email) values ('c2000000-0000-0000-0000-000000000005', 'copie@test.dz');
update profils set telephone = '+213777300005' where id = 'c2000000-0000-0000-0000-000000000005';
insert into auth.users (id, phone, phone_confirmed_at) values ('c2000000-0000-0000-0000-000000000006', '213777300005', now());
select pg_temp.ok((select count(*) = 2 and count(telephone_verifie_le) = 1 from profils where telephone = '+213777300005'),
  'auth : un numéro saisi à la main reste sur l''autre compte, non vérifié');
update auth.users set phone = null where id = 'c2000000-0000-0000-0000-000000000006';
select pg_temp.ok((select telephone_verifie_le is null from profils where id = 'c2000000-0000-0000-0000-000000000006'),
  'auth : numéro retiré du compte → plus vérifié');

-- ---------------------------------------------------------------------------
-- Commande : mode e-mail inchangé, mode téléphone = numéro vérifié obligatoire
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c2000000-0000-0000-0000-000000000005') \g /dev/null
update profils set nom = 'Client Copie' where id = auth.uid();
select passer_commande('d2000000-0000-0000-0000-000000000001', '[{"article_id":"e2000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') as c1 \gset
select pg_temp.compte('c2000000-0000-0000-0000-000000000002') \g /dev/null
select passer_commande('d2000000-0000-0000-0000-000000000001', '[{"article_id":"e2000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') as c2 \gset
reset role;
select pg_temp.ok((select not telephone_verifie from commandes where id = :'c1'),
  'commande : mode e-mail, numéro saisi à la main accepté, commande marquée non vérifiée');
select pg_temp.ok((select telephone_verifie and client_telephone = '+213555300002' from commandes where id = :'c2'),
  'commande : numéro vérifié copié comme vérifié');
insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone');
set local role authenticated;
select pg_temp.compte('c2000000-0000-0000-0000-000000000005') \g /dev/null
select pg_temp.erreur($$select passer_commande('d2000000-0000-0000-0000-000000000001', '[{"article_id":"e2000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]')$$,
  '23514', 'Vérifiez votre numéro de téléphone par code', 'commande : mode téléphone, numéro non vérifié refusé');
select pg_temp.compte('c2000000-0000-0000-0000-000000000004') \g /dev/null
select pg_temp.erreur($$select passer_commande('d2000000-0000-0000-0000-000000000001', '[{"article_id":"e2000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]')$$,
  '23514', 'Renseignez votre nom', 'commande : mode téléphone, numéro vérifié mais nom manquant');
select pg_temp.compte('c2000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok(passer_commande('d2000000-0000-0000-0000-000000000001', '[{"article_id":"e2000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') is not null,
  'commande : mode téléphone, numéro vérifié accepté');
reset role;
delete from prive.reglages where cle = 'connexion_client';

-- ---------------------------------------------------------------------------
-- Limites d'envoi des codes
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.erreur($$select controler_envoi_code('mauvais-jeton-0123456789', '+213555300010')$$, '42501', 'Accès refusé',
  'limites : sans le jeton du serveur, refus');
select pg_temp.erreur($$select enregistrer_envoi_code(null, '+213555300010')$$, '42501', 'Accès refusé',
  'limites : enregistrement impossible sans le jeton du serveur');
select pg_temp.erreur($$select controler_envoi_code('jeton-de-test-0123456789', '+33612345678')$$, '22023', 'mobile algérien',
  'limites : numéro étranger refusé');
select pg_temp.erreur($$select * from prive.envois_codes$$, '42501', 'permission', 'limites : table privée illisible');
select controler_envoi_code('jeton-de-test-0123456789', '+213555300010') \g /dev/null
select enregistrer_envoi_code('jeton-de-test-0123456789', '+213555300010') \g /dev/null
select pg_temp.erreur($$select controler_envoi_code('jeton-de-test-0123456789', '+213555300010')$$, '54000', 'Attendez une minute',
  'limites : un seul code par minute pour un numéro');
select pg_temp.ok((select count(*) = 1 from (select controler_envoi_code('jeton-de-test-0123456789', '+213555300011')) x),
  'limites : un autre numéro n''est pas gêné');
reset role;
update prive.envois_codes set envoye_le = now() - interval '2 minutes' where telephone = '+213555300010';
insert into prive.envois_codes (telephone, envoye_le) values
  ('+213555300010', now() - interval '10 minutes'), ('+213555300010', now() - interval '20 minutes'),
  ('+213555300010', now() - interval '30 minutes'), ('+213555300010', now() - interval '59 minutes');
set local role authenticated;
select pg_temp.erreur($$select controler_envoi_code('jeton-de-test-0123456789', '+213555300010')$$, '54000', 'réessayez dans une heure',
  'limites : 5 codes par heure au plus pour un numéro');
reset role;
update prive.envois_codes set envoye_le = now() - interval '61 minutes' where telephone = '+213555300010' and envoye_le < now() - interval '50 minutes';
insert into prive.envois_codes (telephone, envoye_le) values ('+213555300012', now() - interval '2 days');
set local role authenticated;
select pg_temp.ok((select count(*) = 1 from (select controler_envoi_code('jeton-de-test-0123456789', '+213555300010')) x),
  'limites : un code de nouveau possible quand le plus ancien a plus d''une heure');
select enregistrer_envoi_code('jeton-de-test-0123456789', '+213555300010') \g /dev/null
reset role;
select pg_temp.ok(not exists (select 1 from prive.envois_codes where telephone = '+213555300012'),
  'limites : les envois de plus de 24 h sont effacés');

rollback;

-- Tests SQL de la migration 20261011120000_retrait_whatsapp.sql (US-26.4 : bouton « Mon QR code » du message « commande prête »).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/retrait_whatsapp.test.sql
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

delete from prive.reglages where cle in ('bouton_retrait', 'modeles_arabes', 'jeton_notifications');
insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('secret-envoi-whatsapp-264', 'UTF8')), 'hex'));
\set secret '''secret-envoi-whatsapp-264'''

insert into auth.users (id, email) values
  ('b2640000-0000-0000-0000-00000000000a', 'boutique264@test.dz'),
  ('c2640000-0000-0000-0000-000000000001', 'client2641@test.dz'),
  ('c2640000-0000-0000-0000-000000000002', 'client2642@test.dz'),
  ('c2640000-0000-0000-0000-000000000003', 'client2643@test.dz'),
  ('c2640000-0000-0000-0000-000000000004', 'client2644@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d2640000-0000-0000-0000-00000000000a', 'Boutique Bouton', 'boutique-bouton-retrait', 'Gambetta', '+213555264000', 'validee');
update profils set role = 'commercant', boutique_id = 'd2640000-0000-0000-0000-00000000000a' where id = 'b2640000-0000-0000-0000-00000000000a';
update profils set nom = 'Amine', telephone = '+213555264001' where id = 'c2640000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555264002' where id = 'c2640000-0000-0000-0000-000000000002';
update profils set nom = 'Nadia', telephone = '+213555264003' where id = 'c2640000-0000-0000-0000-000000000003';
update profils set nom = 'Sofiane', telephone = '+213555264004' where id = 'c2640000-0000-0000-0000-000000000004';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e2640000-0000-0000-0000-00000000000a', 'd2640000-0000-0000-0000-00000000000a', 'Parfum bouton', 'Parfums', 3900, 'mixte');
insert into tailles (article_id, libelle, disponible) values ('e2640000-0000-0000-0000-00000000000a', '50 ml', true);
update tailles set quantite = 20 where article_id = 'e2640000-0000-0000-0000-00000000000a';

create function pg_temp.commande_prete(client uuid, langue text default null) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d2640000-0000-0000-0000-00000000000a', '[{"article_id":"e2640000-0000-0000-0000-00000000000a","taille":"50 ml","quantite":1}]');
  if langue is not null then perform definir_langue_commande(c, langue); end if;
  perform pg_temp.compte('b2640000-0000-0000-0000-00000000000a');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;

create function pg_temp.message_prete(c uuid) returns messages_whatsapp language sql as $$
  select * from messages_whatsapp where commande_id = c and destinataire = '+213555264' || right(
    (select client_telephone from commandes where id = c), 3) and modele like 'oranpromo_commande_prete%'
$$;

-- 1. Interrupteur éteint : l'ancien message, identique.
set local role authenticated;
select pg_temp.commande_prete('c2640000-0000-0000-0000-000000000001') as c1 \gset
reset role;
select pg_temp.ok((pg_temp.message_prete(:'c1')).modele = 'oranpromo_commande_prete', 'sans bouton_retrait : ancien modèle');
select pg_temp.ok(jsonb_array_length((pg_temp.message_prete(:'c1')).parametres) = 4, 'sans bouton_retrait : 4 paramètres');
select pg_temp.ok((pg_temp.message_prete(:'c1')).texte like 'Bonjour Amine, votre commande n° % est prête chez Boutique Bouton. Vous pouvez la récupérer jusqu''au %.'
  and (pg_temp.message_prete(:'c1')).texte not like '%QR code%', 'sans bouton_retrait : texte inchangé');

-- 2. Interrupteur allumé : nouveau modèle, 5e paramètre = identifiant de la commande, jamais le jeton ni le code.
insert into prive.reglages (cle, valeur) values ('bouton_retrait', 'on');
set local role authenticated;
select pg_temp.commande_prete('c2640000-0000-0000-0000-000000000002') as c2 \gset
reset role;
select r.jeton as j2, r.code as k2 from prive.retraits r where r.commande_id = :'c2' \gset
select pg_temp.ok((pg_temp.message_prete(:'c2')).modele = 'oranpromo_commande_prete_retrait', 'bouton_retrait : nouveau modèle');
select pg_temp.ok((pg_temp.message_prete(:'c2')).parametres ->> 4 = :'c2', 'bouton_retrait : 5e paramètre = identifiant de la commande');
select pg_temp.ok((pg_temp.message_prete(:'c2')).texte like 'Bonjour Karim, votre commande n° % est prête chez Boutique Bouton. Vous pouvez la récupérer jusqu''au %. Montrez votre QR code de retrait en boutique (bouton ci-dessous) et payez sur place.',
  'bouton_retrait : texte du modèle');
select pg_temp.ok(position(:'j2' in (pg_temp.message_prete(:'c2'))::text) = 0, 'le jeton n''est pas dans le message');
select pg_temp.ok(not exists (select 1 from messages_whatsapp where commande_id = :'c2' and (parametres ? :'k2' or texte like '%' || :'j2' || '%')), 'ni le jeton ni le code dans messages_whatsapp');
select pg_temp.ok((select count(*) from messages_whatsapp where commande_id = :'c2' and modele like 'oranpromo_commande_prete%') = 1, 'un seul message « prête »');

-- 3. La boutique envoie juste après son action : le nouveau modèle en fait partie, sans jeton.
set local role authenticated;
select pg_temp.compte('b2640000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.ok(exists (select 1 from messages_whatsapp_commande(:'c2') m where m.modele = 'oranpromo_commande_prete_retrait' and position(:'j2' in m.parametres::text) = 0),
  'messages_whatsapp_commande : nouveau modèle réservé, sans jeton');
-- 4. La boutique ne peut pas obtenir le jeton.
select pg_temp.erreur(format('select jeton_retrait_envoi(%L, %L)', 'mauvais-secret-0123456789', :'c2'), '42501', 'Accès refusé', 'boutique sans le secret : refusé');
select pg_temp.erreur(format('select jeton_retrait_envoi(null, %L)', :'c2'), '42501', 'Accès refusé', 'secret absent : refusé');
select pg_temp.compte(null) \g /dev/null
reset role;
set local role anon;
select pg_temp.erreur(format('select jeton_retrait_envoi(%L, %L)', 'x', :'c2'), '42501', 'Accès refusé', 'anonyme sans le secret : refusé');
-- 5. Le serveur d'envoi (avec CRON_SECRET) obtient le jeton tant que la commande est prête.
select pg_temp.ok(jeton_retrait_envoi(:secret, :'c2') = :'j2', 'serveur avec le secret : jeton de la commande prête');
select pg_temp.ok(jeton_retrait_envoi(:secret, :'c1') is not null, 'commande prête créée avant l''interrupteur : jeton aussi');
select pg_temp.ok(jeton_retrait_envoi(:secret, gen_random_uuid()) is null, 'commande inconnue : rien');
reset role;

-- 6. Plus de jeton quand la commande n'est plus prête ou que sa date est passée.
update commandes set expire_le = now() - interval '1 minute' where id = :'c1';
set local role anon;
select pg_temp.ok(jeton_retrait_envoi(:secret, :'c1') is null, 'date limite passée : rien (ancien message sans bouton)');
reset role;
set local role authenticated;
select pg_temp.compte('b2640000-0000-0000-0000-00000000000a') \g /dev/null
select changer_statut_commande(:'c2', 'recuperee') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
set local role anon;
select pg_temp.ok(jeton_retrait_envoi(:secret, :'c2') is null, 'commande récupérée : rien');
reset role;

-- 7. Client en arabe (modeles_arabes = on) : modèle arabe actuel, sans bouton ; client en français : bouton.
insert into prive.reglages (cle, valeur) values ('modeles_arabes', 'on');
set local role authenticated;
select pg_temp.commande_prete('c2640000-0000-0000-0000-000000000003', 'ar') as c3 \gset
select pg_temp.commande_prete('c2640000-0000-0000-0000-000000000004', 'fr') as c4 \gset
reset role;
select pg_temp.ok((pg_temp.message_prete(:'c3')).modele = 'oranpromo_commande_prete_ar', 'client en arabe : modèle arabe sans bouton');
select pg_temp.ok(jsonb_array_length((pg_temp.message_prete(:'c3')).parametres) = 4, 'client en arabe : 4 paramètres');
select pg_temp.ok((pg_temp.message_prete(:'c4')).modele = 'oranpromo_commande_prete_retrait', 'client en français avec modeles_arabes : bouton');

-- 8. Contrainte : le nouveau modèle est accepté, un modèle inconnu reste refusé.
select pg_temp.erreur($$insert into messages_whatsapp (destinataire, modele, parametres, texte) values ('+213555264009', 'oranpromo_inconnu', '[]', 'x')$$, '23514', 'messages_whatsapp_modele_check', 'modèle inconnu refusé');

-- 9. Droits : jeton_retrait_envoi exécutable par anon et authenticated (secret exigé), pas par public.
select pg_temp.ok(has_function_privilege('anon', 'jeton_retrait_envoi(text, uuid)', 'execute') and has_function_privilege('authenticated', 'jeton_retrait_envoi(text, uuid)', 'execute'), 'droits d''exécution');
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and column_name = 'jeton' and table_name = 'messages_whatsapp'), 'aucune colonne jeton ajoutée');

rollback;

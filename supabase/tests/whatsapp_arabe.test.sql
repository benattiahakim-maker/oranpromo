-- Tests SQL de la migration 20261010200000_whatsapp_arabe.sql (US-23 étape 4 : WhatsApp au client en arabe, repli en français).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/whatsapp_arabe.test.sql
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

delete from prive.reglages where cle in ('modeles_arabes', 'bouton_confirmer', 'blocage_par_numero');
insert into auth.users (id, email) values
  ('ba000000-0000-0000-0000-000000000001', 'boutique-ar@test.dz'),
  ('ca000000-0000-0000-0000-000000000001', 'client-ar1@test.dz'),
  ('ca000000-0000-0000-0000-000000000002', 'client-ar2@test.dz'),
  ('ca000000-0000-0000-0000-000000000003', 'client-ar3@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('da000000-0000-0000-0000-000000000001', 'Boutique Nour', 'boutique-nour-arabe', 'Centre', '+213555900001', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'da000000-0000-0000-0000-000000000001' where id = 'ba000000-0000-0000-0000-000000000001';
update profils set nom = 'Samir', telephone = '+213555290001' where id = 'ca000000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555290002' where id = 'ca000000-0000-0000-0000-000000000002';
update profils set nom = 'Yacine', telephone = '+213555290003' where id = 'ca000000-0000-0000-0000-000000000003';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('ea000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Polo arabe', 'T-shirts et polos', 3500, 'homme');
insert into tailles (article_id, libelle, disponible) values ('ea000000-0000-0000-0000-000000000001', 'M', true);
update tailles set quantite = 100 where article_id = 'ea000000-0000-0000-0000-000000000001';

-- Commande (vieillie de 2 h pour la limite par heure), langue choisie par le client, puis prête.
create function pg_temp.commande_prete(client uuid, langue text) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('da000000-0000-0000-0000-000000000001', '[{"article_id":"ea000000-0000-0000-0000-000000000001","taille":"M","quantite":1}]');
  if langue is not null then perform definir_langue_commande(c, langue); end if;
  reset role;
  update commandes set cree_le = now() - interval '2 hours' where id = c;
  set local role authenticated;
  perform pg_temp.compte('ba000000-0000-0000-0000-000000000001');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Langue de la commande
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.commande_prete('ca000000-0000-0000-0000-000000000001', null) as c0 \gset
reset role;
select pg_temp.ok((select langue from commandes where id = :'c0') = 'fr', 'par défaut : commande en français');
set local role authenticated;
select pg_temp.compte('ca000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select definir_langue_commande(%L, %L)', :'c0', 'ar'), 'P0002', 'Commande introuvable', 'un autre compte ne change pas la langue');
select pg_temp.compte('ca000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select definir_langue_commande(%L, %L)', :'c0', 'en'), '22023', 'Langue inconnue', 'langue inconnue refusée');
select pg_temp.compte(null) \g /dev/null
reset role;
set local role anon;
select pg_temp.erreur(format('select definir_langue_commande(%L, %L)', :'c0', 'ar'), '42501', 'permission denied', 'anonyme : refusé');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Repli : commande en arabe mais modèles arabes pas encore approuvés → français
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.commande_prete('ca000000-0000-0000-0000-000000000001', 'ar') as c1 \gset
reset role;
select pg_temp.ok((select langue from commandes where id = :'c1') = 'ar', 'langue « ar » enregistrée par le client');
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c1' and destinataire = '+213555290001') = 'oranpromo_commande_prete'
  and (select langue from messages_whatsapp where commande_id = :'c1' and destinataire = '+213555290001') = 'fr'
  and (select texte from messages_whatsapp where commande_id = :'c1' and destinataire = '+213555290001') like 'Bonjour Samir, votre commande n° % est prête chez Boutique Nour.%',
  'sans interrupteur : message « prête » en français (repli)');

-- ---------------------------------------------------------------------------
-- 3. Modèles arabes approuvés : texte validé n° 10, modèle _ar, date en chiffres
-- ---------------------------------------------------------------------------
insert into prive.reglages (cle, valeur) values ('modeles_arabes', 'on');
set local role authenticated;
select pg_temp.commande_prete('ca000000-0000-0000-0000-000000000001', 'ar') as c2 \gset
reset role;
select numero, to_char(expire_le at time zone 'Africa/Algiers', 'DD/MM') as jour, to_char(expire_le at time zone 'Africa/Algiers', 'HH24:MI') as heure
  from commandes where id = :'c2' \gset
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555290001') = 'oranpromo_commande_prete_ar'
  and (select langue from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555290001') = 'ar',
  'interrupteur « on » : modèle oranpromo_commande_prete_ar, langue ar');
select pg_temp.ok((select texte from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555290001')
  = format('السلام Samir، الطلب رقم %s راهو واجد عند Boutique Nour. تقدر تجي تدّيه حتى %s على %s.', :'numero', :'jour', :'heure'),
  'texte validé n° 10 repris tel quel, date « JJ/MM على HH:MI »');
select pg_temp.ok((select parametres from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555290001')
  = jsonb_build_array('Samir', :'numero', 'Boutique Nour', format('%s على %s', :'jour', :'heure')),
  'paramètres du modèle arabe : mêmes valeurs, même ordre');
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555900001') = 'oranpromo_nouvelle_commande'
  and (select langue from messages_whatsapp where commande_id = :'c2' and destinataire = '+213555900001') = 'fr',
  'message à la boutique : toujours en français');
set local role authenticated;
select pg_temp.compte('ba000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select count(*) from messages_whatsapp_commande(:'c2') where modele = 'oranpromo_commande_prete_ar') = 1,
  'le modèle arabe « prête » part tout de suite après l''action');
select pg_temp.compte(null) \g /dev/null
reset role;

-- Client en français, interrupteur « on » : rien ne change.
set local role authenticated;
select pg_temp.commande_prete('ca000000-0000-0000-0000-000000000002', 'fr') as c3 \gset
reset role;
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c3' and destinataire = '+213555290002') = 'oranpromo_commande_prete'
  and (select texte from messages_whatsapp where commande_id = :'c3' and destinataire = '+213555290002') like 'Bonjour Karim, %',
  'client en français : message français');

-- Nom refusé (« cher client » dans les fonctions existantes) : « خويا » ; date absente : « تفوت 24 ساعة ».
select pg_temp.ok(prive.parametres_whatsapp_arabe('oranpromo_commande_prete', array['cher client', '12', 'Boutique Nour', 'dans les 24 heures'])
  = array['خويا', '12', 'Boutique Nour', 'تفوت 24 ساعة'], 'nom refusé : « خويا » ; date absente : « تفوت 24 ساعة »');

-- ---------------------------------------------------------------------------
-- 4. Expiration, client pas venu, blocage : textes arabes, règles inchangées
-- ---------------------------------------------------------------------------
update commandes set expire_le = now() - interval '1 minute' where id = :'c2';
set local role authenticated;
select pg_temp.compte('ba000000-0000-0000-0000-000000000001') \g /dev/null
select declarer_no_show(:'c2') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'c2') = 'expiree', 'no-show : commande expirée comme avant');
select pg_temp.ok((select texte from messages_whatsapp where commande_id = :'c2' and modele = 'oranpromo_commande_expiree_ar') like 'السلام Samir، الطلب رقم % عند Boutique Nour ما تدّاش في 24 ساعة%',
  'expiration : texte arabe, modèle oranpromo_commande_expiree_ar');
select pg_temp.ok((select texte from messages_whatsapp where commande_id = :'c2' and modele = 'oranpromo_no_show_ar') like 'السلام Samir، Boutique Nour قالولنا بلي ما جيتش تدّي الطلب رقم %. عندك دروك 1 طلبات ما تدّاوش: كان زادو 4 يتبلوكا%',
  'client pas venu : texte arabe avec le compteur et le reste (1 et 4)');
select pg_temp.ok((select no_shows from profils where id = 'ca000000-0000-0000-0000-000000000001') = 1
  and not (select bloque from profils where id = 'ca000000-0000-0000-0000-000000000001'),
  'compteur de no-shows et blocage inchangés (1, non bloqué)');

-- Blocage automatique : langue de la dernière commande du client.
update profils set no_shows = 5, bloque = true, bloque_le = now() where id = 'ca000000-0000-0000-0000-000000000001';
select pg_temp.ok((select texte from messages_whatsapp where destinataire = '+213555290001' and modele = 'oranpromo_compte_bloque_ar')
  = 'السلام Samir، حسابك في OranPromo تبلوكا من بعد 5 طلبات ما تدّاوش. باش يتحلّ، اتصل بـ OranPromo.',
  'compte bloqué : message arabe (langue de la dernière commande)');
update profils set no_shows = 5, bloque = true, bloque_le = now() where id = 'ca000000-0000-0000-0000-000000000002';
select pg_temp.ok((select modele from messages_whatsapp where destinataire = '+213555290002' and modele like 'oranpromo_compte_bloque%') = 'oranpromo_compte_bloque',
  'compte bloqué d''un client en français : modèle français');

-- ---------------------------------------------------------------------------
-- 5. Droits
-- ---------------------------------------------------------------------------
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.ajouter_message_whatsapp(text, text, text, text[], uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.langue_message_whatsapp(text, uuid)', 'execute'),
  'fonctions de la file : jamais appelables directement');
select pg_temp.ok(not has_function_privilege('anon', 'public.definir_langue_commande(uuid, text)', 'execute'),
  'definir_langue_commande : réservé aux comptes connectés');
select pg_temp.erreur('insert into messages_whatsapp (destinataire, modele, texte) values (''+213555290001'', ''oranpromo_inconnu_ar'', ''x'')',
  '23514', 'messages_whatsapp_modele_check', 'modèle inconnu refusé');

rollback;

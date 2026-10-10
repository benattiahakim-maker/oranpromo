-- Tests SQL de la migration 20261020100000_alertes_whatsapp.sql (US-31.5 : alerte WhatsApp « nouvelles promos »).
-- Éteinte par défaut ; case séparée (accord journalisé) ; un message par jour au plus, seulement s'il y a du nouveau ;
-- plafond mensuel ; désabonnement par lien sans connexion ; jeton jamais écrit dans la file ; règles inchangées.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/alertes_whatsapp.test.sql
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

-- 0. Définitions inchangées : commandes, blocage, no-shows, numéro, file et envoi WhatsApp, abonnements, promos.
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),('prive','recalculer_no_shows'),
    ('public','passer_commande'),('public','changer_statut_commande'),('public','remettre_commande'),('prive','proteger_profil'),
    ('prive','ajouter_message_whatsapp'),('public','messages_whatsapp_en_attente'),('public','resultat_message_whatsapp'),
    ('prive','messages_suivi_commande'),('prive','ajouter_abonnement'),('public','suivre_boutique'),('public','ne_plus_suivre'),
    ('prive','verifier_prix_promo'),('prive','noter_prix')))
  = 'ajouter_abonnement=a9d29dabac8ee8f328da60064b753e1e,ajouter_message_whatsapp=7cfe827e6327282f47c39960f23f10e9,blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,messages_suivi_commande=936e6401ec17e51226b8f9ac816f93ad,messages_whatsapp_en_attente=9f3ecbe229ad1a9e813f3c98c48cf895,ne_plus_suivre=bb0837af0e16f09ef202244177026a93,noter_prix=d4f87d604b788d078e4cdd4ee2f2541d,passer_commande=d18a962833a100d12f0b317e46973640,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,remettre_commande=8eae2e162ca810ef5a4cfab1d7615ee8,resultat_message_whatsapp=9c74e6ecb8eaa49443bc04085f07931c,suivre_boutique=4a9479e8283f4782d85a55911d0bfa35,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,verifier_prix_promo=1443820d21360721b08be4f3c4df2f04',
  'commandes, blocage, no-shows, numéro, file WhatsApp, abonnements, promos : définitions inchangées');
select pg_temp.ok((select count(*) from prive.reglages where cle in ('alertes_whatsapp', 'alertes_plafond_mois', 'alertes_modele_arabe')) = 0,
  'éteintes par défaut : aucun réglage d''alerte');
select pg_temp.ok(pg_get_constraintdef((select oid from pg_constraint where conname = 'messages_whatsapp_modele_check')) like '%oranpromo_commande_prete_retrait%bledeal_nouvelles_promos%bledeal_nouvelles_promos_ar%',
  'modèles : anciens gardés, bledeal_nouvelles_promos (+ _ar) ajoutés');

select pg_temp.erreur($q$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng)
  select 'alertes', 'Essai', 'تجربة', lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng from villes where code = 'oran'$q$, '23514', 'villes_code_libre_alertes',
  'code de ville « alertes » refusé (page /alertes/<jeton>)');

-- Données : 2 boutiques validées (A, B), 1 suspendue (S), commerçant, clients.
select pg_temp.compte(null);
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3150000-0000-0000-0000-00000000000a', 'Boutique Alpha', 'boutique-alpha-315', 'Gambetta', '+213555315901', 'validee', 'oran'),
  ('d3150000-0000-0000-0000-00000000000b', 'Boutique Beta', 'boutique-beta-315', 'Centre', '+213555315902', 'validee', 'oran'),
  ('d3150000-0000-0000-0000-00000000000c', 'Boutique Suspendue', 'boutique-suspendue-315', 'Centre', '+213555315903', 'validee', 'oran');
insert into auth.users (id, email) values ('b3150000-0000-0000-0000-00000000000a', 'boutique315a@test.dz');
update profils set role = 'commercant', boutique_id = 'd3150000-0000-0000-0000-00000000000a' where id = 'b3150000-0000-0000-0000-00000000000a';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3150000-0000-0000-0000-00000000000a', 'd3150000-0000-0000-0000-00000000000a', 'Robe A', 'Robes', 5000, 'femme'),
  ('e3150000-0000-0000-0000-00000000000b', 'd3150000-0000-0000-0000-00000000000b', 'Robe B', 'Robes', 5000, 'femme'),
  ('e3150000-0000-0000-0000-00000000000c', 'd3150000-0000-0000-0000-00000000000c', 'Robe S', 'Robes', 5000, 'femme'),
  ('e3150000-0000-0000-0000-00000000000d', 'd3150000-0000-0000-0000-00000000000a', 'Robe A2', 'Robes', 5000, 'femme');
insert into tailles (article_id, libelle, disponible, quantite)
select a, 'M', true, 10 from unnest(array['e3150000-0000-0000-0000-00000000000a','e3150000-0000-0000-0000-00000000000b',
  'e3150000-0000-0000-0000-00000000000c','e3150000-0000-0000-0000-00000000000d']::uuid[]) a;

create function pg_temp.client(i integer, verifie boolean default true) returns uuid language plpgsql as $$
declare cid uuid := ('c3150000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;
begin
  insert into auth.users (id, phone, phone_confirmed_at) values (cid, '2135553150' || lpad(i::text, 2, '0'), case when verifie then now() end);
  update profils set nom = 'Amine ' || chr(64 + i) || 'li' where profils.id = cid;
  return cid;
end $$;
create function pg_temp.suivre(cid uuid, b uuid) returns void language plpgsql as $$
begin perform pg_temp.compte(cid); perform suivre_boutique(b); perform pg_temp.compte(null); end $$;
create function pg_temp.activer(cid uuid, langue text default 'fr', source text default 'vitrine') returns void language plpgsql as $$
begin perform pg_temp.compte(cid); perform activer_alertes_whatsapp(langue, source); perform pg_temp.compte(null); end $$;
create function pg_temp.etat(cid uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform pg_temp.compte(cid); r := etat_alertes_whatsapp(); perform pg_temp.compte(null); return r; end $$;
create function pg_temp.promo(article uuid) returns void language sql as $$
  insert into promos (article_id, prix_promo, date_fin) values (article, 4000, now() + interval '7 days')
  on conflict (article_id) do update set prix_promo = 4000, date_fin = now() + interval '7 days';
$$;
create function pg_temp.vieillir() returns void language sql as $$
  update prive.nouvelles_promos set le = le - interval '2 days';
  update prive.alertes_whatsapp set derniere_alerte = derniere_alerte - interval '2 days', consentie_le = consentie_le - interval '3 days';
  update messages_whatsapp set cree_le = cree_le - interval '2 days' where modele like 'bledeal%';
$$;
create function pg_temp.alertes() returns bigint language sql as $$
  select count(*) from messages_whatsapp where modele like 'bledeal_nouvelles_promos%'
$$;

-- 1. Éteintes : rien n'est proposé, l'accord est refusé, aucune promo notée, aucun message.
select pg_temp.client(1), pg_temp.client(2), pg_temp.client(3), pg_temp.client(4, false), pg_temp.client(5);
select pg_temp.suivre('c3150000-0000-0000-0000-000000000001', 'd3150000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.etat('c3150000-0000-0000-0000-000000000001') = '{"proposees": false, "actives": false}', 'éteintes : non proposées, non actives');
select pg_temp.compte('c3150000-0000-0000-0000-000000000001');
select pg_temp.erreur($q$select activer_alertes_whatsapp('fr', 'vitrine')$q$, '55000', 'pas encore proposées', 'éteintes : accord refusé');
select pg_temp.compte(null);
select pg_temp.promo('e3150000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from prive.nouvelles_promos) = 0, 'éteintes : aucune promo notée');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'éteintes : rien à préparer');
select pg_temp.ok(pg_temp.alertes() = 0, 'éteintes : aucun message');
delete from promos where article_id = 'e3150000-0000-0000-0000-00000000000a';

-- 2. Allumées (sans plafond) : proposées ; suivre ne vaut pas accord ; accord par la case, journalisé.
insert into prive.reglages (cle, valeur) values ('alertes_whatsapp', 'on');
select pg_temp.ok(pg_temp.etat('c3150000-0000-0000-0000-000000000001') = '{"proposees": true, "actives": false}', 'allumées : proposées, pas actives après « Suivre » (suivre ne vaut pas accord)');
select pg_temp.ok(pg_temp.etat(null) = '{"proposees": true, "actives": false}', 'visiteur : jamais actives');
select pg_temp.activer('c3150000-0000-0000-0000-000000000001');
select pg_temp.ok(pg_temp.etat('c3150000-0000-0000-0000-000000000001') = '{"proposees": true, "actives": true}', 'accord : actives');
-- (Tout le test tient dans une transaction : now() ne bouge pas ; l'accord est daté d'une heure avant.)
update prive.alertes_whatsapp set consentie_le = consentie_le - interval '1 hour';
select pg_temp.ok((select count(*) from prive.journal_alertes_whatsapp j where j.profil_id = 'c3150000-0000-0000-0000-000000000001'
  and j.action = 'accord' and j.source = 'vitrine' and j.numero = '+213555315001' and j.texte like 'Recevoir sur WhatsApp les nouvelles promos%(10/10/2026)') = 1,
  'accord journalisé : numéro, source, texte et version de la case');
select pg_temp.activer('c3150000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from prive.journal_alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001') = 1, 'accord répété : pas de doublon au journal');
select pg_temp.ok((select jeton ~ '^[0-9a-f]{48}$' from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001'), 'jeton aléatoire de 48 caractères');
select pg_temp.compte('b3150000-0000-0000-0000-00000000000a');
select pg_temp.erreur($q$select activer_alertes_whatsapp('fr', 'vitrine')$q$, '42501', 'Réservé aux clients', 'commerçant : refusé');
select pg_temp.compte('c3150000-0000-0000-0000-000000000001');
select pg_temp.erreur($q$select activer_alertes_whatsapp('en', 'vitrine')$q$, '22023', 'Paramètre', 'langue inconnue : refusée');
select pg_temp.erreur($q$select activer_alertes_whatsapp('fr', 'lien')$q$, '22023', 'Paramètre', 'source « lien » : pas pour un accord');
select pg_temp.compte(null);
select pg_temp.erreur($q$select activer_alertes_whatsapp('fr', 'vitrine')$q$, '42501', 'Connectez-vous', 'visiteur : refusé');

-- 3. Promos notées (création, réactivation), pas une simple prolongation ni un changement de prix d'une promo en cours.
select pg_temp.promo('e3150000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from prive.nouvelles_promos where boutique_id = 'd3150000-0000-0000-0000-00000000000a') = 1, 'promo créée : notée');
update promos set date_fin = now() + interval '9 days', prix_promo = 3900 where article_id = 'e3150000-0000-0000-0000-00000000000a';
select pg_temp.ok((select count(*) from prive.nouvelles_promos) = 1, 'promo en cours prolongée ou changée : pas notée');
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000a';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000a';
select pg_temp.ok((select count(*) from prive.nouvelles_promos) = 2, 'promo terminée puis réactivée : notée');

-- 4. Plafond absent = 0 : rien n'est écrit.
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'plafond absent : rien à préparer');
select pg_temp.ok(pg_temp.alertes() = 0, 'plafond absent : aucun message');
insert into prive.reglages (cle, valeur) values ('alertes_plafond_mois', '0');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'plafond 0 : arrêt');
update prive.reglages set valeur = '100' where cle = 'alertes_plafond_mois';

-- 5. Un message : boutiques suivies avec du nouveau ; prénom ; jeton jamais dans la file ; identifiant du compte en 3e paramètre.
select pg_temp.suivre('c3150000-0000-0000-0000-000000000001', 'd3150000-0000-0000-0000-00000000000b');
select pg_temp.promo('e3150000-0000-0000-0000-00000000000b');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 1, 'un message pour le client 1');
select pg_temp.ok((select count(*) from messages_whatsapp m where m.modele = 'bledeal_nouvelles_promos' and m.destinataire = '+213555315001'
  and m.commande_id is null and m.langue = 'fr'
  and m.parametres->>0 = 'Amine' and m.parametres->>1 like 'Boutique % et 1 autre(s)' and m.parametres->>2 = 'c3150000-0000-0000-0000-000000000001'
  and m.texte like 'Bonjour Amine, de nouvelles promos sur BleDeal dans les boutiques que vous suivez : Boutique % et 1 autre(s).') = 1,
  'message : prénom, « Boutique … et 1 autre(s) », identifiant du compte (pas le jeton)');
select pg_temp.ok(not exists (select 1 from messages_whatsapp m, prive.alertes_whatsapp a where m.parametres::text like '%' || a.jeton || '%' or m.texte like '%' || a.jeton || '%'),
  'le jeton de désabonnement n''est jamais écrit dans messages_whatsapp');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'deuxième passage le même jour : rien (un par jour au plus)');
select pg_temp.ok(pg_temp.alertes() = 1, 'toujours un seul message');
select pg_temp.promo('e3150000-0000-0000-0000-00000000000d');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'nouvelle promo le même jour : toujours un seul message');

-- 6. Le lendemain : seulement s'il y a du nouveau depuis la dernière alerte.
select pg_temp.vieillir();
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'lendemain sans nouvelle promo : aucun message');
select pg_temp.promo('e3150000-0000-0000-0000-00000000000c');
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'promo d''une boutique non suivie : aucun message');
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000b';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000b';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 1, 'lendemain avec une promo réactivée : un message');
select pg_temp.ok((select parametres->>1 from messages_whatsapp where modele like 'bledeal%' order by cree_le desc limit 1) = 'Boutique Beta',
  'une seule boutique comptée (« Boutique Beta »)');

-- 7. Promo d'une boutique suspendue, promo finie ou article masqué : pas comptés.
select pg_temp.vieillir();
select pg_temp.suivre('c3150000-0000-0000-0000-000000000001', 'd3150000-0000-0000-0000-00000000000c');
update boutiques set statut = 'suspendue' where id = 'd3150000-0000-0000-0000-00000000000c';
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000c';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000c';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'boutique suspendue : pas comptée');
select pg_temp.promo('e3150000-0000-0000-0000-00000000000d');
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000d';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'promo déjà finie : pas comptée');
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000d';
update articles set statut = 'masque' where id = 'e3150000-0000-0000-0000-00000000000d';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 0, 'article masqué : pas compté');
update articles set statut = 'disponible' where id = 'e3150000-0000-0000-0000-00000000000d';

-- 8. Numéro non vérifié, compte bloqué, accord retiré : aucun message ; arabe seulement avec le modèle arabe approuvé.
select pg_temp.vieillir();
select pg_temp.suivre(c, 'd3150000-0000-0000-0000-00000000000a') from unnest(array['c3150000-0000-0000-0000-000000000002',
  'c3150000-0000-0000-0000-000000000003','c3150000-0000-0000-0000-000000000004','c3150000-0000-0000-0000-000000000005']::uuid[]) c;
select pg_temp.activer('c3150000-0000-0000-0000-000000000002', 'ar');
select pg_temp.activer('c3150000-0000-0000-0000-000000000003');
select pg_temp.activer('c3150000-0000-0000-0000-000000000004');
select pg_temp.activer('c3150000-0000-0000-0000-000000000005');
update prive.alertes_whatsapp set consentie_le = consentie_le - interval '1 day';
update profils set bloque = true, bloque_le = now() where id = 'c3150000-0000-0000-0000-000000000003';
select pg_temp.compte('c3150000-0000-0000-0000-000000000005');
select desactiver_alertes_whatsapp();
select pg_temp.compte(null);
select pg_temp.ok((select count(*) from prive.journal_alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000005' and action = 'retrait' and source = 'compte') = 1,
  'retrait depuis le compte : journalisé');
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000a';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000a';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 2, 'clients 1 et 2 seulement (3 bloqué, 4 numéro non vérifié, 5 retiré)');
select pg_temp.ok((select string_agg(destinataire || ':' || modele || ':' || langue, ',' order by destinataire) from messages_whatsapp
  where modele like 'bledeal%' and cree_le > now() - interval '1 minute') = '+213555315001:bledeal_nouvelles_promos:fr,+213555315002:bledeal_nouvelles_promos:fr',
  'arabe demandé mais modèle arabe pas approuvé : français');
select pg_temp.vieillir();
insert into prive.reglages (cle, valeur) values ('alertes_modele_arabe', 'on');
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000a';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000a';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 2, 'modèle arabe approuvé : deux messages');
select pg_temp.ok((select count(*) from messages_whatsapp where destinataire = '+213555315002' and modele = 'bledeal_nouvelles_promos_ar' and langue = 'ar'
  and parametres->>0 = 'Amine' and texte like 'السلام Amine، كاين بروموات جداد في BleDeal%Boutique Alpha.') = 1, 'client arabophone : modèle _ar, texte arabe');

-- 9. Plafond du mois : au-delà, rien.
select pg_temp.vieillir();
update prive.reglages set valeur = (select count(*) + 1 from messages_whatsapp where modele like 'bledeal%'
  and cree_le >= date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers')::text where cle = 'alertes_plafond_mois';
update promos set date_fin = now() - interval '1 hour' where article_id = 'e3150000-0000-0000-0000-00000000000a';
update promos set date_fin = now() + interval '3 days' where article_id = 'e3150000-0000-0000-0000-00000000000a';
select pg_temp.ok(prive.preparer_alertes_whatsapp() = 1, 'plafond du mois : un seul message de plus (le plus ancien accord d''abord)');
select pg_temp.ok((select destinataire from messages_whatsapp where modele like 'bledeal%' order by cree_le desc, destinataire limit 1) = '+213555315001', 'priorité à l''accord le plus ancien');
update prive.reglages set valeur = '100' where cle = 'alertes_plafond_mois';

-- 10. Désabonnement par lien : sans connexion, effet immédiat, journalisé ; lien inconnu ou mal formé : rien.
select pg_temp.compte(null);
select pg_temp.ok(etat_alertes_par_lien((select jeton from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001')) = 'actives', 'lien : état lisible');
select pg_temp.ok(etat_alertes_par_lien(repeat('0', 48)) is null and etat_alertes_par_lien('x'' or 1=1') is null and etat_alertes_par_lien(null) is null, 'lien inconnu ou mal formé : null');
select pg_temp.ok(desactiver_alertes_par_lien((select jeton from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001')) = 'desactivees', 'lien : alertes arrêtées');
select pg_temp.ok(pg_temp.etat('c3150000-0000-0000-0000-000000000001') = '{"proposees": true, "actives": false}', 'arrêt immédiat');
select pg_temp.ok(desactiver_alertes_par_lien((select jeton from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001')) = 'desactivees'
  and (select count(*) from prive.journal_alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001' and action = 'retrait' and source = 'lien') = 1,
  'lien touché deux fois : même réponse, un seul retrait au journal');
select pg_temp.ok(desactiver_alertes_par_lien(repeat('a', 48)) is null and desactiver_alertes_par_lien('abc') is null, 'lien inconnu : rien');
select pg_temp.ok(exists (select 1 from abonnements_boutique where profil_id = 'c3150000-0000-0000-0000-000000000001'), 'désabonné des alertes : suit toujours ses boutiques');

-- 11. Jeton pour le serveur d'envoi : CRON_SECRET exigé ; null si les alertes ont été arrêtées (le message ne part pas).
insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('secret-de-test-alertes-315', 'UTF8')), 'hex'))
  on conflict (cle) do update set valeur = excluded.valeur;
select pg_temp.erreur($q$select jeton_alertes_envoi('mauvais-secret-de-test', 'c3150000-0000-0000-0000-000000000002')$q$, '42501', 'Accès refusé', 'jeton d''envoi : secret exigé');
select pg_temp.ok(jeton_alertes_envoi('secret-de-test-alertes-315', 'c3150000-0000-0000-0000-000000000002') = (select jeton from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000002'),
  'jeton d''envoi : donné pour des alertes actives');
select pg_temp.ok(jeton_alertes_envoi('secret-de-test-alertes-315', 'c3150000-0000-0000-0000-000000000001') is null, 'jeton d''envoi : null après désabonnement');

-- 12. Réactivation : nouvel accord journalisé, même jeton ; promo notée sans bloquer une erreur.
select pg_temp.activer('c3150000-0000-0000-0000-000000000001', 'fr', 'compte');
select pg_temp.ok((select count(*) from prive.journal_alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001' and action = 'accord') = 2
  and (select actif and retiree_le is null from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000001'), 'réactivation depuis le compte : nouvel accord journalisé');
select pg_temp.ok(pg_temp.etat('b3150000-0000-0000-0000-00000000000a') = '{"proposees": true, "actives": false}', 'commerçant : jamais actif');

-- 13. Purge : promos notées de plus de 7 jours supprimées ; compte supprimé : ses alertes et son journal aussi.
update prive.nouvelles_promos set le = now() - interval '8 days';
select prive.preparer_alertes_whatsapp();
select pg_temp.ok((select count(*) from prive.nouvelles_promos) = 0, 'purge des promos notées de plus de 7 jours');
delete from auth.users where id = 'c3150000-0000-0000-0000-000000000002';
select pg_temp.ok(not exists (select 1 from prive.alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000002')
  and not exists (select 1 from prive.journal_alertes_whatsapp where profil_id = 'c3150000-0000-0000-0000-000000000002'), 'compte supprimé : alertes et journal supprimés');

-- 14. Droits : tables privées fermées ; fonctions internes fermées ; lien et état aux visiteurs ; accord aux connectés.
select pg_temp.ok(not has_table_privilege('anon', 'prive.alertes_whatsapp', 'select') and not has_table_privilege('authenticated', 'prive.alertes_whatsapp', 'select')
  and not has_table_privilege('authenticated', 'prive.journal_alertes_whatsapp', 'select') and not has_table_privilege('authenticated', 'prive.nouvelles_promos', 'insert'),
  'tables privées : aucun accès par l''API');
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.preparer_alertes_whatsapp()', 'execute')
  and not has_function_privilege('anon', 'prive.retirer_alertes(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'prive.alertes_proposees()', 'execute')
  and not has_function_privilege('anon', 'prive.noter_nouvelle_promo()', 'execute'), 'fonctions internes : aucun droit');
select pg_temp.ok(has_function_privilege('anon', 'public.desactiver_alertes_par_lien(text)', 'execute')
  and has_function_privilege('anon', 'public.etat_alertes_par_lien(text)', 'execute')
  and has_function_privilege('anon', 'public.etat_alertes_whatsapp()', 'execute')
  and not has_function_privilege('anon', 'public.activer_alertes_whatsapp(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.desactiver_alertes_whatsapp()', 'execute'), 'lien et état : visiteurs ; accord et retrait du compte : connectés');

rollback;

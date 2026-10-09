-- Tests SQL de la migration 20261010180000_limites_visiteurs.sql (limiter les envois en masse).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/limites_visiteurs.test.sql
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

-- Secret du serveur (empreinte dans prive.reglages) ; deux visiteurs anonymes (empreintes d'IP) ; un client.
insert into prive.reglages (cle, valeur) values ('jeton_visiteurs', encode(sha256(convert_to('secret-visiteurs-de-test-123', 'UTF8')), 'hex'))
  on conflict (cle) do update set valeur = excluded.valeur;
\set jeton '''secret-visiteurs-de-test-123'''
\set ip1 '''ip:1111111111111111111111111111111111111111111111111111111111111111'''
\set ip2 '''ip:2222222222222222222222222222222222222222222222222222222222222222'''
insert into auth.users (id, email) values ('c8000000-0000-0000-0000-000000000001', 'client8@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d8000000-0000-0000-0000-000000000001', 'Boutique Limites', 'boutique-limites', 'Centre', '+213555980001', 'validee'),
  ('d8000000-0000-0000-0000-000000000002', 'Boutique Attente', 'boutique-attente-limites', 'Centre', '+213555980002', 'en_attente');
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'Chemise limites', 'Chemises', 3000, 'homme'),
  ('e8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000001', 'Polo limites', 'Chemises', 2000, 'homme'),
  ('e8000000-0000-0000-0000-000000000003', 'd8000000-0000-0000-0000-000000000002', 'Article caché', 'Chemises', 2000, 'homme');

-- ---------------------------------------------------------------------------
-- 1. Plus d'insertion directe avec la clé publique (anon et compte connecté).
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.erreur($$insert into evenements (type, boutique_id) values ('vue_boutique', 'd8000000-0000-0000-0000-000000000001')$$,
  '42501', 'permission denied', 'anonyme : insertion directe dans evenements refusée');
select pg_temp.erreur($$insert into signalements (article_id, motif) values ('e8000000-0000-0000-0000-000000000001', 'arnaque')$$,
  '42501', 'permission denied', 'anonyme : insertion directe dans signalements refusée');
reset role;
set local role authenticated;
select pg_temp.compte('c8000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur($$insert into evenements (type, boutique_id) values ('vue_boutique', 'd8000000-0000-0000-0000-000000000001')$$,
  '42501', 'permission denied', 'compte connecté : insertion directe dans evenements refusée');
select pg_temp.erreur($$insert into signalements (article_id, motif) values ('e8000000-0000-0000-0000-000000000001', 'arnaque')$$,
  '42501', 'permission denied', 'compte connecté : insertion directe dans signalements refusée');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok(not has_table_privilege('anon', 'prive.actions_visiteurs', 'select'), 'table des limites invisible pour le public');

-- ---------------------------------------------------------------------------
-- 2. Fonctions : secret du serveur obligatoire, clé de visiteur contrôlée.
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.erreur($$select enregistrer_evenement('mauvais-secret-0000', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'vue_boutique', 'd8000000-0000-0000-0000-000000000001')$$,
  '42501', 'Accès refusé', 'appel direct sans le secret du serveur : refusé (événement)');
select pg_temp.erreur($$select signaler_article(null, 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'e8000000-0000-0000-0000-000000000001', 'arnaque')$$,
  '42501', 'Accès refusé', 'appel direct sans le secret du serveur : refusé (signalement)');
select pg_temp.erreur($$select enregistrer_evenement('secret-visiteurs-de-test-123', '1.2.3.4', 'vue_boutique', 'd8000000-0000-0000-0000-000000000001')$$,
  '22023', 'Visiteur inconnu', 'anonyme : adresse IP en clair refusée (empreinte obligatoire)');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'anonyme : vue de boutique comptée');
select pg_temp.ok(not enregistrer_evenement(:jeton, :ip1, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'anonyme : même vue dans les 10 minutes ignorée');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip2, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'autre visiteur : sa vue compte');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'vue_article', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001'), 'vue d''article comptée');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'clic_reserver', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'L'), 'clic « Ajouter au panier » compté');
select pg_temp.ok(not enregistrer_evenement(:jeton, :ip1, 'clic_reserver', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'L'), 'même clic répété : ignoré');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'clic_reserver', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'M'), 'clic sur une autre taille : compté');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'partage', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001'), 'partage compté');
select pg_temp.erreur($$select enregistrer_evenement('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'vue_boutique', 'd8000000-0000-0000-0000-000000000002')$$,
  '22023', 'Événement refusé', 'boutique non publique : refusé');
select pg_temp.erreur($$select enregistrer_evenement('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'vue_article', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000003')$$,
  '22023', 'Événement refusé', 'article d''une autre boutique ou invisible : refusé');
reset role;
select pg_temp.ok((select count(*) = 6 from evenements where boutique_id = 'd8000000-0000-0000-0000-000000000001'), '6 événements en base (doublons non comptés)');
select pg_temp.ok((select count(*) = 0 from prive.actions_visiteurs where visiteur !~ '^(ip:[0-9a-f]{64}|u:.+)$'), 'aucune adresse IP en clair enregistrée');

-- Compte connecté : la clé vient de la session, pas de la requête.
set local role authenticated;
select pg_temp.compte('c8000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok(enregistrer_evenement(:jeton, :ip1, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'compte connecté : vue comptée (clé du compte, pas celle de l''IP déjà utilisée)');
select pg_temp.ok(not enregistrer_evenement(:jeton, :ip2, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'compte connecté : changer l''empreinte envoyée ne contourne pas la limite');
select pg_temp.ok(not enregistrer_evenement(:jeton, null, 'vue_boutique', 'd8000000-0000-0000-0000-000000000001'), 'compte connecté : sans empreinte, même clé du compte');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select count(*) = 1 from prive.actions_visiteurs where visiteur = 'u:c8000000-0000-0000-0000-000000000001'), 'compte connecté : une seule action enregistrée');

-- Limite de 300 événements par heure et par visiteur (on simule 300 actions récentes).
insert into prive.actions_visiteurs (visiteur, action, cible, date)
select 'ip:3333333333333333333333333333333333333333333333333333333333333333', 'evenement', 'x' || g, now() - interval '30 minutes' from generate_series(1, 300) g;
set local role anon;
select pg_temp.ok(not enregistrer_evenement(:jeton, 'ip:3333333333333333333333333333333333333333333333333333333333333333', 'vue_article', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000002'),
  '300 événements dans l''heure : le suivant est ignoré');
select pg_temp.ok(enregistrer_evenement(:jeton, :ip2, 'vue_article', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000002'), 'les autres visiteurs ne sont pas gênés');
reset role;
-- Les lignes de plus de 24 h sont supprimées au fil de l'eau.
update prive.actions_visiteurs set date = now() - interval '25 hours' where visiteur like 'ip:3333%';
set local role anon;
select pg_temp.ok(enregistrer_evenement(:jeton, 'ip:3333333333333333333333333333333333333333333333333333333333333333', 'vue_article', 'd8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000002'),
  'après une heure : le visiteur est de nouveau compté');
reset role;
select pg_temp.ok((select count(*) = 1 from prive.actions_visiteurs where visiteur like 'ip:3333%'), 'actions de plus de 24 h supprimées');
-- La limite globale de la PR #2 (120 par minute et par boutique) reste active.
select pg_temp.ok((select count(*) from pg_trigger where tgname in ('evenement_controle', 'signalement_controle')) = 2, 'limites globales de la PR #2 toujours en place');

-- ---------------------------------------------------------------------------
-- 3. Signalements : un par article et par visiteur en 24 h, 5 par heure.
-- ---------------------------------------------------------------------------
set local role anon;
select signaler_article(:jeton, :ip1, 'e8000000-0000-0000-0000-000000000001', 'arnaque', '  À vérifier  ') \g /dev/null
reset role;
select pg_temp.ok((select count(*) = 1 and bool_and(statut = 'ouvert' and commentaire = 'À vérifier') from signalements where article_id = 'e8000000-0000-0000-0000-000000000001'),
  'anonyme : signalement enregistré (ouvert, commentaire nettoyé)');
set local role anon;
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'e8000000-0000-0000-0000-000000000001', 'autre')$$,
  '54000', 'Vous avez déjà signalé cet article', 'même visiteur, même article : refusé');
select signaler_article(:jeton, :ip2, 'e8000000-0000-0000-0000-000000000001', 'contrefacon') \g /dev/null
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'e8000000-0000-0000-0000-000000000002', 'inconnu')$$,
  '22023', 'Choisissez un motif', 'motif inconnu : refusé');
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'e8000000-0000-0000-0000-000000000002', 'autre', repeat('a', 1001))$$,
  '22023', '1000 caractères', 'commentaire trop long : refusé');
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'e8000000-0000-0000-0000-000000000003', 'autre')$$,
  '22023', 'plus en ligne', 'article invisible : refusé');
reset role;
select pg_temp.ok((select count(*) = 2 from signalements where article_id = 'e8000000-0000-0000-0000-000000000001'), 'un autre visiteur peut signaler le même article');
insert into prive.actions_visiteurs (visiteur, action, cible, date)
select 'ip:4444444444444444444444444444444444444444444444444444444444444444', 'signalement', 'autre-article-' || g, now() - interval '10 minutes' from generate_series(1, 5) g;
set local role anon;
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:4444444444444444444444444444444444444444444444444444444444444444', 'e8000000-0000-0000-0000-000000000002', 'autre')$$,
  '54000', 'Trop de signalements envoyés', '5 signalements dans l''heure : le 6e est refusé');
reset role;
set local role authenticated;
select pg_temp.compte('c8000000-0000-0000-0000-000000000001') \g /dev/null
select signaler_article(:jeton, null, 'e8000000-0000-0000-0000-000000000002', 'autre') \g /dev/null
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', 'ip:9999999999999999999999999999999999999999999999999999999999999999', 'e8000000-0000-0000-0000-000000000002', 'autre')$$,
  '54000', 'déjà signalé', 'compte connecté : changer l''empreinte envoyée ne permet pas de re-signaler');
select pg_temp.compte(null) \g /dev/null
reset role;

rollback;
\echo 'Tous les tests SQL des limites par visiteur passent.'

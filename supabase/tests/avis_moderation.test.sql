-- Tests SQL de la migration 20261019100000_avis_moderation.sql (US-32.4 : réponse, espace, signalement, modération).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/avis_moderation.test.sql
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

grant execute on function pg_temp.ok(boolean, text), pg_temp.erreur(text, text, text, text), pg_temp.compte(uuid) to anon, authenticated;

\set jeton '''secret-visiteurs-de-test-123'''
\set ip1 '''ip:1111111111111111111111111111111111111111111111111111111111111111'''
\set ip2 '''ip:2222222222222222222222222222222222222222222222222222222222222222'''
insert into prive.reglages (cle, valeur) values ('jeton_visiteurs', encode(sha256(convert_to('secret-visiteurs-de-test-123', 'UTF8')), 'hex'))
  on conflict (cle) do update set valeur = excluded.valeur;

-- Boutique A (validée, Oran) avec son commerçant ; boutique B et son commerçant ; un admin ; deux clients.
insert into auth.users (id, email) values
  ('c3240000-0000-0000-0000-000000000001', 'amine324@test.dz'), ('c3240000-0000-0000-0000-000000000002', 'sara324@test.dz'),
  ('b3240000-0000-0000-0000-000000000001', 'boutiquea324@test.dz'), ('b3240000-0000-0000-0000-000000000002', 'boutiqueb324@test.dz'),
  ('a3240000-0000-0000-0000-000000000001', 'admin324@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3240000-0000-0000-0000-000000000001', 'Boutique Nour', 'boutique-nour-324', 'Gambetta', '+213555324001', 'validee', 'oran'),
  ('d3240000-0000-0000-0000-000000000002', 'Dar Lebsa', 'dar-lebsa-324', 'Centre', '+213555324002', 'validee', 'oran');
update profils set nom = 'Amine Benali' where id = 'c3240000-0000-0000-0000-000000000001';
update profils set nom = 'Sara Kaci' where id = 'c3240000-0000-0000-0000-000000000002';
update profils set role = 'commercant', boutique_id = 'd3240000-0000-0000-0000-000000000001' where id = 'b3240000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd3240000-0000-0000-0000-000000000002' where id = 'b3240000-0000-0000-0000-000000000002';
update profils set role = 'admin' where id = 'a3240000-0000-0000-0000-000000000001';

set local session_replication_role = replica;
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, terminee_le) values
  ('e3240000-0000-0000-0000-000000000001', 'c3240000-0000-0000-0000-000000000001', 'd3240000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'qr', now() - interval '2 days'),
  ('e3240000-0000-0000-0000-000000000002', 'c3240000-0000-0000-0000-000000000002', 'd3240000-0000-0000-0000-000000000001', 'recuperee', 'Sara', '+213555000002', 3500, 'qr', now() - interval '1 day'),
  ('e3240000-0000-0000-0000-000000000003', 'c3240000-0000-0000-0000-000000000001', 'd3240000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'qr', now() - interval '1 day');
insert into avis (id, commande_id, boutique_id, client_id, note, criteres, commentaire, cree_le) values
  ('f3240000-0000-0000-0000-000000000001', 'e3240000-0000-0000-0000-000000000001', 'd3240000-0000-0000-0000-000000000001', 'c3240000-0000-0000-0000-000000000001', 5, '{accueil}', 'Très bon accueil.', now() - interval '2 days'),
  ('f3240000-0000-0000-0000-000000000002', 'e3240000-0000-0000-0000-000000000002', 'd3240000-0000-0000-0000-000000000001', 'c3240000-0000-0000-0000-000000000002', 3, '{}', 'Un peu d''attente au retrait.', now() - interval '1 day'),
  ('f3240000-0000-0000-0000-000000000003', 'e3240000-0000-0000-0000-000000000003', 'd3240000-0000-0000-0000-000000000001', 'c3240000-0000-0000-0000-000000000001', 4, '{}', null, now() - interval '1 hour');
set local session_replication_role = origin;

-- 1. Réponse de la boutique.
set local role authenticated;
select pg_temp.compte('c3240000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Merci')$$, '42501', 'Réservé à la boutique', 'client : ne répond pas');
select pg_temp.compte('a3240000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Merci')$$, '42501', 'Réservé à la boutique', 'admin : ne répond pas à la place de la boutique');
select pg_temp.compte('b3240000-0000-0000-0000-000000000002');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Merci')$$, 'P0002', 'Avis introuvable', 'autre boutique : avis introuvable');
select pg_temp.compte('b3240000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', '   ')$$, '22023', 'Écrivez votre réponse', 'réponse vide refusée');
select pg_temp.erreur(format('select repondre_avis(%L, %L)', 'f3240000-0000-0000-0000-000000000001', repeat('a', 301)), '22023', '300 caractères', 'réponse de 301 caractères refusée');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Appelez le 0555 12 34 56')$$, '22023', 'ne peut pas contenir de lien', 'réponse : même filtre (numéro)');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Allez sur www.ailleurs.dz')$$, '22023', 'ne peut pas contenir de lien', 'réponse : même filtre (lien)');
select repondre_avis('f3240000-0000-0000-0000-000000000001', '  Merci Amine, à bientôt !  ') \g /dev/null
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000001', 'Autre réponse')$$, '23505', 'déjà répondu', 'une seule réponse, non modifiable');
select pg_temp.erreur($$update avis set reponse = 'x'$$, '42501', 'permission denied', 'boutique : pas d''écriture directe');
select pg_temp.erreur($$delete from avis$$, '42501', 'permission denied', 'boutique : ne supprime pas un avis');

-- 2. Avis dans l'espace.
select pg_temp.ok((select count(*) from avis) = 0, 'boutique : pas de lecture de la table');
select pg_temp.ok((select array_agg(id::text order by ordinality) from avis_ma_boutique() with ordinality)
  = array['f3240000-0000-0000-0000-000000000003', 'f3240000-0000-0000-0000-000000000002', 'f3240000-0000-0000-0000-000000000001'],
  'avis_ma_boutique : sans réponse d''abord, puis les plus récents');
select pg_temp.ok((select auteur = 'Amine B.' and reponse = 'Merci Amine, à bientôt !' and reponse_le is not null from avis_ma_boutique() where id = 'f3240000-0000-0000-0000-000000000001'),
  'avis_ma_boutique : « Amine B. », réponse enregistrée sans espaces autour');
select pg_temp.ok((select nombre = 3 and moyenne = 4.0 and sans_reponse = 2 from resume_ma_boutique()), 'resume_ma_boutique : 3 avis, ★ 4,0, 2 sans réponse');
select pg_temp.compte('b3240000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from avis_ma_boutique()) = 0 and (select nombre = 0 and moyenne is null and sans_reponse = 0 from resume_ma_boutique()), 'autre boutique : rien');
select pg_temp.compte('c3240000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from avis_ma_boutique()) = 0, 'client : avis_ma_boutique vide');

-- 3. Signalement d'un avis (visiteur, client ou boutique), mêmes limites que signaler_article.
select pg_temp.compte(null);
reset role;
set local role anon;
select pg_temp.erreur($$select signaler_avis('mauvais-jeton-de-test-0000', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'f3240000-0000-0000-0000-000000000002', 'faux_avis')$$, '42501', 'Accès refusé', 'sans le secret : refusé');
select pg_temp.erreur($$select signaler_avis('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'f3240000-0000-0000-0000-000000000002', 'contrefacon')$$, '22023', 'Choisissez un motif', 'motif d''article refusé');
select pg_temp.erreur(format('select signaler_avis(%L, %L, %L, %L, %L)', 'secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'f3240000-0000-0000-0000-000000000002', 'autre', repeat('a', 1001)), '22023', '1000 caractères', 'commentaire de 1001 caractères refusé');
select pg_temp.erreur($$select signaler_avis('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'f3240000-0000-0000-0000-0000000000ff', 'autre')$$, '22023', 'plus en ligne', 'avis inconnu refusé');
select signaler_avis(:jeton, :ip1, 'f3240000-0000-0000-0000-000000000002', 'faux_avis', '  Pas une cliente  ') \g /dev/null
select pg_temp.erreur($$select signaler_avis('secret-visiteurs-de-test-123', 'ip:1111111111111111111111111111111111111111111111111111111111111111', 'f3240000-0000-0000-0000-000000000002', 'insulte')$$, '54000', 'déjà signalé cet avis', 'même visiteur, même avis : une fois par jour');
select signaler_avis(:jeton, :ip2, 'f3240000-0000-0000-0000-000000000002', 'faux_avis') \g /dev/null
select pg_temp.erreur($$select * from signalements_avis$$, '42501', 'permission denied', 'visiteur : ne lit pas les signalements');
reset role;
select pg_temp.ok((select count(*) = 2 and min(commentaire) = 'Pas une cliente' and bool_and(statut = 'ouvert') from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002'),
  '2 signalements ouverts, commentaire sans espaces autour');
-- Limite par heure partagée avec les signalements d'articles.
insert into prive.actions_visiteurs (visiteur, action, cible) select 'ip:3333333333333333333333333333333333333333333333333333333333333333', 'signalement', 'x' || g from generate_series(1, 5) g;
set local role anon;
select pg_temp.erreur($$select signaler_avis('secret-visiteurs-de-test-123', 'ip:3333333333333333333333333333333333333333333333333333333333333333', 'f3240000-0000-0000-0000-000000000001', 'autre')$$, '54000', 'réessayez dans une heure', '5 signalements (articles et avis) par heure et par visiteur');
reset role;
set local role authenticated;
select pg_temp.compte('b3240000-0000-0000-0000-000000000001');
select signaler_avis(:jeton, null, 'f3240000-0000-0000-0000-000000000003', 'insulte') \g /dev/null
select pg_temp.ok(true, 'la boutique peut signaler un avis (clé de compte)');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000002', 'masquer_avis', array(select id from signalements_avis))$$, '42501', 'Accès réservé', 'boutique : ne modère pas');
select pg_temp.erreur($$select signaler_article('secret-visiteurs-de-test-123', null, 'f3240000-0000-0000-0000-000000000003', 'arnaque')$$, '22023', 'plus en ligne', 'signaler_article inchangé (un avis n''est pas un article)');

-- 4. Modération par l'admin.
select pg_temp.compte('a3240000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from signalements_avis) = 3, 'admin : lit les signalements d''avis');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000002', 'supprimer', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002'))$$, '22023', 'action valide', 'action inconnue refusée');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000002', 'masquer_avis', '{}')$$, '22023', 'Aucun signalement', 'sans signalement : refusé');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000002', 'masquer_avis', array(select id from signalements_avis))$$, '22023', 'ont changé', 'signalement d''un autre avis : refusé');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000003', 'masquer_reponse', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000003'))$$, '22023', 'pas de réponse', 'masquer la réponse d''un avis sans réponse : refusé');
select moderer_avis('f3240000-0000-0000-0000-000000000002', 'masquer_avis', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002')) \g /dev/null
select pg_temp.ok((select statut = 'masque' from avis where id = 'f3240000-0000-0000-0000-000000000002'), 'masquer l''avis : avis masqué');
select pg_temp.ok((select bool_and(statut = 'traite') from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002'), 'signalements traités');
select pg_temp.ok((select count(*) = 2 and bool_and(action = 'masquer_avis' and signalement_id is null and auteur_id = 'a3240000-0000-0000-0000-000000000001')
  from decisions where signalement_avis_id in (select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002')), 'une décision par signalement, auteur = admin');
select pg_temp.erreur($$select moderer_avis('f3240000-0000-0000-0000-000000000002', 'classer_signalement_avis', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000002'))$$, '22023', 'ont changé', 'signalements déjà traités : refusé');
select moderer_avis('f3240000-0000-0000-0000-000000000003', 'classer_signalement_avis', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000003')) \g /dev/null
select pg_temp.ok((select statut = 'publie' from avis where id = 'f3240000-0000-0000-0000-000000000003')
  and (select bool_and(statut = 'rejete') from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000003'), 'classer : avis gardé, signalement rejeté');
reset role;
-- Masquer la réponse.
set local role anon;
select signaler_avis(:jeton, :ip2, 'f3240000-0000-0000-0000-000000000001', 'informations_personnelles') \g /dev/null
reset role;
set local role authenticated;
select pg_temp.compte('a3240000-0000-0000-0000-000000000001');
select moderer_avis('f3240000-0000-0000-0000-000000000001', 'masquer_reponse', array(select id from signalements_avis where avis_id = 'f3240000-0000-0000-0000-000000000001')) \g /dev/null
select pg_temp.ok((select statut = 'publie' and reponse_masquee and reponse = 'Merci Amine, à bientôt !' from avis where id = 'f3240000-0000-0000-0000-000000000001'), 'masquer la réponse : avis gardé, réponse gardée en base mais masquée');

-- 5. Effets publics.
select pg_temp.compte(null);
reset role;
set local role anon;
select pg_temp.ok((select count(*) from avis_boutique('d3240000-0000-0000-0000-000000000001')) = 2, 'avis masqué : plus lisible');
select pg_temp.ok((select reponse is null from avis_boutique('d3240000-0000-0000-0000-000000000001') where id = 'f3240000-0000-0000-0000-000000000001'), 'réponse masquée : plus lisible');
select pg_temp.ok((select nombre = 2 and moyenne is null from resume_avis(array['d3240000-0000-0000-0000-000000000001'::uuid])), 'avis masqué : ne compte plus (2 avis, sous le seuil)');
select pg_temp.erreur($$select signaler_avis('secret-visiteurs-de-test-123', 'ip:2222222222222222222222222222222222222222222222222222222222222222', 'f3240000-0000-0000-0000-000000000002', 'autre')$$, '22023', 'plus en ligne', 'avis masqué : ne se signale plus');
select pg_temp.erreur($$select avis_ma_boutique()$$, '42501', 'permission denied', 'visiteur : pas d''espace');
reset role;
set local role authenticated;
select pg_temp.compte('b3240000-0000-0000-0000-000000000001');
select pg_temp.ok((select reponse_masquee from avis_ma_boutique() where id = 'f3240000-0000-0000-0000-000000000001'), 'la boutique voit que sa réponse est masquée');
select pg_temp.ok((select nombre = 2 and sans_reponse = 1 from resume_ma_boutique()), 'espace : l''avis masqué ne compte plus');
select pg_temp.erreur($$select repondre_avis('f3240000-0000-0000-0000-000000000002', 'Merci')$$, 'P0002', 'Avis introuvable', 'avis masqué : pas de réponse');
reset role;

-- 7. Signal de fraude (admin seulement, jamais bloquant).
set local role authenticated;
select pg_temp.compte('b3240000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select * from signaux_avis()$$, '42501', 'Accès réservé', 'boutique : pas de signaux');
select pg_temp.compte('a3240000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from signaux_avis()) = 0, 'signaux : rien sous 3 avis 5 étoiles de comptes récents');
reset role;
insert into auth.users (id, email) select ('c3249000-0000-0000-0000-00000000000' || g)::uuid, 'nouveau' || g || '@test.dz' from generate_series(1, 3) g;
set local session_replication_role = replica;
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, terminee_le)
  select ('e3249000-0000-0000-0000-00000000000' || g)::uuid, ('c3249000-0000-0000-0000-00000000000' || g)::uuid, 'd3240000-0000-0000-0000-000000000002', 'recuperee', 'N', '+21355500900' || g, 1000, 'qr', now() from generate_series(1, 3) g;
insert into avis (commande_id, boutique_id, client_id, note)
  select ('e3249000-0000-0000-0000-00000000000' || g)::uuid, 'd3240000-0000-0000-0000-000000000002', ('c3249000-0000-0000-0000-00000000000' || g)::uuid, 5 from generate_series(1, 3) g;
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.ok((select array_agg(boutique || ':' || cinq_etoiles_comptes_recents) from signaux_avis()) = array['Dar Lebsa:3'], 'signaux : Dar Lebsa, 3 avis 5 étoiles de comptes récents');
reset role;

-- 6. Décisions : une seule cible.
select pg_temp.erreur($$insert into decisions (action, auteur_id) values ('classer', 'a3240000-0000-0000-0000-000000000001')$$, '23514', 'decisions_une_cible', 'décision sans cible refusée');
select pg_temp.erreur($$insert into decisions (signalement_id, signalement_avis_id, action, auteur_id) values (gen_random_uuid(), gen_random_uuid(), 'classer', 'a3240000-0000-0000-0000-000000000001')$$, '23514', 'decisions_une_cible', 'décision avec deux cibles refusée');
select pg_temp.ok(not has_function_privilege('anon', 'public.repondre_avis(uuid, text)', 'execute') and not has_function_privilege('anon', 'public.moderer_avis(uuid, text, uuid[])', 'execute')
  and has_function_privilege('anon', 'public.signaler_avis(text, text, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'prive.boutique_du_commercant()', 'execute'), 'droits des fonctions');

rollback;

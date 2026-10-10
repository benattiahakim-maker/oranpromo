-- Tests SQL de la migration 20261010190000_confirmer_whatsapp.sql (US-20.6 : confirmer depuis WhatsApp).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/confirmer_whatsapp.test.sql
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

-- Secret du serveur ; une boutique (commerçant), une autre boutique, trois clients ; un article à 2 pièces en M.
insert into prive.reglages (cle, valeur) values ('jeton_confirmation', encode(sha256(convert_to('secret-confirmation-de-test', 'UTF8')), 'hex'))
  on conflict (cle) do update set valeur = excluded.valeur;
delete from prive.reglages where cle = 'bouton_confirmer';
\set jeton '''secret-confirmation-de-test'''
insert into auth.users (id, email) values
  ('b9000000-0000-0000-0000-000000000001', 'boutique9@test.dz'),
  ('c9000000-0000-0000-0000-000000000001', 'client91@test.dz'),
  ('c9000000-0000-0000-0000-000000000002', 'client92@test.dz'),
  ('c9000000-0000-0000-0000-000000000003', 'client93@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d9000000-0000-0000-0000-000000000001', 'Boutique Lien', 'boutique-lien-confirmer', 'Centre', '+213555990001', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd9000000-0000-0000-0000-000000000001' where id = 'b9000000-0000-0000-0000-000000000001';
update profils set nom = 'Samia', telephone = '+213555190001' where id = 'c9000000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555190002' where id = 'c9000000-0000-0000-0000-000000000002';
update profils set nom = 'Yacine', telephone = '+213555190003' where id = 'c9000000-0000-0000-0000-000000000003';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e9000000-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000001', 'Polo lien', 'T-shirts et polos', 3500, 'homme');
insert into tailles (article_id, libelle, disponible) values ('e9000000-0000-0000-0000-000000000001', 'M', true);
update tailles set quantite = 2 where article_id = 'e9000000-0000-0000-0000-000000000001';

create function pg_temp.commande(client uuid, quantite integer default 1) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d9000000-0000-0000-0000-000000000001',
    format('[{"article_id":"e9000000-0000-0000-0000-000000000001","taille":"M","quantite":%s}]', quantite)::jsonb);
  perform pg_temp.compte(null);
  return c;
end $$;

set local role authenticated;
select pg_temp.commande('c9000000-0000-0000-0000-000000000001') as c1 \gset
reset role;

-- ---------------------------------------------------------------------------
-- 1. Message « nouvelle commande » : ancien modèle par défaut, modèle avec bouton après l'interrupteur.
-- ---------------------------------------------------------------------------
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c1') = 'oranpromo_nouvelle_commande'
  and (select jsonb_array_length(parametres) from messages_whatsapp where commande_id = :'c1') = 4,
  'sans interrupteur : ancien modèle sans bouton (4 paramètres)');
insert into prive.reglages (cle, valeur) values ('bouton_confirmer', 'on');
set local role authenticated;
select pg_temp.commande('c9000000-0000-0000-0000-000000000002') as c2 \gset
reset role;
select pg_temp.ok((select modele from messages_whatsapp where commande_id = :'c2') = 'oranpromo_nouvelle_commande_confirmer',
  'interrupteur « on » : modèle oranpromo_nouvelle_commande_confirmer');
select pg_temp.ok((select parametres->>4 from messages_whatsapp where commande_id = :'c2') = :'c2'
  and (select jsonb_array_length(parametres) from messages_whatsapp where commande_id = :'c2') = 5,
  '5e paramètre = identifiant de la commande (remplacé par le lien signé à l''envoi)');
select pg_temp.ok((select texte from messages_whatsapp where commande_id = :'c2') like 'Nouvelle commande n° % Touchez Confirmer, ou confirmez-la dans votre espace OranPromo, rubrique Commandes.'
  and (select texte from messages_whatsapp where commande_id = :'c2') not like '%' || :'c2' || '%',
  'texte du message : « Touchez Confirmer… », sans l''identifiant');
set local role authenticated;
select pg_temp.compte('c9000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok((select count(*) from messages_whatsapp_commande(:'c2') where modele = 'oranpromo_nouvelle_commande_confirmer') = 1,
  'le nouveau modèle part tout de suite après la commande');
select pg_temp.compte(null) \g /dev/null
reset role;

-- ---------------------------------------------------------------------------
-- 2. Secret du serveur obligatoire (clé publique seule : refus).
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.erreur(format('select confirmer_commande_par_lien(%L, %L)', 'mauvais-secret-000000', :'c1'), '42501', 'Accès refusé',
  'anonyme sans le secret : confirmation refusée');
select pg_temp.erreur(format('select confirmer_commande_par_lien(null, %L)', :'c1'), '42501', 'Accès refusé', 'secret absent : refusé');
select pg_temp.erreur(format('select commande_a_confirmer(%L, %L)', 'mauvais-secret-000000', :'c1'), '42501', 'Accès refusé',
  'anonyme sans le secret : lecture de la commande refusée');
reset role;
select pg_temp.ok((select statut from commandes where id = :'c1') = 'demandee', 'après les refus : la commande reste « demandée »');

-- ---------------------------------------------------------------------------
-- 3. Page du lien : lecture sans effet, sans téléphone du client.
-- ---------------------------------------------------------------------------
set local role anon;
select commande_a_confirmer(:jeton, :'c1') as vue \gset
reset role;
select pg_temp.ok((:'vue'::jsonb)->>'client' = 'Samia' and (:'vue'::jsonb)->>'boutique' = 'Boutique Lien'
  and (:'vue'::jsonb)->>'statut' = 'demandee' and ((:'vue'::jsonb)->>'total')::int = 3500
  and jsonb_array_length((:'vue'::jsonb)->'lignes') = 1 and (:'vue'::jsonb)->'lignes'->0->>'taille' = 'M',
  'page : numéro, client, boutique, lignes, total');
select pg_temp.ok(position('+213' in :'vue') = 0 and position('telephone' in :'vue') = 0, 'page : pas de téléphone du client');
select pg_temp.ok((select statut from commandes where id = :'c1') = 'demandee'
  and (select quantite from tailles where article_id = 'e9000000-0000-0000-0000-000000000001') = 2,
  'ouvrir la page ne confirme rien (statut et stock inchangés)');
set local role anon;
select pg_temp.ok(commande_a_confirmer(:jeton, '00000000-0000-0000-0000-000000000000') is null, 'page : commande inconnue → rien');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Confirmation : mêmes règles que le bouton du site, une seule fois.
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.ok(confirmer_commande_par_lien(:jeton, :'c1') = 'confirmee', 'lien : commande confirmée');
reset role;
select pg_temp.ok((select statut from commandes where id = :'c1') = 'confirmee'
  and (select confirmee_le from commandes where id = :'c1') is not null, 'statut « confirmée » et date de confirmation');
select pg_temp.ok((select quantite from tailles where article_id = 'e9000000-0000-0000-0000-000000000001') = 1, 'le stock baisse (2 → 1)');
select pg_temp.ok(exists (select 1 from suivi_commandes where commande_id = :'c1' and statut = 'confirmee' and auteur = 'boutique'
  and auteur_id is null and note = 'Confirmée depuis WhatsApp.'), 'suivi : « Confirmée depuis WhatsApp. », auteur boutique');
set local role anon;
select pg_temp.ok(confirmer_commande_par_lien(:jeton, :'c1') = 'deja_confirmee', 'deuxième touche : « déjà confirmée » (usage unique)');
reset role;
select pg_temp.ok((select quantite from tailles where article_id = 'e9000000-0000-0000-0000-000000000001') = 1
  and (select count(*) from suivi_commandes where commande_id = :'c1' and statut = 'confirmee') = 1,
  'deuxième touche : stock et suivi inchangés');
-- Prête puis récupérée : toujours « déjà confirmée ».
set local role authenticated;
select pg_temp.compte('b9000000-0000-0000-0000-000000000001') \g /dev/null
select changer_statut_commande(:'c1', 'prete') \g /dev/null
select pg_temp.compte(null) \g /dev/null
set local role anon;
select pg_temp.ok(confirmer_commande_par_lien(:jeton, :'c1') = 'deja_confirmee', 'commande prête : « déjà confirmée »');
reset role;

-- Stock insuffisant : même refus que sur le site, rien ne change.
set local role authenticated;
select pg_temp.commande('c9000000-0000-0000-0000-000000000003') as c3 \gset
reset role;
-- La boutique vend la dernière pièce en direct : stock 0.
update tailles set quantite = 0 where article_id = 'e9000000-0000-0000-0000-000000000001';
set local role anon;
select pg_temp.erreur(format('select confirmer_commande_par_lien(%L, %L)', :jeton, :'c3'), '23514', 'Stock insuffisant pour « Polo lien » en taille M',
  'stock insuffisant : refus « Stock insuffisant pour … » comme sur le site');
reset role;
select pg_temp.ok((select statut from commandes where id = :'c3') = 'demandee'
  and (select quantite from tailles where article_id = 'e9000000-0000-0000-0000-000000000001') = 0,
  'stock insuffisant : commande « demandée », stock inchangé');

-- Annulée, expirée, inconnue.
set local role authenticated;
select pg_temp.compte('c9000000-0000-0000-0000-000000000002') \g /dev/null
select changer_statut_commande(:'c2', 'annulee') \g /dev/null
select pg_temp.compte(null) \g /dev/null
set local role anon;
select pg_temp.ok(confirmer_commande_par_lien(:jeton, :'c2') = 'annulee', 'commande annulée : « annulée », rien à confirmer');
reset role;
select pg_temp.ok((select statut from commandes where id = :'c2') = 'annulee', 'commande annulée : reste annulée');
update commandes set statut = 'expiree' where id = :'c3';
set local role anon;
select pg_temp.ok(confirmer_commande_par_lien(:jeton, :'c3') = 'expiree', 'commande expirée : « expirée »');
select pg_temp.erreur(format('select confirmer_commande_par_lien(%L, %L)', :jeton, '00000000-0000-0000-0000-000000000000'), 'P0002', 'pas valide',
  'commande inconnue : « Ce lien n''est pas valide. »');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Le bouton du site garde ses règles (fonction commune prive.confirmer_commande).
-- ---------------------------------------------------------------------------
update tailles set quantite = 1 where article_id = 'e9000000-0000-0000-0000-000000000001';
update commandes set cree_le = now() - interval '2 hours' where boutique_id = 'd9000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.commande('c9000000-0000-0000-0000-000000000003') as c4 \gset
select pg_temp.compte('b9000000-0000-0000-0000-000000000001') \g /dev/null
select changer_statut_commande(:'c4', 'confirmee') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'c4') = 'confirmee'
  and (select quantite from tailles where article_id = 'e9000000-0000-0000-0000-000000000001') = 0
  and exists (select 1 from suivi_commandes where commande_id = :'c4' and statut = 'confirmee' and auteur = 'boutique'
              and auteur_id = 'b9000000-0000-0000-0000-000000000001'),
  'site : « Confirmer » baisse toujours le stock, suivi avec le commerçant');
select pg_temp.ok(not has_function_privilege('anon', 'prive.confirmer_commande(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.confirmer_commande(uuid)', 'execute'),
  'prive.confirmer_commande : jamais appelable directement');
select pg_temp.ok(not has_function_privilege('anon', 'public.changer_statut_commande(uuid, statut_commande, text, text)', 'execute'),
  'changer_statut_commande : toujours réservé aux comptes connectés');

rollback;

-- Tests SQL de la migration 20261011090000_messages_contenance.sql (US-25.4).
-- Messages de la base : « contenance » pour les produits de beauté, « taille » pour la mode ; rien d'autre ne change.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/messages_contenance.test.sql
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

-- Vérifie que la requête échoue avec ce code et EXACTEMENT ce message.
create function pg_temp.erreur(requete text, code text, message text, nom text) returns text language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    if sqlstate = code and sqlerrm = message then return 'ok - ' || nom; end if;
    raise exception 'ÉCHEC - % : erreur % « % »', nom, sqlstate, sqlerrm;
  end;
  raise exception 'ÉCHEC - % : aucune erreur', nom;
end $$;

create function pg_temp.compte(id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(id::text, ''), true);
$$;

insert into auth.users (id, email) values
  ('b5000000-0000-0000-0000-000000000001', 'parfumerie@test.dz'),
  ('b5000000-0000-0000-0000-000000000002', 'mode@test.dz'),
  ('c5000000-0000-0000-0000-000000000001', 'cliente1@test.dz'),
  ('c5000000-0000-0000-0000-000000000002', 'cliente2@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d5000000-0000-0000-0000-000000000001', 'Parfumerie Test', 'parfumerie-test', 'Gambetta', '+213555950001', 'validee'),
  ('d5000000-0000-0000-0000-000000000002', 'Mode Test', 'mode-test', 'Centre', '+213555950002', 'validee');
update profils set role = 'commercant', boutique_id = 'd5000000-0000-0000-0000-000000000001' where id = 'b5000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd5000000-0000-0000-0000-000000000002' where id = 'b5000000-0000-0000-0000-000000000002';
update profils set nom = 'Samia', telephone = '+213555150001' where id = 'c5000000-0000-0000-0000-000000000001';
update profils set nom = 'Karim', telephone = '+213555150002' where id = 'c5000000-0000-0000-0000-000000000002';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'Parfum test', 'Parfums', 5000, 'mixte'),
  ('e5000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000001', 'Rouge test', 'Maquillage', 1500, 'mixte'),
  ('e5000000-0000-0000-0000-000000000003', 'd5000000-0000-0000-0000-000000000002', 'Polo test', 'T-shirts et polos', 4000, 'homme');
insert into tailles (article_id, libelle, quantite) values
  ('e5000000-0000-0000-0000-000000000001', '100 ml', 1), ('e5000000-0000-0000-0000-000000000001', '50 ml', 3),
  ('e5000000-0000-0000-0000-000000000002', 'Unique', 2),
  ('e5000000-0000-0000-0000-000000000003', 'M', 1), ('e5000000-0000-0000-0000-000000000003', 'L', 3);

set local role authenticated;
select pg_temp.compte('c5000000-0000-0000-0000-000000000001') \g /dev/null

-- ---------------------------------------------------------------------------
-- passer_commande : stock insuffisant, taille disparue, ligne en double
-- ---------------------------------------------------------------------------
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"100 ml","quantite":2}]')$$,
  '23514', 'Il ne reste que 1 pièce(s) en contenance 100 ml pour « Parfum test ».', 'beauté (Parfums) : « Il ne reste que 1 pièce(s) en contenance 100 ml … » (23514)');
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000002","taille":"Unique","quantite":3}]')$$,
  '23514', 'Il ne reste que 2 pièce(s) en contenance Unique pour « Rouge test ».', 'beauté (Maquillage) : « … en contenance Unique … »');
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000002', '[{"article_id":"e5000000-0000-0000-0000-000000000003","taille":"M","quantite":2}]')$$,
  '23514', 'Il ne reste que 1 pièce(s) en taille M pour « Polo test ».', 'mode : « Il ne reste que 1 pièce(s) en taille M … » inchangé');

select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"30 ml","quantite":1}]')$$,
  'P0002', 'La contenance 30 ml de « Parfum test » n''existe plus : retirez-la du panier.', 'beauté : « La contenance 30 ml de … n''existe plus » (P0002)');
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000002', '[{"article_id":"e5000000-0000-0000-0000-000000000003","taille":"XL","quantite":1}]')$$,
  'P0002', 'La taille XL de « Polo test » n''existe plus : retirez-la du panier.', 'mode : « La taille XL de … n''existe plus » inchangé');

select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"50 ml","quantite":1},{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"50 ml","quantite":1}]')$$,
  '23514', 'Le même article et la même contenance apparaissent deux fois dans le panier.', 'beauté : « la même contenance apparaissent deux fois »');
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000002', '[{"article_id":"e5000000-0000-0000-0000-000000000003","taille":"L","quantite":1},{"article_id":"e5000000-0000-0000-0000-000000000003","taille":"L","quantite":1}]')$$,
  '23514', 'Le même article et la même taille apparaissent deux fois dans le panier.', 'mode : « la même taille apparaissent deux fois » inchangé');

-- Les autres messages et règles ne changent pas (ligne incomplète, connexion).
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","quantite":1}]')$$,
  '22023', 'Une ligne du panier est incomplète (article, taille ou quantité manquant) : videz le panier et réessayez.', 'ligne incomplète : message inchangé');
select pg_temp.compte(null) \g /dev/null
select pg_temp.erreur($$select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"50 ml","quantite":1}]')$$,
  '42501', 'Connectez-vous pour commander.', 'sans compte : refus inchangé');

-- ---------------------------------------------------------------------------
-- Commandes valides : rien ne change (prix, lignes, stock retiré à la confirmation)
-- ---------------------------------------------------------------------------
select pg_temp.compte('c5000000-0000-0000-0000-000000000001') \g /dev/null
select passer_commande('d5000000-0000-0000-0000-000000000001', '[{"article_id":"e5000000-0000-0000-0000-000000000001","taille":"100 ml","quantite":1}]') as cb \gset
select pg_temp.compte('c5000000-0000-0000-0000-000000000002') \g /dev/null
select passer_commande('d5000000-0000-0000-0000-000000000002', '[{"article_id":"e5000000-0000-0000-0000-000000000003","taille":"M","quantite":1}]') as cm \gset
reset role;
select pg_temp.ok((select total from commandes where id = :'cb') = 5000 and (select count(*) from lignes_commande where commande_id = :'cb' and taille = '100 ml' and prix_unitaire = 5000) = 1,
  'commande beauté valide : ligne « 100 ml », prix et total inchangés');

-- ---------------------------------------------------------------------------
-- prive.retirer_stock (confirmation) : « Stock insuffisant … en contenance / en taille »
-- ---------------------------------------------------------------------------
update tailles set quantite = 0 where article_id in ('e5000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000003') and libelle in ('100 ml', 'M');
set local role authenticated;
select pg_temp.compte('b5000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur(format('select changer_statut_commande(%L, ''confirmee'')', :'cb'), '23514',
  'Stock insuffisant pour « Parfum test » en contenance 100 ml : il reste 0 pièce(s), la commande en demande 1. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».',
  'confirmation beauté : « Stock insuffisant pour « Parfum test » en contenance 100 ml … »');
select pg_temp.compte('b5000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(format('select changer_statut_commande(%L, ''confirmee'')', :'cm'), '23514',
  'Stock insuffisant pour « Polo test » en taille M : il reste 0 pièce(s), la commande en demande 1. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».',
  'confirmation mode : « … en taille M … » inchangé');
reset role;
update tailles set quantite = 1 where article_id = 'e5000000-0000-0000-0000-000000000001' and libelle = '100 ml';
set local role authenticated;
select pg_temp.compte('b5000000-0000-0000-0000-000000000001') \g /dev/null
select changer_statut_commande(:'cb', 'confirmee') \g /dev/null
reset role;
select pg_temp.ok((select statut from commandes where id = :'cb') = 'confirmee'
  and (select quantite from tailles where article_id = 'e5000000-0000-0000-0000-000000000001' and libelle = '100 ml') = 0
  and (select quantite from tailles where article_id = 'e5000000-0000-0000-0000-000000000001' and libelle = '50 ml') = 3,
  'confirmation beauté avec du stock : acceptée, stock du 100 ml retiré, 50 ml intact');

-- Seuls les messages ont changé : droits d'exécution identiques.
select pg_temp.ok(has_function_privilege('authenticated', 'public.passer_commande(uuid,jsonb,text)', 'execute')
  and not has_function_privilege('anon', 'prive.retirer_stock(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.retirer_stock(uuid)', 'execute'),
  'droits inchangés : passer_commande pour authenticated, retirer_stock réservé');

rollback;

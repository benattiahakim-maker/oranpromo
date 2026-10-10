-- Tests SQL de la migration 20261010210000_carte_boutiques.sql (US-24.1 : position dans la wilaya d'Oran,
-- position protégée après validation, lecture des épingles boutiques_carte()).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/carte_boutiques.test.sql
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

create function pg_temp.position(boutique uuid, lat text, lng text) returns text language sql as $$
  select format('update boutiques set latitude = %s, longitude = %s where id = %L', lat, lng, boutique);
$$;

-- Comptes : admin, ambassadeur, commerçant d'une boutique en attente, commerçant d'une boutique validée.
insert into auth.users (id, email) values
  ('a4000000-0000-0000-0000-000000000001', 'admin-carte@test.dz'),
  ('a4000000-0000-0000-0000-000000000002', 'ambassadeur-carte@test.dz'),
  ('b4000000-0000-0000-0000-000000000001', 'attente-carte@test.dz'),
  ('b4000000-0000-0000-0000-000000000002', 'validee-carte@test.dz'),
  ('b4000000-0000-0000-0000-000000000003', 'suspendue-carte@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, latitude, longitude, ville) values
  ('d4000000-0000-0000-0000-000000000001', 'Carte Attente', 'carte-attente', 'Centre', '+213555940001', 'en_attente', null, null, 'oran'),
  ('d4000000-0000-0000-0000-000000000002', 'Carte Validee', 'carte-validee', 'Akid Lotfi', '+213555940002', 'validee', 35.7303, -0.5784, 'oran'),
  ('d4000000-0000-0000-0000-000000000003', 'Carte Suspendue', 'carte-suspendue', 'Centre', '+213555940003', 'suspendue', 35.70, -0.64, 'oran'),
  ('d4000000-0000-0000-0000-000000000004', 'Carte Sans Position', 'carte-sans-position', 'Gambetta', '+213555940004', 'validee', null, null, 'oran');
update profils set role = 'admin' where id = 'a4000000-0000-0000-0000-000000000001';
update profils set role = 'ambassadeur' where id = 'a4000000-0000-0000-0000-000000000002';
update profils set role = 'commercant', boutique_id = 'd4000000-0000-0000-0000-000000000001' where id = 'b4000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd4000000-0000-0000-0000-000000000002' where id = 'b4000000-0000-0000-0000-000000000002';
update profils set role = 'commercant', boutique_id = 'd4000000-0000-0000-0000-000000000003' where id = 'b4000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Bornes de la wilaya d'Oran (lat 35,33 à 35,92 ; lng −1,15 à −0,10)
-- ---------------------------------------------------------------------------
select pg_temp.ok(not exists (select 1 from boutiques where latitude is not null and not (latitude between 35.33 and 35.92 and longitude between -1.15 and -0.10)),
  'bornes : aucune boutique existante hors de la wilaya');
insert into boutiques (id, nom, slug, quartier, whatsapp, latitude, longitude, ville) values
  ('d4000000-0000-0000-0000-000000000010', 'Coin Sud Ouest', 'coin-sud-ouest', 'Centre', '+213555940010', 35.33, -1.15, 'oran'),
  ('d4000000-0000-0000-0000-000000000011', 'Coin Nord Est', 'coin-nord-est', 'Centre', '+213555940011', 35.92, -0.10, 'oran');
select pg_temp.ok((select count(*) = 2 from boutiques where id in ('d4000000-0000-0000-0000-000000000010', 'd4000000-0000-0000-0000-000000000011')),
  'bornes : les coins exacts du rectangle sont acceptés');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.9201', '-0.64'), '23514', 'wilaya d''Oran', 'bornes : au nord (35,9201) refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.3299', '-0.64'), '23514', 'wilaya d''Oran', 'bornes : au sud (35,3299) refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.69', '-1.1501'), '23514', 'wilaya d''Oran', 'bornes : à l''ouest (−1,1501) refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.69', '-0.0999'), '23514', 'wilaya d''Oran', 'bornes : à l''est (−0,0999) refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.69', '0.63'), '23514', 'La position doit être dans la wilaya d''Oran.', 'bornes : signe de la longitude oublié refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '-0.63', '35.69'), '23514', 'wilaya d''Oran', 'bornes : latitude et longitude inversées refusées');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '36.7538', '3.0588'), '23514', 'wilaya d''Oran', 'bornes : Alger refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '''NaN''', '''NaN'''), '23514', 'wilaya d''Oran', 'bornes : NaN refusé');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '''Infinity''', '''-Infinity'''), '23514', 'wilaya d''Oran', 'bornes : infini refusé');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp, latitude, longitude, ville) values ('Hors Oran', 'hors-oran', 'Centre', '+213555940012', 36.75, 3.05, 'oran')$$,
  '23514', 'wilaya d''Oran', 'bornes : création hors de la wilaya refusée');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', '35.69', 'null'), '23514', 'Saisissez la latitude et la longitude, ou aucune des deux.', 'complète : latitude sans longitude refusée');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000010', 'null', '-0.63'), '23514', 'ou aucune des deux', 'complète : longitude sans latitude refusée');
update boutiques set latitude = null, longitude = null where id = 'd4000000-0000-0000-0000-000000000010';
select pg_temp.ok((select latitude is null and longitude is null from boutiques where id = 'd4000000-0000-0000-0000-000000000010'), 'complète : retirer les deux coordonnées est permis');
-- Les contraintes tiennent même sans les déclencheurs (garantie de la base, pas seulement du message).
set local session_replication_role = replica;
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000011', '36.75', '3.05'), '23514', 'boutiques_position_oran', 'contrainte : hors bornes refusé même sans déclencheur');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000011', '35.69', 'null'), '23514', 'boutiques_position_complete', 'contrainte : une seule coordonnée refusée même sans déclencheur');
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- Qui peut régler la position
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('b4000000-0000-0000-0000-000000000001') \g /dev/null
update boutiques set latitude = 35.6971, longitude = -0.6337 where id = 'd4000000-0000-0000-0000-000000000001';
select pg_temp.ok((select latitude = 35.6971 and longitude = -0.6337 from boutiques where id = 'd4000000-0000-0000-0000-000000000001'),
  'droits : le commerçant règle la position de sa boutique en attente');
update boutiques set latitude = null, longitude = null where id = 'd4000000-0000-0000-0000-000000000001';
select pg_temp.ok((select latitude is null from boutiques where id = 'd4000000-0000-0000-0000-000000000001'),
  'droits : le commerçant retire la position de sa boutique en attente');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000001', '36.75', '3.05'), '23514', 'wilaya d''Oran',
  'droits : même en attente, hors de la wilaya refusé au commerçant');

select pg_temp.compte('b4000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000002', '35.70', '-0.60'), '42501',
  'Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, la position ou les liens.', 'droits : boutique validée, le commerçant ne déplace pas la position');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000002', 'null', 'null'), '42501', 'seul un administrateur', 'droits : boutique validée, le commerçant ne retire pas la position');
update boutiques set horaires = '9 h - 20 h' where id = 'd4000000-0000-0000-0000-000000000002';
select pg_temp.ok((select horaires = '9 h - 20 h' from boutiques where id = 'd4000000-0000-0000-0000-000000000002'),
  'droits : boutique validée, le commerçant modifie toujours ses horaires');
select pg_temp.compte('b4000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000003', '35.71', '-0.62'), '42501', 'seul un administrateur', 'droits : boutique suspendue, le commerçant ne déplace pas la position');

select pg_temp.compte('a4000000-0000-0000-0000-000000000002') \g /dev/null
update boutiques set latitude = 35.71, longitude = -0.62 where id = 'd4000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select latitude is null from boutiques where id = 'd4000000-0000-0000-0000-000000000001'),
  'droits : l''ambassadeur ne modifie pas une boutique après sa création (RLS)');
set local role authenticated;
insert into boutiques (id, nom, slug, quartier, whatsapp, latitude, longitude, ville) values
  ('d4000000-0000-0000-0000-000000000020', 'Placee Sur Place', 'placee-sur-place', 'Centre', '+213555940020', 35.6971, -0.6337, 'oran');
reset role;
select pg_temp.ok((select latitude = 35.6971 from boutiques where id = 'd4000000-0000-0000-0000-000000000020'),
  'droits : l''ambassadeur place la boutique à la création');

set local role authenticated;
select pg_temp.compte('a4000000-0000-0000-0000-000000000001') \g /dev/null
update boutiques set latitude = 35.7010, longitude = -0.6010 where id = 'd4000000-0000-0000-0000-000000000002';
select pg_temp.ok((select latitude = 35.7010 and longitude = -0.6010 from boutiques where id = 'd4000000-0000-0000-0000-000000000002'),
  'droits : l''admin déplace la position d''une boutique validée');
select pg_temp.erreur(pg_temp.position('d4000000-0000-0000-0000-000000000002', '36.75', '3.05'), '23514', 'wilaya d''Oran', 'droits : même l''admin ne sort pas de la wilaya');
reset role;

-- ---------------------------------------------------------------------------
-- boutiques_carte() : épingles
-- ---------------------------------------------------------------------------
-- Articles de la boutique validée : promo en cours, promo expirée, article masqué en promo, article trop ancien en promo,
-- article vendu en promo, article beauté sans promo. Boutique en attente : article en promo (jamais montré).
insert into articles (id, boutique_id, titre, categorie, prix, genre, statut) values
  ('e4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000002', 'Robe promo', 'Robes', 5000, 'femme', 'disponible'),
  ('e4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000002', 'Jean expire', 'Pantalons et jeans', 5000, 'homme', 'reserve'),
  ('e4000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000002', 'Masque', 'Robes', 5000, 'enfant', 'masque'),
  ('e4000000-0000-0000-0000-000000000004', 'd4000000-0000-0000-0000-000000000002', 'Ancien', 'Chemises', 5000, 'homme', 'disponible'),
  ('e4000000-0000-0000-0000-000000000005', 'd4000000-0000-0000-0000-000000000002', 'Vendu', 'Chemises', 5000, 'homme', 'vendu'),
  ('e4000000-0000-0000-0000-000000000006', 'd4000000-0000-0000-0000-000000000002', 'Parfum', 'Parfums', 5000, 'mixte', 'disponible'),
  ('e4000000-0000-0000-0000-000000000007', 'd4000000-0000-0000-0000-000000000001', 'Cache', 'Robes', 5000, 'femme', 'disponible');
update articles set derniere_confirmation = now() - interval '22 days' where id = 'e4000000-0000-0000-0000-000000000004';
insert into promos (article_id, prix_promo, date_fin) values
  ('e4000000-0000-0000-0000-000000000001', 4000, now() + interval '2 days'),
  ('e4000000-0000-0000-0000-000000000002', 4000, now() - interval '1 hour'),
  ('e4000000-0000-0000-0000-000000000003', 4000, now() + interval '2 days'),
  ('e4000000-0000-0000-0000-000000000004', 4000, now() + interval '2 days'),
  ('e4000000-0000-0000-0000-000000000005', 4000, now() + interval '2 days'),
  ('e4000000-0000-0000-0000-000000000007', 4000, now() + interval '2 days');
-- Deuxième boutique validée avec une promo en cours (relecture n°6, point 5 : avant, la boutique de démonstration
-- 10000000-…-001, absente du dépôt).
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d4000000-0000-0000-0000-000000000030', 'Boutique Promo Test', 'boutique-promo-test', 'Centre', '+213555940030', 'validee', 'oran');
insert into articles (id, boutique_id, titre, categorie, prix, genre, statut) values
  ('e4000000-0000-0000-0000-000000000030', 'd4000000-0000-0000-0000-000000000030', 'Polo promo', 'T-shirts et polos', 4000, 'homme', 'disponible');
insert into promos (article_id, prix_promo, date_fin) values ('e4000000-0000-0000-0000-000000000030', 3500, now() + interval '3 days');

set local role anon;
select pg_temp.compte(null) \g /dev/null
create temporary table carte_anon on commit drop as select * from public.boutiques_carte();
reset role;
select pg_temp.ok((select count(*) = (select count(*) from boutiques where statut = 'validee') from carte_anon), 'épingles : toutes les boutiques validées, et elles seules (public)');
select pg_temp.ok(not exists (select 1 from carte_anon c join boutiques b using (id) where b.statut <> 'validee'), 'épingles : ni boutique en attente ni suspendue');
select pg_temp.ok((select promos_en_cours = 1 from carte_anon where id = 'd4000000-0000-0000-0000-000000000002'),
  'épingles : seule la promo en cours d''un article visible compte (expirée, masqué, > 21 jours, vendu exclus)');
select pg_temp.ok((select rayons @> '[{"categorie": "Robes", "genre": "femme"}, {"categorie": "Parfums", "genre": "mixte"}, {"categorie": "Pantalons et jeans", "genre": "homme"}]'::jsonb
                    and jsonb_array_length(rayons) = 3 from carte_anon where id = 'd4000000-0000-0000-0000-000000000002'),
  'épingles : rayons = catégorie / genre des articles visibles seulement (réservé compris)');
select pg_temp.ok((select latitude is null and longitude is null and promos_en_cours = 0 and rayons = '[]'::jsonb from carte_anon where id = 'd4000000-0000-0000-0000-000000000004'),
  'épingles : boutique sans position ni article présente, position vide (liste « sans position »)');
select pg_temp.ok((select promos_en_cours = 1 from carte_anon where id = 'd4000000-0000-0000-0000-000000000030'), 'épingles : promo d''une autre boutique validée comptée');
select pg_temp.ok((select array_agg(nom order by nom) = array_agg(nom) from carte_anon), 'épingles : triées par nom');
select pg_temp.ok((select string_agg(pg_get_function_result(oid), '') from pg_proc where proname = 'boutiques_carte')
  = 'TABLE(id uuid, slug text, nom text, quartier text, latitude double precision, longitude double precision, promos_en_cours integer, rayons jsonb)',
  'épingles : colonnes légères seulement (ni photo, ni WhatsApp, ni adresse)');

set local role authenticated;
select pg_temp.compte('a4000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok(not exists (select 1 from public.boutiques_carte() where id in ('d4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000003')),
  'épingles : un admin connecté ne voit pas plus que le public');
select pg_temp.ok((select promos_en_cours = 1 from public.boutiques_carte() where id = 'd4000000-0000-0000-0000-000000000002'), 'épingles : même compte de promos pour un admin');
select pg_temp.compte('b4000000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.ok((select promos_en_cours = 1 and jsonb_array_length(rayons) = 3 from public.boutiques_carte() where id = 'd4000000-0000-0000-0000-000000000002'),
  'épingles : le commerçant ne voit pas ses articles masqués ou anciens sur la carte');
select pg_temp.compte('b4000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok(not exists (select 1 from public.boutiques_carte() where id = 'd4000000-0000-0000-0000-000000000001'), 'épingles : le commerçant ne voit pas sa boutique en attente sur la carte');
reset role;
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok((select count(*) = 1 from public.boutiques_carte(1)), 'limite : 1 boutique demandée, 1 renvoyée');
select pg_temp.ok((select count(*) = 1 from public.boutiques_carte(0)), 'limite : 0 ou moins devient 1');
insert into boutiques (nom, slug, quartier, whatsapp, statut, ville)
  select 'Masse ' || i, 'masse-' || i, 'Centre', '+213555' || lpad(i::text, 6, '0'), 'validee', 'oran' from generate_series(1, 510) i;
select pg_temp.ok((select count(*) = 500 from public.boutiques_carte(100000)), 'limite : jamais plus de 500 boutiques');
select pg_temp.ok((select count(*) = 500 from public.boutiques_carte()), 'limite : 500 par défaut');
select pg_temp.ok(has_function_privilege('anon', 'public.boutiques_carte(integer, text)', 'execute'), 'droits : appel anonyme permis');

select 'Tous les tests SQL de la carte des boutiques (US-24.1) passent.';
rollback;

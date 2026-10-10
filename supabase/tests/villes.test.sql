-- Tests SQL de la migration 20261013090000_villes.sql (US-29.1 : villes, ville des boutiques, bornes par ville,
-- épingles par ville, villes ouvertes, ville d'un ambassadeur). Oran doit se comporter exactement comme avant.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/villes.test.sql
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

-- ---------------------------------------------------------------------------
-- Les 9 villes de la feuille de route : seule Oran ouverte, Oran avec les bornes d'avant
-- ---------------------------------------------------------------------------
select pg_temp.ok((select count(*) = 9 from villes), 'villes : les 9 villes de la feuille de route sont créées');
select pg_temp.ok((select array_agg(code order by ordre) = array['oran', 'mostaganem', 'relizane', 'tlemcen', 'alger', 'tizi-ouzou', 'bejaia', 'annaba', 'constantine']
                     from villes), 'villes : ordre Ouest, Centre, Est');
select pg_temp.ok((select array_agg(code) = array['oran'] from villes where ouverte), 'villes : seule Oran est ouverte');
select pg_temp.ok((select bool_and(centre_lat between lat_min and lat_max and centre_lng between lng_min and lng_max) from villes),
  'villes : le centre de chaque ville est dans ses bornes');
select pg_temp.ok((select bool_and(pays = 'DZ' and zoom = 12) from villes), 'villes : toutes en Algérie, zoom 12');
-- Valeurs documentées dans la migration (OpenStreetMap + environ 1 km, arrondi vers l'extérieur).
select pg_temp.ok((select count(*) = 9 from villes v join (values
    ('oran',        31, 'Oran',        'وهران',    35.33, 35.92, -1.15, -0.10, 35.6971, -0.6337),
    ('mostaganem',  27, 'Mostaganem',  'مستغانم',  35.66, 36.35, -0.13,  0.76, 35.9288,  0.0900),
    ('relizane',    48, 'Relizane',    'غليزان',   35.43, 36.24,  0.21,  1.44, 35.7381,  0.5548),
    ('tlemcen',     13, 'Tlemcen',     'تلمسان',   34.08, 35.25, -2.23, -0.75, 34.8818, -1.3167),
    ('alger',       16, 'Alger',       'الجزائر',  36.56, 36.84,  2.78,  3.40, 36.7729,  3.0588),
    ('tizi-ouzou',  15, 'Tizi Ouzou',  'تيزي وزو', 36.44, 36.93,  3.70,  4.67, 36.7138,  4.0494),
    ('bejaia',       6, 'Béjaïa',      'بجاية',    36.20, 36.91,  4.33,  5.50, 36.7512,  5.0644),
    ('annaba',      23, 'Annaba',      'عنابة',    36.59, 37.10,  7.27,  7.85, 36.8982,  7.7549),
    ('constantine', 25, 'Constantine', 'قسنطينة',  36.08, 36.64,  6.29,  7.06, 36.3642,  6.6084)
  ) as d(code, n, nom, nom_ar, a, b, c, e, cl, cg)
  on v.code = d.code and v.numero_wilaya = d.n and v.nom = d.nom and v.nom_ar = d.nom_ar
 and v.lat_min = d.a and v.lat_max = d.b and v.lng_min = d.c and v.lng_max = d.e and v.centre_lat = d.cl and v.centre_lng = d.cg),
  'villes : wilaya, noms, bornes et centres conformes aux valeurs documentées');
-- Limites brutes OpenStreetMap (10/10/2026) bien à l'intérieur des bornes, avec une marge d'au moins 0,003° (~300 m ; Oran garde son rectangle d'avant).
select pg_temp.ok((select count(*) = 9 from villes v join (values
    ('oran',        35.3335035, 35.9093713, -1.1396429, -0.1136930),
    ('mostaganem',  35.6716420, 36.3340333, -0.1156470,  0.7408167),
    ('relizane',    35.4446510, 36.2280270,  0.2272020,  1.4279900),
    ('tlemcen',     34.0966739, 35.2380790, -2.2185152, -0.7634540),
    ('alger',       36.5795214, 36.8208671,  2.7995070,  3.3826783),
    ('tizi-ouzou',  36.4525300, 36.9107361,  3.7154270,  4.6529580),
    ('bejaia',      36.2176035, 36.8959418,  4.3499904,  5.4829650),
    ('annaba',      36.6028980, 37.0849536,  7.2847670,  7.8301432),
    ('constantine', 36.0925730, 36.6242580,  6.3096290,  7.0493180)
  ) as o(code, a, b, c, e)
  on v.code = o.code and v.lat_min <= o.a - 0.003 and v.lat_max >= o.b + 0.005 and v.lng_min <= o.c - 0.005 and v.lng_max >= o.e + 0.005),
  'villes : les limites OpenStreetMap de chaque wilaya sont dans ses bornes, avec une marge');
select pg_temp.ok((select ouverte and pays = 'DZ' and numero_wilaya = 31 and nom = 'Oran' and nom_ar = 'وهران'
                     and lat_min = 35.33 and lat_max = 35.92 and lng_min = -1.15 and lng_max = -0.10
                     and centre_lat = 35.6971 and centre_lng = -0.6337 and zoom = 12 from villes where code = 'oran'),
  'villes : Oran ouverte, wilaya 31, bornes et centre d''avant');
select pg_temp.ok(not exists (select 1 from boutiques where ville <> 'oran'), 'boutiques : toutes les boutiques existantes sont à Oran');
select pg_temp.ok((select column_default = '''oran''::text' and is_nullable = 'NO' from information_schema.columns
                    where table_schema = 'public' and table_name = 'boutiques' and column_name = 'ville'),
  'boutiques : ville obligatoire, « oran » par défaut (US-29.1)');

-- Comptes : admin, ambassadeur sans ville, ambassadeur de Tlemcen, commerçant validé, client.
insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'admin-villes@test.dz'),
  ('a5000000-0000-0000-0000-000000000002', 'ambassadeur-villes@test.dz'),
  ('a5000000-0000-0000-0000-000000000003', 'ambassadeur-tlemcen@test.dz'),
  ('b5000000-0000-0000-0000-000000000001', 'commercant-villes@test.dz'),
  ('c5000000-0000-0000-0000-000000000001', 'client-villes@test.dz');

-- Pour les tests : Mostaganem ouverte (comme l'admin le ferait), Tlemcen reste fermée.
update villes set ouverte = true where code = 'mostaganem';

insert into boutiques (id, nom, slug, quartier, whatsapp, statut, latitude, longitude, ville) values
  ('d5000000-0000-0000-0000-000000000001', 'Villes Oran', 'villes-oran', 'Akid Lotfi', '+213555950001', 'validee', 35.7303, -0.5784, 'oran'),
  ('d5000000-0000-0000-0000-000000000002', 'Villes Tlemcen', 'villes-tlemcen', 'Kiffane', '+213555950002', 'validee', 34.8828, -1.3167, 'tlemcen'),
  ('d5000000-0000-0000-0000-000000000003', 'Villes Mosta', 'villes-mosta', 'Centre', '+213555950003', 'validee', 35.9311, 0.0892, 'mostaganem'),
  ('d5000000-0000-0000-0000-000000000004', 'Villes Attente', 'villes-attente', 'Centre', '+213555950004', 'en_attente', null, null, 'tlemcen');
update profils set role = 'admin' where id = 'a5000000-0000-0000-0000-000000000001';
update profils set role = 'ambassadeur' where id = 'a5000000-0000-0000-0000-000000000002';
update profils set role = 'ambassadeur', ville = 'tlemcen' where id = 'a5000000-0000-0000-0000-000000000003';
update profils set role = 'commercant', boutique_id = 'd5000000-0000-0000-0000-000000000004' where id = 'b5000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Codes et bornes des villes
-- ---------------------------------------------------------------------------
select pg_temp.erreur($$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('catalogue', 'X', 'سس', 1, 2, 1, 2, 1.5, 1.5)$$,
  '23514', 'villes_code_libre', 'code : un mot déjà pris par une page (catalogue) refusé');
select pg_temp.erreur($$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('Alger', 'Alger', 'الجزائر', 36, 37, 2, 4, 36.7, 3.0)$$,
  '23514', 'villes_code_format', 'code : majuscules refusées');
select pg_temp.erreur($$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('a', 'A', 'سس', 36, 37, 2, 4, 36.7, 3.0)$$,
  '23514', 'villes_code_format', 'code : une seule lettre refusée (routes /a, /b, /p)');
select pg_temp.erreur($$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('setif', 'Sétif', 'سطيف', 36, 37, 2, 4, 38, 3.0)$$,
  '23514', 'villes_centre', 'bornes : centre hors des bornes refusé');
select pg_temp.erreur($$insert into villes (code, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('setif', 'Sétif', 'سطيف', 37, 36, 2, 4, 36.5, 3.0)$$,
  '23514', 'villes_bornes', 'bornes : minimum plus grand que le maximum refusé');
select pg_temp.erreur($$insert into villes (code, numero_wilaya, nom, nom_ar, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng) values ('oran-bis', 31, 'Oran', 'وهران', 35, 36, -1, 0, 35.5, -0.5)$$,
  '23505', 'villes_wilaya_unique', 'wilaya : un seul numéro par pays');

-- ---------------------------------------------------------------------------
-- Oran : mêmes points acceptés et refusés, même message qu'avant
-- ---------------------------------------------------------------------------
insert into boutiques (id, nom, slug, quartier, whatsapp, latitude, longitude) values
  ('d5000000-0000-0000-0000-000000000010', 'Coin SO', 'villes-coin-so', 'Centre', '+213555950010', 35.33, -1.15),
  ('d5000000-0000-0000-0000-000000000011', 'Coin NE', 'villes-coin-ne', 'Centre', '+213555950011', 35.92, -0.10);
select pg_temp.ok((select count(*) = 2 and bool_and(ville = 'oran') from boutiques where id in ('d5000000-0000-0000-0000-000000000010', 'd5000000-0000-0000-0000-000000000011')),
  'Oran : coins exacts acceptés, ville « oran » par défaut');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '35.9201', '-0.64'), '23514', 'La position doit être dans la wilaya d''Oran.', 'Oran : au nord refusé, message identique');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '35.3299', '-0.64'), '23514', 'La position doit être dans la wilaya d''Oran.', 'Oran : au sud refusé');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '35.69', '-1.1501'), '23514', 'La position doit être dans la wilaya d''Oran.', 'Oran : à l''ouest refusé');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '35.69', '-0.0999'), '23514', 'La position doit être dans la wilaya d''Oran.', 'Oran : à l''est refusé');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '''NaN''', '''NaN'''), '23514', 'wilaya d''Oran', 'Oran : NaN refusé');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '''Infinity''', '''-Infinity'''), '23514', 'wilaya d''Oran', 'Oran : infini refusé');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '35.69', 'null'), '23514', 'Saisissez la latitude et la longitude, ou aucune des deux.', 'Oran : une seule coordonnée refusée');
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000010', '34.8828', '-1.3167'), '23514', 'wilaya d''Oran', 'Oran : un point de Tlemcen refusé pour une boutique d''Oran');
set local session_replication_role = replica;
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000011', '36.75', '3.05'), '23514', 'boutiques_position_oran', 'Oran : contrainte gardée même sans déclencheur');
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- Autres villes : bornes de la ville de la boutique
-- ---------------------------------------------------------------------------
select pg_temp.erreur(pg_temp.position('d5000000-0000-0000-0000-000000000002', '35.7303', '-0.5784'), '23514', 'La position doit être dans la wilaya de Tlemcen.', 'Tlemcen : un point d''Oran refusé, « de Tlemcen »');
update boutiques set latitude = 34.08, longitude = -0.75 where id = 'd5000000-0000-0000-0000-000000000002';
select pg_temp.ok((select latitude = 34.08 from boutiques where id = 'd5000000-0000-0000-0000-000000000002'), 'Tlemcen : coin exact de ses bornes accepté');
select pg_temp.erreur($$update boutiques set ville = 'oran' where id = 'd5000000-0000-0000-0000-000000000003'$$, '23514', 'wilaya d''Oran', 'changer de ville revérifie la position (Mostaganem → Oran refusé)');
select pg_temp.erreur($$update boutiques set ville = 'setif' where id = 'd5000000-0000-0000-0000-000000000003'$$, '23503', 'Ville inconnue.', 'ville inconnue refusée');
select pg_temp.ok((select prive.de_ville('Oran') = 'd''Oran' and prive.de_ville('Alger') = 'd''Alger' and prive.de_ville('Tlemcen') = 'de Tlemcen'
                     and prive.de_ville('El Bayadh') = 'd''El Bayadh' and prive.de_ville('Aïn Témouchent') = 'd''Aïn Témouchent'), 'de_ville : élision');

-- ---------------------------------------------------------------------------
-- Épingles et villes ouvertes
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok((select count(*) = 1 from villes where ouverte = false) = false and (select count(*) from villes) = 2, 'droits : le public ne lit que les villes ouvertes');
select pg_temp.ok(exists (select 1 from public.boutiques_carte() where id = 'd5000000-0000-0000-0000-000000000001')
                  and not exists (select 1 from public.boutiques_carte() where id in ('d5000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000003')),
  'épingles : sans ville, Oran seulement (comme avant)');
select pg_temp.ok((select array_agg(id) = array['d5000000-0000-0000-0000-000000000003'::uuid] from public.boutiques_carte(500, 'mostaganem')), 'épingles : Mostaganem seulement');
select pg_temp.ok(not exists (select 1 from public.boutiques_carte(500, 'tlemcen')), 'épingles : ville fermée vide');
select pg_temp.ok((select array_agg(code order by code) = array['mostaganem', 'oran'] from public.villes_ouvertes()), 'villes_ouvertes : ouvertes seulement');
select pg_temp.ok((select array_agg(code) = array['oran', 'mostaganem'] from public.villes_ouvertes()), 'villes_ouvertes : triées par ordre');
select pg_temp.ok((select boutiques = 1 from public.villes_ouvertes() where code = 'mostaganem'), 'villes_ouvertes : boutiques validées comptées');
select pg_temp.ok(exists (select 1 from boutiques where slug = 'villes-tlemcen'), 'ville fermée : la boutique validée reste lisible par son lien');
select pg_temp.erreur($$update villes set ouverte = true where code = 'tlemcen'$$, '42501', 'permission denied', 'droits : le public n''ouvre pas une ville');
reset role;

set local role authenticated;
select pg_temp.compte('c5000000-0000-0000-0000-000000000001') \g /dev/null
update villes set ouverte = false where code = 'oran';
select pg_temp.ok((select ouverte from villes where code = 'oran'), 'droits : un client ne ferme pas une ville (aucune ligne modifiée)');
select pg_temp.erreur($$update villes set lat_min = 0 where code = 'oran'$$, '42501', 'permission denied', 'droits : bornes non modifiables, même connecté');
select pg_temp.ok((select count(*) = 2 from villes), 'droits : un client lit les villes ouvertes seulement');
update profils set ville = 'oran' where id = 'c5000000-0000-0000-0000-000000000001';
select pg_temp.ok((select ville is null from profils where id = 'c5000000-0000-0000-0000-000000000001'), 'profil : un client ne se donne pas de ville');

select pg_temp.compte('b5000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok(exists (select 1 from villes where code = 'tlemcen'), 'droits : le commerçant lit la ville (fermée) de sa boutique');
update boutiques set latitude = 34.88, longitude = -1.31 where id = 'd5000000-0000-0000-0000-000000000004';
select pg_temp.ok((select latitude = 34.88 from boutiques where id = 'd5000000-0000-0000-0000-000000000004'), 'commerçant : boutique en attente placée dans sa ville fermée');

select pg_temp.compte('a5000000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.ok((select count(*) = 9 from villes), 'droits : l''ambassadeur lit toutes les villes');
update profils set ville = null where id = 'a5000000-0000-0000-0000-000000000003';
select pg_temp.ok((select ville = 'tlemcen' from profils where id = 'a5000000-0000-0000-0000-000000000003'), 'profil : l''ambassadeur ne change pas sa ville');
insert into boutiques (nom, slug, quartier, whatsapp, ville) values ('Amb Tlemcen', 'villes-amb-tlemcen', 'Centre', '+213555950020', 'tlemcen');
select pg_temp.ok(exists (select 1 from boutiques where slug = 'villes-amb-tlemcen'), 'ambassadeur de Tlemcen : crée une boutique à Tlemcen (fermée)');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp, ville) values ('Amb Oran', 'villes-amb-oran', 'Centre', '+213555950021', 'oran')$$,
  '42501', 'row-level security', 'ambassadeur de Tlemcen : ne crée pas à Oran');
select pg_temp.erreur($$insert into boutiques (nom, slug, quartier, whatsapp) values ('Amb Defaut', 'villes-amb-defaut', 'Centre', '+213555950022')$$,
  '42501', 'row-level security', 'ambassadeur de Tlemcen : ville oubliée (oran par défaut) refusée');

select pg_temp.compte('a5000000-0000-0000-0000-000000000002') \g /dev/null
insert into boutiques (nom, slug, quartier, whatsapp, ville) values ('Amb Libre', 'villes-amb-libre', 'Centre', '+213555950023', 'mostaganem');
select pg_temp.ok(exists (select 1 from boutiques where slug = 'villes-amb-libre'), 'ambassadeur sans ville : crée dans toute ville');

select pg_temp.compte('a5000000-0000-0000-0000-000000000001') \g /dev/null
update villes set ouverte = true, ordre = 10 where code = 'tlemcen';
select pg_temp.ok((select ouverte and ordre = 10 from villes where code = 'tlemcen'), 'admin : ouvre et range une ville');
select pg_temp.erreur($$update villes set nom = 'X' where code = 'tlemcen'$$, '42501', 'permission denied', 'admin : nom et bornes seulement par migration');
update profils set ville = 'mostaganem' where id = 'a5000000-0000-0000-0000-000000000002';
select pg_temp.ok((select ville = 'mostaganem' from profils where id = 'a5000000-0000-0000-0000-000000000002'), 'admin : donne une ville à un ambassadeur');
update boutiques set ville = 'mostaganem', latitude = 35.93, longitude = 0.09 where id = 'd5000000-0000-0000-0000-000000000001';
select pg_temp.ok((select ville = 'mostaganem' from boutiques where id = 'd5000000-0000-0000-0000-000000000001'), 'admin : change la ville d''une boutique validée');
reset role;
select pg_temp.compte(null) \g /dev/null
update boutiques set statut = 'validee' where slug = 'villes-amb-libre';
update profils set boutique_id = (select id from boutiques where slug = 'villes-amb-libre') where id = 'b5000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.compte('b5000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.erreur($$update boutiques set ville = 'oran', latitude = null, longitude = null where slug = 'villes-amb-libre'$$, '42501', 'seul un administrateur',
  'commerçant : ne change pas la ville de sa boutique publiée');
reset role;

-- ---------------------------------------------------------------------------
-- Rien d'autre n'a bougé
-- ---------------------------------------------------------------------------
select pg_temp.ok((select string_agg(pg_get_function_result(oid), '') from pg_proc where proname = 'boutiques_carte')
  = 'TABLE(id uuid, slug text, nom text, quartier text, latitude double precision, longitude double precision, promos_en_cours integer, rayons jsonb)',
  'épingles : mêmes colonnes qu''avant');
select pg_temp.ok(has_function_privilege('anon', 'public.villes_ouvertes()', 'execute') and has_function_privilege('anon', 'public.boutiques_carte(integer, text)', 'execute'),
  'droits : lectures publiques permises à anon');
select pg_temp.ok(not has_function_privilege('anon', 'prive.de_ville(text)', 'execute'), 'droits : fonctions internes fermées');

select 'Tous les tests SQL des villes (US-29.1) passent.';
rollback;

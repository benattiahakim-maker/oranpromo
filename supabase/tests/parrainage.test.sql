-- Tests SQL de la migration 20261012090000_parrainage.sql (US-27.1 : parrainage et bons de 300 DA).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parrainage.test.sql
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

-- 0. Définitions inchangées (empreintes prises sur main avant la migration).
select pg_temp.ok((select string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public','passer_commande'),('public','changer_statut_commande'),('public','declarer_no_show'),
    ('prive','recalculer_no_shows'),('prive','no_shows_actifs'),('public','bloquer_client'),('public','debloquer_client'),
    ('prive','proteger_profil'),('public','contester_no_show'),('public','valider_no_show'),('public','annuler_no_show'),
    ('prive','expirer_commande'),('prive','expirer_commandes'),('prive','synchroniser_numero_verifie'),('prive','blocage_par_numero'),
    ('public','remettre_commande'),('prive','poser_mode_remise'),('prive','messages_suivi_commande')))
  = 'annuler_no_show=8d072e620e7ce627c26be113bd3e33e7,blocage_par_numero=66aa2dbfc2dd6cc37534a8c281362afb,bloquer_client=7016b3730777461fcba4654207debc91,changer_statut_commande=6b499f80b73eea92305eebcd2f88b1de,contester_no_show=60a19d7bfb9e0c60bf04fbc2f09f5a9e,debloquer_client=202036ff24f2f8042ed0b775f4e1615b,declarer_no_show=0457027879fe08544fca36316f8056b1,expirer_commande=31d29119776460514fb33baa36bc3ee7,expirer_commandes=e4ee7b0282e4c4ee78bbbd537c5dc455,messages_suivi_commande=936e6401ec17e51226b8f9ac816f93ad,no_shows_actifs=63d33574d1bec195b1346e64f78f0f5d,passer_commande=d18a962833a100d12f0b317e46973640,poser_mode_remise=bc051011d9a715dd37c6426599af21b8,proteger_profil=e07297bba2d77e2c41bb22a016eef806,recalculer_no_shows=4d7dce4b22b98db048fc19003535c07f,remettre_commande=8eae2e162ca810ef5a4cfab1d7615ee8,synchroniser_numero_verifie=34d425c5a14821fe8236263c7c5717be,valider_no_show=cc02b62a4c1b3dd6f872bf4967ad3df9',
  'passer_commande, changer_statut_commande, no-shows, blocage, vérification du numéro, remise : définitions inchangées');
select pg_temp.ok(not exists (select 1 from prive.reglages where cle = 'parrainage')
  and (select valeur from prive.reglages where cle = 'parrainage_budget_mois') = '30000',
  'interrupteur « parrainage » désactivé par défaut, budget de départ 30 000 DA');

-- Données : deux boutiques, un commerçant chacune, des clients au numéro vérifié.
insert into auth.users (id, email) values
  ('b2700000-0000-0000-0000-00000000000a', 'boutique27a@test.dz'), ('b2700000-0000-0000-0000-00000000000b', 'boutique27b@test.dz'),
  ('c2700000-0000-0000-0000-0000000000ff', 'nonverifie27@test.dz');
insert into auth.users (id, phone, phone_confirmed_at)
select ('c2700000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2135552700' || lpad(i::text, 2, '0'), now()
from generate_series(1, 20) i;
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d2700000-0000-0000-0000-00000000000a', 'Boutique Bon A', 'boutique-bon-a', 'Gambetta', '+213555270901', 'validee'),
  ('d2700000-0000-0000-0000-00000000000b', 'Boutique Bon B', 'boutique-bon-b', 'Centre', '+213555270902', 'validee');
update profils set role = 'commercant', boutique_id = 'd2700000-0000-0000-0000-00000000000a' where id = 'b2700000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'd2700000-0000-0000-0000-00000000000b' where id = 'b2700000-0000-0000-0000-00000000000b';
update profils set nom = 'Client ' || chr(64 + right(id::text, 2)::integer) || ' Test' where id::text like 'c2700000-%' and id::text not like '%ff';
update profils set nom = 'Samir Benali' where id = 'c2700000-0000-0000-0000-000000000002';
update profils set nom = 'Sans Numero', telephone = '+213555279999' where id = 'c2700000-0000-0000-0000-0000000000ff';
-- 01 = parrain (inscrit il y a 30 jours) ; 19 = client bloqué ; 20 = devenu commerçant ; les autres sont des filleuls.
update profils set cree_le = now() - interval '30 days' where id in ('c2700000-0000-0000-0000-000000000001', 'c2700000-0000-0000-0000-000000000019');
update profils set bloque = true, bloque_par_admin = true where id = 'c2700000-0000-0000-0000-000000000019';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e2700000-0000-0000-0000-00000000000a', 'd2700000-0000-0000-0000-00000000000a', 'Robe test', 'Robes', 2500, 'femme'),
  ('e2700000-0000-0000-0000-00000000000c', 'd2700000-0000-0000-0000-00000000000a', 'Foulard test', 'Hijabs et foulards', 1500, 'femme'),
  ('e2700000-0000-0000-0000-00000000000d', 'd2700000-0000-0000-0000-00000000000a', 'Chaussettes test', 'T-shirts et polos', 500, 'homme'),
  ('e2700000-0000-0000-0000-00000000000b', 'd2700000-0000-0000-0000-00000000000b', 'Polo test', 'T-shirts et polos', 3500, 'homme');
insert into tailles (article_id, libelle, disponible)
select a, 'M', true from unnest(array['e2700000-0000-0000-0000-00000000000a','e2700000-0000-0000-0000-00000000000b',
  'e2700000-0000-0000-0000-00000000000c','e2700000-0000-0000-0000-00000000000d']::uuid[]) a;
update tailles set quantite = 200 where article_id::text like 'e2700000-%';

-- Commande d'un client (vieillie de 2 h pour ne pas toucher aux limites par heure), confirmée puis prête.
create function pg_temp.vieillir(c uuid) returns void language sql security definer as $$
  update commandes set cree_le = cree_le - interval '2 hours' where id = c;
$$;
create function pg_temp.commande(client uuid, article uuid, quantite integer default 1, bon boolean default false) returns uuid language plpgsql as $$
declare c uuid; b uuid := (select boutique_id from articles where id = article);
begin
  perform pg_temp.compte(client);
  c := passer_commande(b, format('[{"article_id":"%s","taille":"M","quantite":%s}]', article, quantite)::jsonb);
  if bon then perform utiliser_bon(c); end if;
  perform pg_temp.compte(null);
  perform pg_temp.vieillir(c);
  return c;
end $$;
create function pg_temp.commercant(c uuid) returns uuid language sql security definer as $$
  select p.id from profils p join commandes x on x.boutique_id = p.boutique_id where x.id = c and p.role = 'commercant'
$$;
create function pg_temp.retrait(c uuid) returns prive.retraits language sql security definer as $$
  select * from prive.retraits where commande_id = c
$$;
create function pg_temp.prete(c uuid) returns uuid language plpgsql as $$
declare m uuid := pg_temp.commercant(c);
begin
  perform pg_temp.compte(m);
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  perform pg_temp.compte(null);
  return c;
end $$;
-- Remise par QR code (jeton), par code à 4 chiffres, ou « Remis sans QR code » (bouton manuel).
create function pg_temp.remettre(c uuid, mode text) returns text language plpgsql as $$
declare m uuid := pg_temp.commercant(c);
  j text := (pg_temp.retrait(c)).jeton; k text := (pg_temp.retrait(c)).code; r jsonb;
begin
  perform pg_temp.compte(m);
  if mode = 'qr' then r := remettre_commande(j);
  elsif mode = 'code' then r := remettre_commande(code => k);
  else perform changer_statut_commande(c, 'recuperee'); r := '{"etat":"remise"}';
  end if;
  perform pg_temp.compte(null);
  return r ->> 'etat';
end $$;
create function pg_temp.choisir(client uuid, saisie text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.compte(client);
  r := choisir_parrain(saisie);
  perform pg_temp.compte(null);
  return r;
end $$;

\set p1 c2700000-0000-0000-0000-000000000001
\set admin 00000000-0000-0000-0000-00000000000a
\set robe e2700000-0000-0000-0000-00000000000a
\set polo e2700000-0000-0000-0000-00000000000b
\set foulard e2700000-0000-0000-0000-00000000000c
\set chaussettes e2700000-0000-0000-0000-00000000000d

-- ---------------------------------------------------------------------------
-- 1. Interrupteur et code de parrainage
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270001')$$, '55000', 'pas ouvert', 'interrupteur éteint : choix du parrain refusé');
select pg_temp.erreur($$select mon_code_parrainage()$$, '55000', 'pas ouvert', 'interrupteur éteint : pas de code');
reset role;
insert into prive.reglages (cle, valeur) values ('parrainage', 'on');
set local role authenticated;
select pg_temp.compte(:'p1') \g /dev/null
select mon_code_parrainage() as code1 \gset
select pg_temp.ok(:'code1' ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' and mon_code_parrainage() = :'code1',
  'code de 6 caractères sans 0/O/1/I/L, toujours le même');
-- Le client ne change pas son code ni son exclusion en direct.
update profils set code_parrainage = 'AAAAAA', parrainage_exclu = true where id = :'p1';
select pg_temp.ok((select code_parrainage = :'code1' and not parrainage_exclu from profils where id = :'p1'),
  'code et exclusion non modifiables par le client');
select pg_temp.erreur($$insert into bons (profil_id, origine) values (auth.uid(), 'parrainage_filleul')$$, '42501', '', 'le client ne crée pas de bon');
select pg_temp.ok((select count(*) from parrainages) = 0, 'table des parrainages : rien de visible pour un client');
select pg_temp.compte('c2700000-0000-0000-0000-0000000000ff') \g /dev/null
select pg_temp.erreur($$select mon_code_parrainage()$$, '42501', 'numéro vérifié', 'numéro non vérifié : pas de code');
select pg_temp.compte('b2700000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.erreur($$select mon_code_parrainage()$$, '42501', '', 'commerçant : pas de code');
update boutiques set bons_acceptes = false where id = 'd2700000-0000-0000-0000-00000000000a';
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select bons_acceptes from boutiques where id = 'd2700000-0000-0000-0000-00000000000a'),
  'le commerçant ne retire pas sa boutique des bons');

-- ---------------------------------------------------------------------------
-- 2. Choix du parrain : erreurs du filleul, pas d'énumération
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000002', '+213555270001') = 'enregistre', 'numéro du parrain : « enregistre »');
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000003', '+213555270077') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000004', '+213555270019') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000005', '+213555279999') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000006', :'code1') = 'enregistre',
  'même réponse : numéro inconnu, client bloqué, numéro non vérifié, code valide (pas d''énumération)');
reset role;
select pg_temp.ok((select parrain_id from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000002') = :'p1'
  and (select parrain_id from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000006') = :'p1'
  and (select count(*) from parrainages where filleul_id in ('c2700000-0000-0000-0000-000000000003', 'c2700000-0000-0000-0000-000000000004',
       'c2700000-0000-0000-0000-000000000005') and parrain_id is null) = 3,
  'parrain trouvé par numéro ou code ; numéro inconnu, bloqué ou non vérifié : aucun parrain (silencieux)');
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_name = 'parrainages' and column_name like '%telephone%'),
  'aucun numéro stocké dans les parrainages');
set local role authenticated;
select pg_temp.compte('c2700000-0000-0000-0000-000000000007') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270007')$$, '23514', 'propre numéro', 'son propre numéro refusé');
select pg_temp.erreur($$select choisir_parrain('0555')$$, '22023', '6 caractères', 'saisie mal écrite refusée');
select pg_temp.compte('c2700000-0000-0000-0000-0000000000ff') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270001')$$, '23514', 'Vérifie ton numéro', 'filleul au numéro non vérifié refusé');
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270002')$$, '23514', '7 jours', 'inscrit depuis plus de 7 jours : refusé');
select pg_temp.compte(null) \g /dev/null
-- Boucle : le parrain plus ancien choisit son filleul → aucun parrain (silencieux).
reset role;
update profils set cree_le = now() - interval '2 days' where id = 'c2700000-0000-0000-0000-000000000008';
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000009', '+213555270008') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000008', '+213555270009') = 'enregistre', 'boucle A ↔ B : même réponse');
reset role;
select pg_temp.ok((select parrain_id from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000009') = 'c2700000-0000-0000-0000-000000000008'
  and (select parrain_id from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000008') is null, 'boucle refusée en silence');
-- 3 saisies au plus, un seul parrain.
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000003', '+213555270001') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000003', '+213555270078') = 'enregistre', '2e et 3e saisies acceptées');
select pg_temp.compte('c2700000-0000-0000-0000-000000000003') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270001')$$, '54000', '2 fois', '4e saisie refusée');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select count(*) = 1 and max(saisies) = 3 from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000003'),
  'un seul parrainage par filleul, 3 saisies');
-- Numéro déjà parrainé (compte recréé avec le même numéro) : refusé.
delete from auth.users where id = 'c2700000-0000-0000-0000-000000000006';
insert into auth.users (id, phone, phone_confirmed_at) values ('c2700000-0000-0000-0000-000000000066', '213555270006', now());
update profils set nom = 'Recycle Test' where id = 'c2700000-0000-0000-0000-000000000066';
set local role authenticated;
select pg_temp.compte('c2700000-0000-0000-0000-000000000066') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270001')$$, '23514', 'déjà été parrainé', 'numéro déjà filleul : refusé');
select pg_temp.compte(null) \g /dev/null

-- ---------------------------------------------------------------------------
-- 3. Validation à la première commande récupérée
-- ---------------------------------------------------------------------------
-- Pas à « prête » ; après une commande, le parrain ne se choisit plus.
select pg_temp.commande('c2700000-0000-0000-0000-000000000002', :'robe') as f2c1 \gset
select pg_temp.compte('c2700000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur($$select choisir_parrain('+213555270001')$$, '23514', 'avant ta première commande', 'commande déjà passée : parrain figé');
select pg_temp.ok((mon_parrainage() ->> 'peut_choisir')::boolean = false and (mon_parrainage() ->> 'parrain_saisi')::boolean, 'mon_parrainage : choix fermé, parrain saisi');
select pg_temp.compte(null) \g /dev/null
select pg_temp.prete(:'f2c1') \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000002') = 'en_attente', 'commande prête : rien encore');
set local role authenticated;
select pg_temp.ok(pg_temp.remettre(:'f2c1', 'qr') = 'remise', 'remise par QR code');
reset role;
select pg_temp.ok((select statut = 'valide' and commande_id = :'f2c1' and valide_le is not null from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000002')
  and (select count(*) from bons where parrainage_id = 'c2700000-0000-0000-0000-000000000002' and statut = 'disponible' and montant = 300
       and expire_le between now() + interval '59 days' and now() + interval '61 days') = 2
  and exists (select 1 from bons where profil_id = :'p1' and origine = 'parrainage_parrain')
  and exists (select 1 from bons where profil_id = 'c2700000-0000-0000-0000-000000000002' and origine = 'parrainage_filleul'),
  'première commande ≥ 2 000 DA remise par QR code : validé, un bon de 300 DA chacun, valable 60 jours');
set local role authenticated;
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.ok((mon_parrainage() -> 'filleuls' -> 0 ->> 'prenom') = 'Samir B.' and position('+213' in mon_parrainage()::text) = 0,
  'le parrain voit « Samir B. », jamais un numéro');
select pg_temp.ok(jsonb_array_length(mes_bons()) = 1 and (mes_bons() -> 0 ->> 'statut') = 'disponible', 'mes_bons : le bon du parrain');
select pg_temp.ok((select count(*) from bons) = 1, 'le client ne lit que ses bons');
select pg_temp.compte(null) \g /dev/null
-- Une 2e commande récupérée ne change rien.
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000002', :'polo')) as f2c2 \gset
select pg_temp.ok(pg_temp.remettre(:'f2c2', 'code') = 'remise', 'deuxième commande remise par code');
reset role;
select pg_temp.ok((select count(*) from bons where parrainage_id = 'c2700000-0000-0000-0000-000000000002') = 2, 'deuxième commande : aucun bon de plus');

-- Code à 4 chiffres : valide aussi. Filleul 10.
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000010', :'code1') = 'enregistre', 'filleul 10 choisit le code');
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000010', :'polo')) as f10 \gset
select pg_temp.remettre(:'f10', 'code') \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000010') = 'valide', 'remise par code à 4 chiffres : validé');

-- « Remis sans QR code » : non validé, et une commande suivante ne rattrape pas.
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000011', :'code1') = 'enregistre', 'filleul 11');
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000011', :'robe')) as f11 \gset
select pg_temp.remettre(:'f11', 'manuel') \g /dev/null
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000011', :'polo')) as f11b \gset
select pg_temp.remettre(:'f11b', 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut = 'non_valide' and motif = 'remise_sans_qr_code' from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000011')
  and not exists (select 1 from bons where parrainage_id = 'c2700000-0000-0000-0000-000000000011'),
  '« Remis sans QR code » : non validé, la commande suivante ne rattrape pas');

-- Moins de 2 000 DA : non validé.
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000012', :'code1') = 'enregistre', 'filleul 12');
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000012', :'foulard')) as f12 \gset
select pg_temp.remettre(:'f12', 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut = 'non_valide' and motif = 'moins_de_2000_da' from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000012'),
  'première commande de 1 500 DA : non validé');

-- Après 60 jours : non validé ; commande annulée : le parrainage reste en attente.
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000013', :'code1') = 'enregistre', 'filleul 13');
select pg_temp.commande('c2700000-0000-0000-0000-000000000013', :'robe') as f13a \gset
select pg_temp.compte('c2700000-0000-0000-0000-000000000013') \g /dev/null
select changer_statut_commande(:'f13a', 'annulee') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000013') = 'en_attente', 'commande annulée : toujours en attente');
update profils set cree_le = now() - interval '61 days' where id = 'c2700000-0000-0000-0000-000000000013';
set local role authenticated;
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000013', :'robe')) as f13 \gset
select pg_temp.remettre(:'f13', 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut = 'non_valide' and motif = 'apres_60_jours' from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000013'),
  'premier retrait après 60 jours : non validé');

-- Saisie sans parrain possible : rien, en silence.
set local role authenticated;
select pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000005', :'robe')) as f5 \gset
select pg_temp.remettre(:'f5', 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000005') = 'non_valide'
  and not exists (select 1 from bons where profil_id = 'c2700000-0000-0000-0000-000000000005'), 'sans parrain : aucun bon');

-- ---------------------------------------------------------------------------
-- 4. Plafond de 5 par parrain et par mois ; parrain exclu
-- ---------------------------------------------------------------------------
-- Déjà 2 validés (filleuls 2 et 10). Filleuls 14, 15, 16 → 5 ; filleul 17 → plafond (bon du filleul seul).
set local role authenticated;
select pg_temp.choisir(('c2700000-0000-0000-0000-0000000000' || i)::uuid, :'code1') from generate_series(14, 17) i \g /dev/null
select pg_temp.remettre(pg_temp.prete(pg_temp.commande(('c2700000-0000-0000-0000-0000000000' || i)::uuid, :'polo')), 'qr') from generate_series(14, 17) i \g /dev/null
reset role;
select pg_temp.ok((select count(*) from parrainages where parrain_id = :'p1' and statut = 'valide') = 5
  and (select statut = 'plafond' and motif = 'plafond' from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000017')
  and (select count(*) from bons where parrainage_id = 'c2700000-0000-0000-0000-000000000017') = 1
  and (select count(*) from bons where profil_id = :'p1') = 5,
  'plafond : 5 parrainages récompensés, le 6e donne le bon du filleul seulement');
set local role authenticated;
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.ok((mon_parrainage() ->> 'plafond_atteint')::boolean and jsonb_array_length(mon_parrainage() -> 'filleuls') = 5, 'mon_parrainage : plafond atteint');
select pg_temp.compte(null) \g /dev/null
reset role;

-- ---------------------------------------------------------------------------
-- 5. Budget : file, émission dans l'ordre
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c2700000-0000-0000-0000-000000000002') \g /dev/null
select pg_temp.erreur($$select regler_budget_parrainage(0)$$, '42501', 'administrateur', 'budget : réglage réservé à l''admin');
select pg_temp.erreur($$select budget_parrainage()$$, '42501', 'administrateur', 'budget : lecture réservée à l''admin');
select pg_temp.compte(:'admin') \g /dev/null
select pg_temp.ok((budget_parrainage() ->> 'emis')::integer = 3300 and (budget_parrainage() ->> 'budget')::integer = 30000, 'budget : 3 300 DA émis sur 30 000');
select regler_budget_parrainage(3300) \g /dev/null
select pg_temp.compte(null) \g /dev/null
-- Nouveau parrain (18, inscrit il y a 20 jours) et deux filleuls : 7 et 4 (dont la saisie précédente est effacée).
reset role;
update profils set cree_le = now() - interval '20 days' where id = 'c2700000-0000-0000-0000-000000000018';
delete from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000004';
set local role authenticated;
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000007', '+213555270018') = 'enregistre'
  and pg_temp.choisir('c2700000-0000-0000-0000-000000000004', '+213555270018') = 'enregistre', 'filleuls 7 et 4 choisissent 18');
select pg_temp.remettre(pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000007', :'polo')), 'qr') \g /dev/null
select pg_temp.remettre(pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000004', :'polo')), 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000007') = 'en_file'
  and (select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000004') = 'en_file'
  and (select count(*) from bons where statut = 'en_file' and expire_le is null) = 4,
  'budget atteint : parrainages et bons en file (aucun bon séparé)');
set local role authenticated;
select pg_temp.compte('c2700000-0000-0000-0000-000000000007') \g /dev/null
select pg_temp.ok((mes_bons() -> 0 ->> 'statut') = 'en_file', 'le filleul voit son bon en file');
select pg_temp.compte(:'admin') \g /dev/null
select regler_budget_parrainage(3900) \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000007') = 'valide'
  and (select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000004') = 'en_file',
  'budget relevé de 600 DA : le premier de la file est émis, pas le second (ordre des validations)');
-- Le 1er du mois suivant : nouveau budget (les bons émis passent au mois précédent).
update bons set cree_le = cree_le - interval '40 days' where statut <> 'en_file';
select prive.parrainage_quotidien() ->> 'parrainages_emis' as emis \gset
select pg_temp.ok(:'emis' = '1'
  and (select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000004') = 'valide'
  and (select count(*) from bons where statut = 'en_file') = 0, 'nouveau mois : la file est émise');
-- Budget à 0 : aucun nouveau bon.
set local role authenticated;
select pg_temp.compte(:'admin') \g /dev/null
select regler_budget_parrainage(0) \g /dev/null
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000020', '+213555270018') = 'enregistre', 'filleul 20');
select pg_temp.remettre(pg_temp.prete(pg_temp.commande('c2700000-0000-0000-0000-000000000020', :'polo')), 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000020') = 'en_file'
  and not exists (select 1 from bons where parrainage_id = 'c2700000-0000-0000-0000-000000000020' and statut <> 'en_file'),
  'budget à 0 : aucun bon créé, parrainage en file');
-- Parrain exclu : bon du filleul seulement (statut refusé).
update prive.reglages set valeur = '30000' where cle = 'parrainage_budget_mois';
select prive.emettre_bons_en_file() \g /dev/null
set local role authenticated;
select pg_temp.compte(:'admin') \g /dev/null
select exclure_parrainage('c2700000-0000-0000-0000-000000000018', true) \g /dev/null
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok(pg_temp.choisir('c2700000-0000-0000-0000-000000000009', '+213555270018') = 'enregistre', 'filleul 9 choisit un parrain exclu');
reset role;
select pg_temp.ok((select parrain_id from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000009') is null
  and (select bloque from profils where id = 'c2700000-0000-0000-0000-000000000018') = false,
  'parrain exclu : plus choisissable ; l''exclusion ne bloque pas le compte');

-- ---------------------------------------------------------------------------
-- 6. Bons : un par commande, 1 000 DA minimum, réservé, rendu, utilisé, expiré
-- ---------------------------------------------------------------------------
\set f2 c2700000-0000-0000-0000-000000000002
set local role authenticated;
select pg_temp.commande(:'f2', :'chaussettes', 1) as petite \gset
select pg_temp.compte(:'f2') \g /dev/null
select pg_temp.ok(utiliser_bon(:'petite') = 'minimum', 'commande de 500 DA : bon refusé (1 000 DA minimum)');
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.erreur(format('select utiliser_bon(%L)', :'petite'), 'P0002', 'introuvable', 'commande d''un autre compte : refusé');
select pg_temp.compte(null) \g /dev/null
select pg_temp.commande(:'f2', :'robe', 1, true) as cb1 \gset
select pg_temp.commande(:'f2', :'robe', 1) as cb2 \gset
select pg_temp.compte(:'f2') \g /dev/null
select pg_temp.ok(utiliser_bon(:'cb2') = 'aucun_bon', 'bon réservé : pas réutilisable sur une autre commande');
select pg_temp.ok(utiliser_bon(:'cb1') = 'deja', 'un seul bon par commande');
select pg_temp.ok((select remise_bon = 300 and total = 2500 and bon_id is not null from commandes where id = :'cb1'),
  'commande avec bon : remise 300, total inchangé (2 500 DA)');
select pg_temp.ok((mes_bons() -> 0 ->> 'statut') = 'reserve' and (mes_bons() -> 0 ->> 'numero')::bigint = (select numero from commandes where id = :'cb1'),
  'mes_bons : réservé pour la commande n°');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select parametres ->> 3 from messages_whatsapp where commande_id = :'cb1' and modele like 'oranpromo_nouvelle_commande%')
  = '2 200 DA à encaisser (bon parrainage −300 DA)'
  and (select texte like '%, 2 200 DA à encaisser (bon parrainage −300 DA). %' from messages_whatsapp where commande_id = :'cb1' and modele like 'oranpromo_nouvelle_commande%'),
  'message « nouvelle commande » à la boutique : montant à encaisser');
-- Annulée → bon rendu (au moins 7 jours de validité).
update bons set expire_le = now() + interval '1 day' where commande_id = :'cb1';
set local role authenticated;
select pg_temp.compte(:'f2') \g /dev/null
select changer_statut_commande(:'cb1', 'annulee') \g /dev/null
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut = 'disponible' and commande_id is null and expire_le > now() + interval '6 days' from bons where profil_id = :'f2')
  and (select remise_bon from commandes where id = :'cb1') = 0, 'annulée : bon rendu, validité repoussée à 7 jours au moins');
-- Expirée → rendu.
set local role authenticated;
select pg_temp.prete(pg_temp.commande(:'f2', :'polo', 1, true)) as cb3 \gset
reset role;
update commandes set expire_le = now() - interval '1 minute' where id = :'cb3';
select prive.expirer_commandes() \g /dev/null
select pg_temp.ok((select statut from bons where profil_id = :'f2') = 'disponible' and (select remise_bon from commandes where id = :'cb3') = 0,
  'expirée : bon rendu');
-- Remis sans QR code → rendu, rien à rembourser.
set local role authenticated;
select pg_temp.prete(pg_temp.commande(:'f2', :'polo', 1, true)) as cb4 \gset
select pg_temp.remettre(:'cb4', 'manuel') \g /dev/null
reset role;
select pg_temp.ok((select statut from bons where profil_id = :'f2') = 'disponible' and (select remise_bon from commandes where id = :'cb4') = 0
  and not exists (select 1 from lignes_releve where commande_id = :'cb4'), '« Remis sans QR code » : bon rendu, aucune ligne de relevé');
-- Remise par QR code → utilisé, ligne de relevé.
set local role authenticated;
select pg_temp.prete(pg_temp.commande(:'f2', :'polo', 1, true)) as cb5 \gset
select pg_temp.compte('b2700000-0000-0000-0000-00000000000b') \g /dev/null
reset role;
select jeton as j5 from prive.retraits where commande_id = :'cb5' \gset
set local role authenticated;
select pg_temp.compte('b2700000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.ok((retrait_boutique(:'j5') ->> 'remise_bon')::integer = 300 and (retrait_boutique(:'j5') ->> 'total')::integer = 3500,
  'résumé du scan : total 3 500 DA et bon de 300 DA');
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok((retrait_par_lien(:'j5') ->> 'remise_bon')::integer = 300, 'page du proche : bon de 300 DA');
select pg_temp.remettre(:'cb5', 'qr') \g /dev/null
reset role;
select pg_temp.ok((select statut = 'utilise' and utilise_le is not null and releve_id is not null from bons where profil_id = :'f2')
  and (select remise_bon from commandes where id = :'cb5') = 300
  and (select count(*) = 1 and min(montant) = 300 and min(mode_remise) = 'qr' and min(client) = 'Samir B.' and min(total_commande) = 3500
       from lignes_releve where commande_id = :'cb5'),
  'remise par QR code : bon utilisé, ligne de relevé (300 DA, qr, « Samir B. »)');
select id as releve from releves_bons where boutique_id = 'd2700000-0000-0000-0000-00000000000b' \gset
select pg_temp.ok((select nombre = 1 and montant = 300 and statut = 'en_cours' and mois = prive.mois_alger() from releves_bons where id = :'releve'),
  'relevé en cours du mois : 1 bon, 300 DA');
-- Bon expiré : inutilisable, puis marqué expiré par la tâche quotidienne.
update bons set expire_le = now() - interval '1 minute' where profil_id = :'p1';
set local role authenticated;
select pg_temp.commande(:'p1', :'robe') as cp \gset
select pg_temp.compte(:'p1') \g /dev/null
select pg_temp.ok(utiliser_bon(:'cp') = 'aucun_bon', 'bon expiré : non utilisable');
select pg_temp.compte(null) \g /dev/null
reset role;
select prive.parrainage_quotidien() \g /dev/null
select pg_temp.ok((select count(*) from bons where profil_id = :'p1' and statut = 'expire') = 5, 'tâche quotidienne : bons expirés');
-- Boutique retirée des bons.
update bons set expire_le = now() + interval '10 days', statut = 'disponible' where profil_id = 'c2700000-0000-0000-0000-000000000010';
set local role authenticated;
select pg_temp.compte(:'admin') \g /dev/null
select retirer_boutique_des_bons('d2700000-0000-0000-0000-00000000000a', true) \g /dev/null
select pg_temp.compte(null) \g /dev/null
select pg_temp.commande('c2700000-0000-0000-0000-000000000010', :'robe') as c10 \gset
select pg_temp.compte('c2700000-0000-0000-0000-000000000010') \g /dev/null
select pg_temp.ok(utiliser_bon(:'c10') = 'boutique_exclue', 'boutique retirée des bons : bon refusé');
select pg_temp.compte(null) \g /dev/null
reset role;

-- ---------------------------------------------------------------------------
-- 7. Relevés : clôture, mise de côté, paiement définitif
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('b2700000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.ok((select count(*) from releves_bons) = 0 and (select count(*) from lignes_releve) = 0, 'une boutique ne voit pas les relevés des autres');
select pg_temp.compte('b2700000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.ok((select count(*) from releves_bons) = 1 and (select count(*) from lignes_releve) = 1, 'la boutique voit son relevé et ses lignes');
select pg_temp.erreur(format('select marquer_releve_paye(%L, %L, current_date)', :'releve', 'CCP 123'), '42501', 'administrateur', 'payé : réservé à l''admin');
select pg_temp.compte(:'admin') \g /dev/null
select pg_temp.erreur(format('select marquer_releve_paye(%L, %L, current_date)', :'releve', 'CCP 123'), '23514', 'clôturé', 'relevé en cours : pas encore payable');
select pg_temp.compte(null) \g /dev/null
reset role;
update releves_bons set mois = (prive.mois_alger() - interval '1 month')::date where id = :'releve';
select prive.parrainage_quotidien() \g /dev/null
select pg_temp.ok((select statut = 'a_payer' and cloture_le is not null from releves_bons where id = :'releve'), 'clôture : relevé du mois passé « à payer »');
select id as ligne from lignes_releve where releve_id = :'releve' \gset
set local role authenticated;
select pg_temp.compte(:'admin') \g /dev/null
select pg_temp.erreur(format('select mettre_de_cote(%L, %L)', :'ligne', ''), '23514', 'Motif', 'mise de côté : motif obligatoire');
select mettre_de_cote(:'ligne', 'Retrait 9 minutes après « Prête »') \g /dev/null
select pg_temp.ok((select nombre = 0 and montant = 0 from releves_bons where id = :'releve'), 'ligne mise de côté : hors du total');
select decider_ligne(:'ligne', 'rembourser', 'Vérifié avec la boutique') \g /dev/null
select pg_temp.ok((select l.statut = 'a_rembourser' and r.statut = 'en_cours' and r.montant = 300 from lignes_releve l join releves_bons r on r.id = l.releve_id where l.id = :'ligne'),
  '« Rembourser » : la ligne passe sur le relevé en cours');
select pg_temp.erreur(format('select marquer_releve_paye(%L, %L, current_date)', :'releve', 'x'), '23514', 'Référence', 'référence du virement obligatoire');
select marquer_releve_paye(:'releve', 'CCP 4471', current_date) \g /dev/null
select pg_temp.ok((select statut = 'paye' and reference_paiement = 'CCP 4471' and paye_par = :'admin' from releves_bons where id = :'releve'), 'relevé marqué comme payé');
select pg_temp.erreur(format('select marquer_releve_paye(%L, %L, current_date)', :'releve', 'CCP 9999'), '23514', 'clôturé', 'relevé payé : pas deux fois');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.erreur(format('update releves_bons set montant = 0 where id = %L', :'releve'), '42501', 'plus modifiable', 'relevé payé : figé, même pour le service');
select pg_temp.erreur(format('delete from releves_bons where id = %L', :'releve'), '42501', 'plus modifiable', 'relevé payé : impossible à supprimer');

-- ---------------------------------------------------------------------------
-- 8. Admin : annuler les bons d'un parrainage ; parrainages en attente expirés
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte(:'admin') \g /dev/null
select pg_temp.ok(annuler_bons_parrainage('c2700000-0000-0000-0000-000000000014', 'Faux compte probable') = 1, 'annuler les bons non utilisés d''un parrainage (celui du parrain a déjà expiré)');
select pg_temp.compte(null) \g /dev/null
reset role;
select pg_temp.ok((select statut = 'annule' and motif = 'Faux compte probable' from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000014'), 'parrainage annulé, motif gardé');
update profils set cree_le = now() - interval '61 days' where id = 'c2700000-0000-0000-0000-000000000003';
select prive.parrainage_quotidien() \g /dev/null
select pg_temp.ok((select statut from parrainages where filleul_id = 'c2700000-0000-0000-0000-000000000003') = 'expire', 'en attente depuis plus de 60 jours : expiré');
-- Blocage : un client bloqué ne commande toujours pas, bon ou pas (règle de passer_commande inchangée).
set local role authenticated;
select pg_temp.compte('c2700000-0000-0000-0000-000000000019') \g /dev/null
select pg_temp.erreur(format('select passer_commande(%L, %L::jsonb)', 'd2700000-0000-0000-0000-00000000000b',
  '[{"article_id":"e2700000-0000-0000-0000-00000000000b","taille":"M","quantite":1}]'), '42501', 'bloqué', 'client bloqué : commande toujours refusée');
select pg_temp.compte(null) \g /dev/null
reset role;

rollback;

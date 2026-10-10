-- Tests SQL des lectures de l'administration du parrainage (US-27.5) : ce que lisent /admin/parrainages,
-- /admin/remboursements, l'export CSV et le bloc « Bons parrainage à rembourser » de /espace (aucune migration).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parrainage_admin.test.sql
-- Transaction annulée à la fin : aucune donnée n'est gardée.
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
create function pg_temp.compte(id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(id::text, ''), true);
$$;

-- Données : admin, 2 boutiques et leurs commerçants, un parrain et deux filleuls, une commande remise par code.
insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'admin275@test.dz'),
  ('a5000000-0000-0000-0000-00000000000a', 'boutique275a@test.dz'), ('a5000000-0000-0000-0000-00000000000b', 'boutique275b@test.dz');
insert into auth.users (id, phone, phone_confirmed_at) values
  ('a5000000-0000-0000-0000-000000000011', '213555275011', now()), ('a5000000-0000-0000-0000-000000000012', '213555275012', now()),
  ('a5000000-0000-0000-0000-000000000013', '213555275013', now());
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('a5100000-0000-0000-0000-00000000000a', 'Boutique Admin A', 'boutique-admin-a', 'Gambetta', '+213555275901', 'validee', 'oran'),
  ('a5100000-0000-0000-0000-00000000000b', 'Boutique Admin B', 'boutique-admin-b', 'Centre', '+213555275902', 'validee', 'oran');
update profils set role = 'admin' where id = 'a5000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'a5100000-0000-0000-0000-00000000000a' where id = 'a5000000-0000-0000-0000-00000000000a';
update profils set role = 'commercant', boutique_id = 'a5100000-0000-0000-0000-00000000000b' where id = 'a5000000-0000-0000-0000-00000000000b';
update profils set nom = 'Parrain Test' where id = 'a5000000-0000-0000-0000-000000000011';
update profils set nom = 'Filleul Un' where id = 'a5000000-0000-0000-0000-000000000012';
update profils set nom = 'Filleul Deux' where id = 'a5000000-0000-0000-0000-000000000013';
insert into commandes (id, client_id, boutique_id, client_nom, client_telephone, total) values
  ('a5200000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000012', 'a5100000-0000-0000-0000-00000000000a', 'Filleul Un', '+213555275012', 3500);
insert into parrainages (filleul_id, parrain_id, statut, commande_id, boutique_id, valide_le) values
  ('a5000000-0000-0000-0000-000000000012', 'a5000000-0000-0000-0000-000000000011', 'valide', 'a5200000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-00000000000a', now()),
  ('a5000000-0000-0000-0000-000000000013', 'a5000000-0000-0000-0000-000000000011', 'en_attente', null, null, null);
insert into bons (id, profil_id, origine, parrainage_id, statut, expire_le) values
  ('a5300000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000012', 'parrainage_filleul', 'a5000000-0000-0000-0000-000000000012', 'disponible', now() + interval '60 days'),
  ('a5300000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000011', 'parrainage_parrain', 'a5000000-0000-0000-0000-000000000012', 'disponible', now() + interval '60 days');
insert into releves_bons (id, boutique_id, mois, nombre, montant, statut) values
  ('a5400000-0000-0000-0000-00000000000a', 'a5100000-0000-0000-0000-00000000000a', prive.mois_alger(), 1, 300, 'en_cours'),
  ('a5400000-0000-0000-0000-00000000000b', 'a5100000-0000-0000-0000-00000000000b', prive.mois_alger(), 0, 0, 'en_cours');
insert into lignes_releve (releve_id, commande_id, boutique_id, montant, remise_le, mode_remise, numero_commande, total_commande, client) values
  ('a5400000-0000-0000-0000-00000000000a', 'a5200000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-00000000000a', 300, now(), 'code',
   (select numero from commandes where id = 'a5200000-0000-0000-0000-000000000001'), 3500, 'Filleul U.');

select prive.mois_alger() as mois \gset
set local role authenticated;

-- 1. Admin : tout ce que lisent /admin/parrainages et /admin/remboursements (mêmes jointures que lib/parrainage-admin.ts).
select pg_temp.compte('a5000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok((select count(*) from parrainages p
  join profils f on f.id = p.filleul_id join profils pa on pa.id = p.parrain_id
  where p.parrain_id = 'a5000000-0000-0000-0000-000000000011' and f.telephone is not null and pa.nom = 'Parrain Test') = 2,
  'admin : parrainages avec filleul et parrain (nom, numéro pour le masquer)');
select pg_temp.ok((select c.total = 3500 and b.nom = 'Boutique Admin A' and b.bons_acceptes from parrainages p
  join commandes c on c.id = p.commande_id join boutiques b on b.id = p.boutique_id
  where p.filleul_id = 'a5000000-0000-0000-0000-000000000012'), 'admin : commande et boutique du parrainage');
select pg_temp.ok((select count(*) from bons where parrainage_id = 'a5000000-0000-0000-0000-000000000012') = 2, 'admin : bons du parrainage');
select pg_temp.ok((select count(*) from releves_bons where mois = :'mois' and boutique_id::text like 'a5100000-%') = 2,
  'admin : relevés de toutes les boutiques du mois');
select pg_temp.ok((select l.mode_remise = 'code' and c.cree_le is not null from lignes_releve l join commandes c on c.id = l.commande_id
  where l.releve_id = 'a5400000-0000-0000-0000-00000000000a'), 'admin : lignes du relevé avec dates de la commande (signaux)');
select pg_temp.ok((select (budget_parrainage()->>'budget')::integer >= 0 and (budget_parrainage()->>'emis') is not null), 'admin : budget lisible');

-- 2. Commerçant : seulement ses relevés et ses lignes ; aucun parrainage, aucun bon.
select pg_temp.compte('a5000000-0000-0000-0000-00000000000a') \g /dev/null
select pg_temp.ok((select count(*) from releves_bons where boutique_id::text like 'a5100000-%') = 1
  and (select boutique_id from releves_bons where boutique_id::text like 'a5100000-%') = 'a5100000-0000-0000-0000-00000000000a',
  'boutique A : son relevé seulement');
select pg_temp.ok((select count(*) from releves_bons r join lignes_releve l on l.releve_id = r.id where r.boutique_id = 'a5100000-0000-0000-0000-00000000000a') = 1,
  'boutique A : ses lignes (bloc « Bons parrainage à rembourser »)');
select pg_temp.ok((select count(*) from parrainages) = 0 and (select count(*) from bons where profil_id::text like 'a5000000-%') = 0,
  'boutique : aucun parrainage, aucun bon de client');
select pg_temp.ok(not exists (select 1 from lignes_releve where client ~ '\d{6}'), 'ligne de relevé : prénom + initiale, jamais de numéro');
select pg_temp.compte('a5000000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.ok((select count(*) from lignes_releve where boutique_id = 'a5100000-0000-0000-0000-00000000000a') = 0,
  'boutique B : ne voit pas les lignes de A');

-- 3. Client : ni relevés, ni parrainages ; seulement ses bons.
select pg_temp.compte('a5000000-0000-0000-0000-000000000011') \g /dev/null
select pg_temp.ok((select count(*) from releves_bons) = 0 and (select count(*) from lignes_releve) = 0 and (select count(*) from parrainages) = 0,
  'client : ni relevés ni parrainages');
select pg_temp.ok((select count(*) from bons where profil_id::text like 'a5000000-%') = 1, 'client : son bon seulement');

-- 4. Aucune écriture directe (les actions passent par les fonctions de la base).
select pg_temp.compte('a5000000-0000-0000-0000-000000000001') \g /dev/null
select pg_temp.ok(not has_table_privilege('authenticated', 'releves_bons', 'UPDATE') and not has_table_privilege('authenticated', 'lignes_releve', 'UPDATE')
  and not has_table_privilege('authenticated', 'parrainages', 'UPDATE') and not has_table_privilege('authenticated', 'bons', 'UPDATE'),
  'admin compris : aucune écriture directe sur parrainages, bons, relevés');
select pg_temp.ok(not has_table_privilege('anon', 'releves_bons', 'SELECT') and not has_table_privilege('anon', 'lignes_releve', 'SELECT'),
  'visiteur : relevés illisibles');

reset role;
rollback;

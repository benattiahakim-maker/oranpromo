-- Tests SQL de la migration 20261010160000_numero_retire_non_clients.sql (relecture n°5).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/numero_retire_non_clients.test.sql
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

-- Ce que Supabase Auth cherche pour envoyer / vérifier un code de connexion : un compte avec ce numéro.
create function pg_temp.connexion_par_code_possible(numero text) returns boolean language sql as $$
  select exists (select 1 from auth.users u where u.phone = numero and u.phone_confirmed_at is not null)
$$;

-- Admin, boutique ; clients : M (numéro vérifié, deviendra commerçant), N (numéro vérifié, deviendra admin),
-- P (changement de numéro en cours), Q (numéro saisi à la main seulement), R (reste client).
insert into auth.users (id, email) values
  ('a6000000-0000-0000-0000-000000000001', 'admin6@test.dz'),
  ('c6000000-0000-0000-0000-00000000000a', 'client-m@test.dz'),
  ('c6000000-0000-0000-0000-00000000000b', 'client-n@test.dz'),
  ('c6000000-0000-0000-0000-00000000000c', 'client-p@test.dz'),
  ('c6000000-0000-0000-0000-00000000000d', 'client-q@test.dz'),
  ('c6000000-0000-0000-0000-00000000000e', 'client-r@test.dz');
update profils set role = 'admin' where id = 'a6000000-0000-0000-0000-000000000001';
insert into boutiques (id, nom, slug, quartier, whatsapp, statut) values
  ('d6000000-0000-0000-0000-000000000001', 'Boutique Relecture Cinq', 'boutique-relecture-cinq', 'Centre', '+213555960001', 'validee');
-- Numéros vérifiés par code (Supabase Auth : phone_change, puis phone + phone_confirmed_at).
update auth.users set phone_change = '213555600001', phone_change_sent_at = now() where id = 'c6000000-0000-0000-0000-00000000000a';
update auth.users set phone = '213555600001', phone_confirmed_at = now(), phone_change = '' where id = 'c6000000-0000-0000-0000-00000000000a';
update auth.users set phone = '213555600002', phone_confirmed_at = now() where id = 'c6000000-0000-0000-0000-00000000000b';
update auth.users set phone = '213555600005', phone_confirmed_at = now() where id = 'c6000000-0000-0000-0000-00000000000e';
update auth.users set phone_change = '213555600003', phone_change_token = 'abc123', phone_change_sent_at = now() where id = 'c6000000-0000-0000-0000-00000000000c';
update profils set telephone = '+213555600004' where id = 'c6000000-0000-0000-0000-00000000000d';
update auth.users set phone = '213555600006', phone_confirmed_at = now() where id = 'c6000000-0000-0000-0000-00000000000d';
update profils set telephone = '+213555600004', telephone_verifie_le = null where id = 'c6000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select telephone = '+213555600001' and telephone_verifie_le is not null from profils where id = 'c6000000-0000-0000-0000-00000000000a')
  and pg_temp.connexion_par_code_possible('213555600001'), 'M : client avec numéro vérifié, connexion par code possible');

-- ---------------------------------------------------------------------------
-- Client rattaché comme commerçant (rattacher_commercant) : plus de numéro de connexion.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('a6000000-0000-0000-0000-000000000001') \g /dev/null
select rattacher_commercant('client-m@test.dz', 'd6000000-0000-0000-0000-000000000001') \g /dev/null
reset role;
select pg_temp.ok((select role = 'commercant' and boutique_id = 'd6000000-0000-0000-0000-000000000001' from profils where id = 'c6000000-0000-0000-0000-00000000000a'),
  'M : rattaché, devenu commerçant');
select pg_temp.ok((select phone is null and phone_confirmed_at is null and phone_change = '' and phone_change_sent_at is null
  from auth.users where id = 'c6000000-0000-0000-0000-00000000000a'), 'M : phone, phone_confirmed_at et phone_change vidés');
select pg_temp.ok(not pg_temp.connexion_par_code_possible('213555600001'), 'M : ne peut plus se connecter par code (numéro vide)');
select pg_temp.ok((select telephone is null and telephone_verifie_le is null from profils where id = 'c6000000-0000-0000-0000-00000000000a'),
  'M : profil sans numéro vérifié (numéro de connexion retiré du profil)');
select pg_temp.erreur($$update auth.users set phone_change = '213555600001' where id = 'c6000000-0000-0000-0000-00000000000a'$$,
  '42501', 'se connectent par e-mail', 'M : remettre un numéro reste refusé (déclencheur de la relecture n°4)');
-- Le numéro libéré peut être vérifié par un vrai client (index unique des numéros vérifiés respecté).
insert into auth.users (id, phone, phone_confirmed_at) values ('c6000000-0000-0000-0000-00000000000f', '213555600001', now());
select pg_temp.ok((select role = 'client' and telephone = '+213555600001' and telephone_verifie_le is not null
  from profils where id = 'c6000000-0000-0000-0000-00000000000f'), 'numéro libéré : un nouveau client le vérifie');
select pg_temp.ok((select count(*) = 1 from profils where telephone = '+213555600001' and telephone_verifie_le is not null),
  'index unique : un seul compte avec ce numéro vérifié');

-- ---------------------------------------------------------------------------
-- Client promu administrateur : même chose.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('a6000000-0000-0000-0000-000000000001') \g /dev/null
update profils set role = 'admin' where id = 'c6000000-0000-0000-0000-00000000000b';
reset role;
select pg_temp.ok((select role = 'admin' from profils where id = 'c6000000-0000-0000-0000-00000000000b'), 'N : promu administrateur');
select pg_temp.ok((select phone is null and phone_confirmed_at is null and phone_change = '' from auth.users where id = 'c6000000-0000-0000-0000-00000000000b')
  and not pg_temp.connexion_par_code_possible('213555600002'), 'N : ne peut plus se connecter par code (numéro vide)');
select pg_temp.ok((select telephone is null and telephone_verifie_le is null from profils where id = 'c6000000-0000-0000-0000-00000000000b'),
  'N : profil sans numéro vérifié');

-- ---------------------------------------------------------------------------
-- Autres cas
-- ---------------------------------------------------------------------------
-- Changement de numéro en cours (code envoyé, pas encore saisi) : annulé.
update profils set role = 'ambassadeur' where id = 'c6000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select phone is null and phone_change = '' and phone_change_token = '' and phone_change_sent_at is null
  from auth.users where id = 'c6000000-0000-0000-0000-00000000000c'), 'P : changement de numéro en cours annulé (ambassadeur)');
-- Numéro saisi à la main (différent du numéro de connexion) : gardé, le numéro de connexion est retiré.
update profils set role = 'commercant' where id = 'c6000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select telephone = '+213555600004' and telephone_verifie_le is null from profils where id = 'c6000000-0000-0000-0000-00000000000d')
  and (select phone is null from auth.users where id = 'c6000000-0000-0000-0000-00000000000d'),
  'Q : numéro saisi à la main gardé, numéro de connexion retiré');
-- Un client qui essaie de changer son propre rôle : refusé par proteger_profil, il garde son numéro.
set local role authenticated;
select pg_temp.compte('c6000000-0000-0000-0000-00000000000e') \g /dev/null
update profils set role = 'commercant' where id = 'c6000000-0000-0000-0000-00000000000e';
reset role;
select pg_temp.compte(null) \g /dev/null
select pg_temp.ok((select role = 'client' and telephone_verifie_le is not null from profils where id = 'c6000000-0000-0000-0000-00000000000e')
  and pg_temp.connexion_par_code_possible('213555600005'), 'R : un client ne change pas son rôle, il garde son numéro');
-- Autre modification d'un client par l'admin (nom) : numéro gardé.
update profils set nom = 'Client R' where id = 'c6000000-0000-0000-0000-00000000000e';
select pg_temp.ok(pg_temp.connexion_par_code_possible('213555600005'), 'R : modifier le nom ne retire pas le numéro');
-- Changement entre rôles non clients : rien à retirer, pas d'erreur.
update profils set role = 'ambassadeur' where id = 'c6000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select role = 'ambassadeur' from profils where id = 'c6000000-0000-0000-0000-00000000000a'), 'commerçant → ambassadeur : sans erreur');
-- Redevenir client ne rend pas le numéro (il faut le vérifier de nouveau par code).
update profils set role = 'client' where id = 'c6000000-0000-0000-0000-00000000000b';
update auth.users set phone = '213555600002', phone_confirmed_at = now() where id = 'c6000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select telephone = '+213555600002' and telephone_verifie_le is not null from profils where id = 'c6000000-0000-0000-0000-00000000000b'),
  'N redevenu client : peut de nouveau vérifier un numéro');

-- ---------------------------------------------------------------------------
-- Nettoyage unique (même requête que la migration) : un ancien commerçant qui avait encore un numéro.
-- ---------------------------------------------------------------------------
alter table profils disable trigger numero_retire_non_client;
update profils set role = 'commercant' where id = 'c6000000-0000-0000-0000-00000000000e';
alter table profils enable trigger numero_retire_non_client;
select pg_temp.ok(pg_temp.connexion_par_code_possible('213555600005'), 'nettoyage : avant, un commerçant a encore un numéro');
select prive.retirer_numero_non_client(p.id)
from profils p join auth.users u on u.id = p.id
where p.role <> 'client'
  and (u.phone is not null or u.phone_confirmed_at is not null or coalesce(u.phone_change, '') <> ''
       or p.telephone_verifie_le is not null) \g /dev/null
select pg_temp.ok(not pg_temp.connexion_par_code_possible('213555600005')
  and (select telephone is null and telephone_verifie_le is null from profils where id = 'c6000000-0000-0000-0000-00000000000e'),
  'nettoyage : numéro retiré');
select pg_temp.ok((select count(*) = 0 from profils p join auth.users u on u.id = p.id
  where p.role <> 'client' and (u.phone is not null or u.phone_change <> '' or p.telephone_verifie_le is not null)),
  'nettoyage : plus aucun compte non client avec un numéro');
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.retirer_numero_non_client(uuid)', 'execute'),
  'fonction réservée à la base');

rollback;
\echo 'Tous les tests SQL de la relecture n°5 passent.'

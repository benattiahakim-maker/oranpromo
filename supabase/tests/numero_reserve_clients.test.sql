-- Tests SQL de la migration 20261010140000_numero_reserve_clients.sql (relecture n°4, point 3).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/numero_reserve_clients.test.sql
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

insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'admin5@test.dz'),
  ('b5000000-0000-0000-0000-000000000001', 'commercant5@test.dz'),
  ('b5000000-0000-0000-0000-000000000002', 'ambassadeur5@test.dz'),
  ('c5000000-0000-0000-0000-000000000001', 'client5@test.dz');
update profils set role = 'admin' where id = 'a5000000-0000-0000-0000-000000000001';
update profils set role = 'commercant' where id = 'b5000000-0000-0000-0000-000000000001';
update profils set role = 'ambassadeur' where id = 'b5000000-0000-0000-0000-000000000002';

-- Ce que fait Supabase Auth pour « ajouter un numéro » (PUT /user { phone }) : phone_change, puis phone à la confirmation.
select pg_temp.erreur($$update auth.users set phone_change = '213555500001', phone_change_sent_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  '42501', 'se connectent par e-mail', 'un compte admin ne peut pas ajouter de numéro (phone_change)');
select pg_temp.erreur($$update auth.users set phone = '213555500001', phone_confirmed_at = now() where id = 'a5000000-0000-0000-0000-000000000001'$$,
  '42501', 'se connectent par e-mail', 'un compte admin ne peut pas recevoir de numéro (phone)');
select pg_temp.erreur($$update auth.users set phone_change = '213555500002' where id = 'b5000000-0000-0000-0000-000000000001'$$,
  '42501', 'se connectent par e-mail', 'un compte commerçant ne peut pas ajouter de numéro');
select pg_temp.erreur($$update auth.users set phone = '213555500003' where id = 'b5000000-0000-0000-0000-000000000002'$$,
  '42501', 'se connectent par e-mail', 'un compte ambassadeur ne peut pas ajouter de numéro');
select pg_temp.ok((select phone is null and coalesce(phone_change, '') = '' from auth.users where id = 'a5000000-0000-0000-0000-000000000001')
  and (select telephone_verifie_le is null from profils where id = 'a5000000-0000-0000-0000-000000000001'), 'admin : rien n''a changé');
select pg_temp.erreur($$update auth.users set phone_change = '33612345678' where id = 'b5000000-0000-0000-0000-000000000001'$$,
  '23514', 'mobiles algériens', 'un numéro étranger reste refusé avec son message habituel');

-- Un client, lui, ajoute et confirme son numéro.
update auth.users set phone_change = '213555500004', phone_change_sent_at = now() where id = 'c5000000-0000-0000-0000-000000000001';
update auth.users set phone = '213555500004', phone_confirmed_at = now(), phone_change = '' where id = 'c5000000-0000-0000-0000-000000000001';
select pg_temp.ok((select telephone = '+213555500004' and telephone_verifie_le is not null from profils where id = 'c5000000-0000-0000-0000-000000000001'),
  'un client ajoute et vérifie son numéro');

-- Un nouveau compte créé par numéro (Supabase : insertion avec phone) reste possible : c'est un client.
insert into auth.users (id, phone, phone_confirmed_at) values ('c5000000-0000-0000-0000-000000000002', '213555500005', now());
select pg_temp.ok((select role = 'client' and telephone_verifie_le is not null from profils where id = 'c5000000-0000-0000-0000-000000000002'),
  'création d''un compte par numéro : client avec numéro vérifié');

-- Retirer le numéro d'un compte devenu commerçant reste possible ; en remettre un est refusé.
update profils set role = 'commercant' where id = 'c5000000-0000-0000-0000-000000000001';
select pg_temp.erreur($$update auth.users set phone_change = '213555500006' where id = 'c5000000-0000-0000-0000-000000000001'$$,
  '42501', 'se connectent par e-mail', 'client devenu commerçant : pas de nouveau numéro');
update auth.users set phone = null, phone_confirmed_at = null where id = 'c5000000-0000-0000-0000-000000000001';
select pg_temp.ok((select phone is null from auth.users where id = 'c5000000-0000-0000-0000-000000000001'), 'retirer le numéro reste possible');
-- Les autres changements d'un compte admin (e-mail…) ne sont pas gênés.
update auth.users set email = 'admin5bis@test.dz' where id = 'a5000000-0000-0000-0000-000000000001';
select pg_temp.ok((select email = 'admin5bis@test.dz' from auth.users where id = 'a5000000-0000-0000-0000-000000000001'), 'admin : changer d''e-mail reste possible');

rollback;
\echo 'Tous les tests SQL du point 3 de la relecture n°4 passent.'

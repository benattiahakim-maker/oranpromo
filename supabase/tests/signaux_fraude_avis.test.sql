-- Tests SQL de la migration 20261019110000_signaux_fraude_avis.sql (signaux de fraude des avis, jamais automatiques).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/signaux_fraude_avis.test.sql
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


-- Boutiques : A (avis groupés), B (même numéro + retraits rapides), C (comptes récents), D (sous les seuils).
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3260000-0000-0000-0000-00000000000a', 'Atelier A', 'atelier-a-326', 'Gambetta', '+213555326001', 'validee', 'oran'),
  ('d3260000-0000-0000-0000-00000000000b', 'Boutique B', 'boutique-b-326', 'Centre', '+213555326002', 'validee', 'oran'),
  ('d3260000-0000-0000-0000-00000000000c', 'Comptoir C', 'comptoir-c-326', 'Centre', '+213555326003', 'validee', 'oran'),
  ('d3260000-0000-0000-0000-00000000000d', 'Dar D', 'dar-d-326', 'Centre', '+213555326004', 'validee', 'oran');
insert into auth.users (id, email) select ('c3260000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, 'f326-' || g || '@test.dz' from generate_series(1, 20) g;
insert into auth.users (id, email) values ('a3260000-0000-0000-0000-000000000001', 'admin326@test.dz'), ('b3260000-0000-0000-0000-000000000001', 'boutique326@test.dz');
update profils set role = 'admin' where id = 'a3260000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd3260000-0000-0000-0000-00000000000a' where id = 'b3260000-0000-0000-0000-000000000001';

set local session_replication_role = replica;
-- Comptes anciens (60 jours), sauf 11 à 13 (créés aujourd'hui).
update profils set cree_le = now() - interval '60 days' where id::text like 'c3260000-%' and id not in ('c3260000-0000-0000-0000-000000000011', 'c3260000-0000-0000-0000-000000000012', 'c3260000-0000-0000-0000-000000000013');
create temp table t_avis (n int, client int, boutique text, telephone text, note int, avis_le timestamptz, cree_le timestamptz, terminee_le timestamptz);
insert into t_avis values
  -- A : 3 avis dans la même minute (comptes anciens, 4 étoiles, retraits lents).
  (1, 1, 'a', '+213555000001', 4, date_trunc('minute', now() - interval '2 days') + interval '5 seconds', now() - interval '3 days', now() - interval '2 days 1 hour'),
  (2, 2, 'a', '+213555000002', 4, date_trunc('minute', now() - interval '2 days') + interval '20 seconds', now() - interval '3 days', now() - interval '2 days 1 hour'),
  (3, 3, 'a', '+213555000003', 4, date_trunc('minute', now() - interval '2 days') + interval '50 seconds', now() - interval '3 days', now() - interval '2 days 1 hour'),
  -- B : même numéro, 3 avis tous sur B, retraits moins de 30 minutes après la commande.
  (4, 4, 'b', '+213555123456', 4, now() - interval '5 days', now() - interval '6 days', now() - interval '6 days' + interval '10 minutes'),
  (5, 5, 'b', '+213555123456', 3, now() - interval '4 days', now() - interval '5 days', now() - interval '5 days' + interval '20 minutes'),
  (6, 6, 'b', '+213555123456', 4, now() - interval '3 days', now() - interval '4 days', now() - interval '4 days' + interval '29 minutes'),
  -- C : 5 étoiles de comptes récents, minutes différentes, retraits lents.
  (7, 11, 'c', '+213555000011', 5, now() - interval '3 hours', now() - interval '1 day', now() - interval '20 hours'),
  (8, 12, 'c', '+213555000012', 5, now() - interval '2 hours', now() - interval '1 day', now() - interval '20 hours'),
  (9, 13, 'c', '+213555000013', 5, now() - interval '1 hour', now() - interval '1 day', now() - interval '20 hours'),
  -- D : sous les seuils : 2 avis dans la même minute ; un numéro à 3 avis sur 2 boutiques ; 2 retraits rapides.
  (10, 7, 'd', '+213555777777', 5, date_trunc('minute', now() - interval '1 day') + interval '1 second', now() - interval '2 days', now() - interval '2 days' + interval '5 minutes'),
  (11, 8, 'd', '+213555777777', 5, date_trunc('minute', now() - interval '1 day') + interval '2 seconds', now() - interval '2 days', now() - interval '2 days' + interval '5 minutes'),
  (12, 9, 'a', '+213555777777', 4, now() - interval '10 days', now() - interval '11 days', now() - interval '11 days' + interval '2 hours'),
  -- Hors fenêtre : avis groupés il y a 40 jours sur D (ne compte plus).
  (13, 14, 'd', '+213555000014', 4, date_trunc('minute', now() - interval '40 days'), now() - interval '41 days', now() - interval '41 days' + interval '3 hours'),
  (14, 15, 'd', '+213555000015', 4, date_trunc('minute', now() - interval '40 days'), now() - interval '41 days', now() - interval '41 days' + interval '3 hours'),
  (15, 16, 'd', '+213555000016', 4, date_trunc('minute', now() - interval '40 days'), now() - interval '41 days', now() - interval '41 days' + interval '3 hours');
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, cree_le, terminee_le)
  select ('e3260000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, ('c3260000-0000-0000-0000-0000000000' || lpad(client::text, 2, '0'))::uuid,
         ('d3260000-0000-0000-0000-00000000000' || boutique)::uuid, 'recuperee', 'Client', telephone, 3500, 'qr', cree_le, terminee_le from t_avis;
insert into avis (id, commande_id, boutique_id, client_id, note, cree_le)
  select ('f3260000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, ('e3260000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
         ('d3260000-0000-0000-0000-00000000000' || boutique)::uuid, ('c3260000-0000-0000-0000-0000000000' || lpad(client::text, 2, '0'))::uuid, note, avis_le from t_avis;
set local session_replication_role = origin;
create temp table t_avant as select id, statut, reponse_masquee from avis;
grant select on t_avis, t_avant to authenticated;

set local role authenticated;
select pg_temp.compte('b3260000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select * from signaux_fraude_avis()$$, '42501', 'Accès réservé', 'commerçant : pas de signaux');
select pg_temp.compte('c3260000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select * from signaux_fraude_avis()$$, '42501', 'Accès réservé', 'client : pas de signaux');
select pg_temp.compte('a3260000-0000-0000-0000-000000000001');
create temp table t_signaux as select * from signaux_fraude_avis();
select pg_temp.ok((select array_agg(signal || ':' || boutique || ':' || nombre order by signal, boutique) from t_signaux)
  = array['avis_groupes:Atelier A:3', 'comptes_recents:Comptoir C:3', 'meme_numero:Boutique B:3', 'retraits_rapides:Boutique B:3'],
  'les 4 signaux, seuil 3, rien sous le seuil ni hors fenêtre');
select pg_temp.ok((select detail from t_signaux where signal = 'avis_groupes') = to_char(date_trunc('minute', (now() - interval '2 days') at time zone 'Africa/Algiers'), 'DD/MM HH24:MI'),
  'avis groupés : minute à l''heure d''Alger');
select pg_temp.ok((select detail from t_signaux where signal = 'meme_numero') = '+213 … 56', 'même numéro : numéro abrégé');
select pg_temp.ok((select boutique_id from t_signaux where signal = 'meme_numero') = 'd3260000-0000-0000-0000-00000000000b', 'même numéro : la boutique notée');
select pg_temp.ok(not exists (select 1 from t_signaux where boutique = 'Dar D'), 'Dar D : 2 avis groupés, numéro sur 2 boutiques, 2 retraits rapides, avis anciens : aucun signal');
reset role;

-- Jamais d'action automatique : aucun avis touché, aucune décision, aucun signalement.
select pg_temp.ok(not exists (select 1 from avis a join t_avant t using (id) where a.statut <> t.statut or a.reponse_masquee <> t.reponse_masquee), 'aucun avis masqué');
select pg_temp.ok((select count(*) from decisions where signalement_avis_id is not null) = 0 and (select count(*) from signalements_avis) = 0, 'aucune décision, aucun signalement');
select pg_temp.ok(not has_function_privilege('anon', 'public.signaux_fraude_avis()', 'execute')
  and (select provolatile = 's' from pg_proc where proname = 'signaux_fraude_avis'), 'droits : pas les visiteurs ; fonction de lecture (stable)');
select pg_temp.ok(exists (select 1 from pg_proc where proname = 'signaux_avis'), 'signaux_avis (US-32.4) toujours là');

rollback;

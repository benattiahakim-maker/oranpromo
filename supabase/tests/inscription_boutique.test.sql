-- Tests SQL de la migration 20261017110000_inscription_boutique.sql (US-31.3 : inscription en boutique).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/inscription_boutique.test.sql
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

-- Données : 3 boutiques (validée, autre validée, suspendue), 1 commerçant, 4 clients (nouveau, ancien, avec commande, bloqué), 1 admin.
select pg_temp.compte(null);
insert into auth.users (id, email) values
  ('c3130000-0000-0000-0000-000000000001', 'nouveau313@test.dz'), ('c3130000-0000-0000-0000-000000000002', 'ancien313@test.dz'),
  ('c3130000-0000-0000-0000-000000000003', 'commande313@test.dz'), ('c3130000-0000-0000-0000-000000000004', 'bloque313@test.dz'),
  ('b3130000-0000-0000-0000-000000000001', 'boutique313@test.dz'), ('a3130000-0000-0000-0000-000000000001', 'admin313@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3130000-0000-0000-0000-000000000001', 'Boutique Affiche', 'boutique-affiche-313', 'Gambetta', '+213555313001', 'validee', 'oran'),
  ('d3130000-0000-0000-0000-000000000002', 'Boutique Deux', 'boutique-deux-313', 'Centre', '+213555313002', 'validee', 'oran'),
  ('d3130000-0000-0000-0000-000000000003', 'Boutique Fermee', 'boutique-fermee-313', 'Centre', '+213555313003', 'suspendue', 'oran');
update profils set role = 'commercant', boutique_id = 'd3130000-0000-0000-0000-000000000001' where id = 'b3130000-0000-0000-0000-000000000001';
update profils set role = 'admin' where id = 'a3130000-0000-0000-0000-000000000001';
update profils set cree_le = now() - interval '25 hours' where id = 'c3130000-0000-0000-0000-000000000002';
update profils set bloque = true, bloque_le = now(), bloque_par_admin = true where id = 'c3130000-0000-0000-0000-000000000004';
insert into commandes (client_id, boutique_id, client_nom, client_telephone, total)
  values ('c3130000-0000-0000-0000-000000000003', 'd3130000-0000-0000-0000-000000000002', 'Lina', '+213661313003', 1000);

-- 1. Compte nouveau (moins de 24 h, aucune commande) : suit la boutique et est rattaché, une seule fois.
set local role authenticated;
select pg_temp.compte('c3130000-0000-0000-0000-000000000001');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": true, "suivie_nouvelle": true}'::jsonb, 'nouveau compte : suit et est rattaché');
select pg_temp.ok((select source from abonnements_boutique where profil_id = 'c3130000-0000-0000-0000-000000000001') = 'inscription_boutique',
  'abonnement de source « inscription_boutique »');
select pg_temp.ok((select boutique_id from inscriptions_boutique) = 'd3130000-0000-0000-0000-000000000001', 'le client lit son rattachement');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": false, "suivie_nouvelle": false}'::jsonb, 'deuxième passage : rien de nouveau');
select pg_temp.ok(rattacher_inscription('boutique-deux-313') @> '{"rattache": false, "suivie_nouvelle": true}'::jsonb,
  'autre affiche : suit la 2e boutique, mais le rattachement reste à la première');
select pg_temp.ok((select count(*) from inscriptions_boutique) = 1
  and (select boutique_id from inscriptions_boutique) = 'd3130000-0000-0000-0000-000000000001', 'un seul rattachement, définitif');
select pg_temp.erreur($$select rattacher_inscription('boutique-fermee-313')$$, 'P0002', 'Boutique introuvable', 'boutique suspendue refusée');
select pg_temp.erreur($$select rattacher_inscription('inconnue-313')$$, 'P0002', 'Boutique introuvable', 'slug inconnu refusé');
select pg_temp.erreur($$insert into inscriptions_boutique (profil_id, boutique_id) values ('c3130000-0000-0000-0000-000000000001', 'd3130000-0000-0000-0000-000000000002')$$,
  '42501', 'permission denied', 'pas d''écriture directe');
select pg_temp.erreur($$update inscriptions_boutique set boutique_id = 'd3130000-0000-0000-0000-000000000002'$$, '42501', 'permission denied', 'rattachement non modifiable en direct');
select pg_temp.erreur($$delete from inscriptions_boutique$$, '42501', 'permission denied', 'rattachement non supprimable en direct');

-- 2. Compte de plus de 24 h : suit, pas de rattachement.
select pg_temp.compte('c3130000-0000-0000-0000-000000000002');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": false, "suivie_nouvelle": true}'::jsonb, 'ancien compte : suit sans rattachement');
select pg_temp.ok((select count(*) from inscriptions_boutique) = 0, 'ancien compte : ne voit pas le rattachement des autres');

-- 3. Compte avec une commande : suit, pas de rattachement.
select pg_temp.compte('c3130000-0000-0000-0000-000000000003');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": false, "suivie_nouvelle": true}'::jsonb, 'compte avec commande : suit sans rattachement');

-- 4. Compte bloqué (nouveau) : suit et est rattaché, il ne peut toujours pas commander (blocage inchangé).
select pg_temp.compte('c3130000-0000-0000-0000-000000000004');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": true, "suivie_nouvelle": true}'::jsonb, 'compte bloqué : suit et est rattaché');
select pg_temp.ok((select bloque from profils where id = 'c3130000-0000-0000-0000-000000000004'), 'compte bloqué : toujours bloqué');

-- 5. Commerçant et admin : refusés (seuls les clients suivent), rien n'est rattaché.
select pg_temp.compte('b3130000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select rattacher_inscription('boutique-deux-313')$$, '42501', 'Seuls les clients', 'commerçant refusé');
select pg_temp.ok((select count(*) from inscriptions_boutique) = 0, 'commerçant : ne lit aucun rattachement, même pour sa boutique');
select pg_temp.compte('a3130000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select rattacher_inscription('boutique-deux-313')$$, '42501', 'Seuls les clients', 'admin refusé');
select pg_temp.ok((select count(*) from inscriptions_boutique) = 2, 'admin : lit tous les rattachements');

-- 6. Sans session, et visiteur anonyme.
select pg_temp.compte(null);
select pg_temp.erreur($$select rattacher_inscription('boutique-affiche-313')$$, '42501', 'Connectez-vous', 'sans session : refusé');
reset role;
set local role anon;
select pg_temp.erreur($$select rattacher_inscription('boutique-affiche-313')$$, '42501', 'permission denied', 'anon : pas d''accès à la fonction');
select pg_temp.erreur($$select * from inscriptions_boutique$$, '42501', 'permission denied', 'anon : pas d''accès à la table');

-- 7. Plafond de 200 abonnements : pas de nouvel abonnement, rattachement quand même (compte nouveau).
reset role;
select pg_temp.compte(null);
insert into auth.users (id, email) values ('c3130000-0000-0000-0000-000000000005', 'plafond313@test.dz');
insert into boutiques (nom, slug, quartier, whatsapp, statut, ville)
  select 'Plafond ' || i, 'plafond-313-' || i, 'Centre', '+2135553' || lpad(i::text, 5, '0'), 'validee', 'oran' from generate_series(1, 200) i;
insert into abonnements_boutique (profil_id, boutique_id) select 'c3130000-0000-0000-0000-000000000005', id from boutiques where slug like 'plafond-313-%';
set local role authenticated;
select pg_temp.compte('c3130000-0000-0000-0000-000000000005');
select pg_temp.ok(rattacher_inscription('boutique-affiche-313') @> '{"rattache": true, "suivie_nouvelle": false}'::jsonb, 'plafond atteint : rattaché, pas de 201e abonnement');
reset role;

-- 8. La boutique ne lit que le nombre (abonnes_boutique), jamais les lignes.
set local role authenticated;
select pg_temp.compte('b3130000-0000-0000-0000-000000000001');
select pg_temp.ok((abonnes_boutique() ->> 'total')::int = 4, 'la boutique compte ses abonnés (4, sans le compte au plafond), sans les voir');
reset role;

-- 9. Droits de la fonction et de la table.
select pg_temp.ok(not has_function_privilege('anon', 'public.rattacher_inscription(text)', 'execute'), 'fonction fermée à anon');
select pg_temp.ok(has_function_privilege('authenticated', 'public.rattacher_inscription(text)', 'execute'), 'fonction ouverte aux comptes connectés');
select pg_temp.ok((select prosecdef and proconfig is not null from pg_proc where oid = 'public.rattacher_inscription(text)'::regprocedure), 'security definer, search_path fixé');

rollback;

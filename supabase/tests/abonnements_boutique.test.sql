-- Tests SQL de la migration 20261016090000_abonnements_boutique.sql (US-31.1 : suivre une boutique).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/abonnements_boutique.test.sql
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

-- Données : 3 boutiques (validée, en attente, suspendue), 1 commerçant, 3 clients (dont un bloqué), 1 admin.
insert into auth.users (id, email) values
  ('c3100000-0000-0000-0000-000000000001', 'client311a@test.dz'), ('c3100000-0000-0000-0000-000000000002', 'client311b@test.dz'),
  ('c3100000-0000-0000-0000-000000000003', 'client311bloque@test.dz'), ('b3100000-0000-0000-0000-000000000001', 'boutique311@test.dz'),
  ('b3100000-0000-0000-0000-000000000002', 'boutique311b@test.dz'), ('a3100000-0000-0000-0000-000000000001', 'admin311@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3100000-0000-0000-0000-000000000001', 'Boutique Suivie', 'boutique-suivie', 'Gambetta', '+213555310001', 'validee', 'oran'),
  ('d3100000-0000-0000-0000-000000000002', 'Boutique Attente', 'boutique-attente-311', 'Centre', '+213555310002', 'en_attente', 'oran'),
  ('d3100000-0000-0000-0000-000000000003', 'Boutique Suspendue', 'boutique-suspendue-311', 'Centre', '+213555310003', 'suspendue', 'oran'),
  ('d3100000-0000-0000-0000-000000000004', 'Boutique Autre', 'boutique-autre-311', 'Centre', '+213555310004', 'validee', 'oran');
update profils set role = 'commercant', boutique_id = 'd3100000-0000-0000-0000-000000000001' where id = 'b3100000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd3100000-0000-0000-0000-000000000004' where id = 'b3100000-0000-0000-0000-000000000002';
update profils set role = 'admin' where id = 'a3100000-0000-0000-0000-000000000001';
update profils set bloque = true, bloque_le = now(), bloque_par_admin = true where id = 'c3100000-0000-0000-0000-000000000003';

-- 1. Client A suit, deux fois = une seule ligne ; puis ne suit plus.
set local role authenticated;
select pg_temp.compte('c3100000-0000-0000-0000-000000000001');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001') = true, 'client : suivre une boutique validée (nouveau)');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001') = false, 'client : suivre deux fois ne crée rien (idempotent)');
select pg_temp.ok((select count(*) from abonnements_boutique) = 1
  and (select source from abonnements_boutique) = 'vitrine', 'client : une seule ligne, source « vitrine », lue par son auteur');
select pg_temp.erreur($$select suivre_boutique('d3100000-0000-0000-0000-000000000002')$$, 'P0002', 'Boutique introuvable', 'boutique en attente refusée');
select pg_temp.erreur($$select suivre_boutique('d3100000-0000-0000-0000-000000000003')$$, 'P0002', 'Boutique introuvable', 'boutique suspendue refusée');
select pg_temp.erreur($$select suivre_boutique('d3100000-0000-0000-0000-0000000000ff')$$, 'P0002', 'Boutique introuvable', 'boutique inconnue refusée');
select pg_temp.erreur($$insert into abonnements_boutique (profil_id, boutique_id) values ('c3100000-0000-0000-0000-000000000001', 'd3100000-0000-0000-0000-000000000004')$$,
  '42501', 'permission denied', 'client : pas d''écriture directe dans la table');
select pg_temp.erreur($$update abonnements_boutique set source = 'inscription_boutique'$$, '42501', 'permission denied', 'client : source non modifiable en direct');
select pg_temp.erreur($$select abonnes_boutique()$$, '42501', 'Réservé aux commerçants', 'client : pas de compteur');

-- 2. Client B ne lit pas les abonnements de A ; il suit aussi.
select pg_temp.compte('c3100000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from abonnements_boutique) = 0, 'client B ne lit pas les abonnements de A');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001'), 'client B suit la même boutique');
select pg_temp.ok(ne_plus_suivre('d3100000-0000-0000-0000-000000000001') and not ne_plus_suivre('d3100000-0000-0000-0000-000000000001'),
  'ne plus suivre : vrai puis faux (déjà retiré)');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001'), 'client B suit de nouveau');

-- 3. Client bloqué : peut suivre (le blocage ne change pas).
select pg_temp.compte('c3100000-0000-0000-0000-000000000003');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001'), 'client bloqué : peut suivre');

-- 4. La boutique : un nombre seulement, jamais la table.
select pg_temp.compte('b3100000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from abonnements_boutique) = 0, 'boutique : ne lit aucune ligne (ne sait pas qui la suit)');
select pg_temp.ok(abonnes_boutique() = '{"total": 3, "sept_jours": 3}'::jsonb, 'boutique : 3 abonnés, 3 cette semaine');
select pg_temp.erreur($$select suivre_boutique('d3100000-0000-0000-0000-000000000004')$$, '42501', 'Seuls les clients', 'commerçant : ne suit pas');
select pg_temp.compte('b3100000-0000-0000-0000-000000000002');
select pg_temp.ok(abonnes_boutique() = '{"total": 0, "sept_jours": 0}'::jsonb, 'autre boutique : 0 (compte seulement les siens)');

-- 5. Admin : lit tout.
select pg_temp.compte('a3100000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from abonnements_boutique) = 3, 'admin : lit les 3 abonnements');
reset role;

-- 6. Visiteur sans compte : rien.
set local role anon;
select pg_temp.compte(null);
select pg_temp.erreur($$select suivre_boutique('d3100000-0000-0000-0000-000000000001')$$, '42501', 'permission denied', 'visiteur : suivre interdit');
select pg_temp.erreur($$select count(*) from abonnements_boutique$$, '42501', 'permission denied', 'visiteur : table illisible');
select pg_temp.erreur($$select abonnes_boutique()$$, '42501', 'permission denied', 'visiteur : compteur interdit');
reset role;

-- 7. Abonnés de plus de 7 jours : comptés dans le total, pas dans la semaine.
select pg_temp.compte(null);
update abonnements_boutique set cree_le = now() - interval '8 days' where profil_id = 'c3100000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.compte('b3100000-0000-0000-0000-000000000001');
select pg_temp.ok(abonnes_boutique() = '{"total": 3, "sept_jours": 2}'::jsonb, 'boutique : 3 au total, 2 cette semaine');
reset role;

-- 8. Plafond de 200 boutiques par compte.
select pg_temp.compte(null);
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville)
select ('d3110000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'Boutique ' || i, 'boutique-plafond-' || i, 'Centre', '+2135553' || lpad(i::text, 5, '0'), 'validee', 'oran'
from generate_series(1, 200) i;
insert into abonnements_boutique (profil_id, boutique_id)
select 'c3100000-0000-0000-0000-000000000002', ('d3110000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 199) i;
set local role authenticated;
select pg_temp.compte('c3100000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from abonnements_boutique) = 200, 'client B : 200 boutiques suivies');
select pg_temp.erreur($$select suivre_boutique('d3110000-0000-0000-0000-000000000200')$$, '54000', '200 boutiques', 'plafond de 200 boutiques');
select pg_temp.ok(suivre_boutique('d3100000-0000-0000-0000-000000000001') = false, 'au plafond : une boutique déjà suivie reste « déjà suivie »');
reset role;

-- 9. Une boutique suspendue après coup : l'abonnement reste ; ne plus suivre marche encore.
select pg_temp.compte(null);
update boutiques set statut = 'suspendue' where id = 'd3100000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.compte('c3100000-0000-0000-0000-000000000003');
select pg_temp.ok((select count(*) from abonnements_boutique) = 1, 'boutique suspendue : l''abonnement reste');
select pg_temp.ok(ne_plus_suivre('d3100000-0000-0000-0000-000000000001'), 'boutique suspendue : ne plus suivre marche');
reset role;

-- 10. search_path fixé, fonctions privées fermées.
select pg_temp.ok(not has_function_privilege('authenticated', 'prive.ajouter_abonnement(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'prive.ajouter_abonnement(uuid, uuid, text)', 'execute'), 'ajouter_abonnement : réservé à la base');

rollback;

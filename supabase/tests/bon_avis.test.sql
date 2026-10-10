-- Tests SQL de la migration 20261019130000_bon_avis.sql (US-32.5 : petit bon pour chaque avis).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bon_avis.test.sql
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
-- Comptes : numéro vérifié (phone_confirmed_at) sauf c2 ; c3 rattaché à la boutique A aujourd'hui, c4 il y a 10 jours.
create function pg_temp.client(i integer, verifie boolean default true) returns uuid language plpgsql as $$
declare cid uuid := ('c3250000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;
begin
  insert into auth.users (id, phone, phone_confirmed_at) values (cid, '2135553250' || lpad(i::text, 2, '0'), case when verifie then now() end);
  update profils set nom = 'Client ' || chr(64 + i) where profils.id = cid;
  return cid;
end $$;
create function pg_temp.c(i integer) returns uuid language sql as $$ select ('c3250000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid $$;
create function pg_temp.o(i integer) returns uuid language sql as $$ select ('e3250000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid $$;
create function pg_temp.bons_avis(cid uuid) returns bigint language sql as $$ select count(*) from bons where profil_id = cid and origine = 'avis' $$;
grant execute on function pg_temp.c(integer), pg_temp.o(integer) to anon, authenticated;

insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3250000-0000-0000-0000-00000000000a', 'Boutique Avis A', 'boutique-avis-a-325', 'Gambetta', '+213555325901', 'validee', 'oran'),
  ('d3250000-0000-0000-0000-00000000000b', 'Boutique Avis B', 'boutique-avis-b-325', 'Centre', '+213555325902', 'validee', 'oran');
do $$ begin perform pg_temp.client(1); perform pg_temp.client(2, false); perform pg_temp.client(3); perform pg_temp.client(4); perform pg_temp.client(5); end $$;
insert into inscriptions_boutique (profil_id, boutique_id, cree_le) values
  (pg_temp.c(3), 'd3250000-0000-0000-0000-00000000000a', now()),
  (pg_temp.c(4), 'd3250000-0000-0000-0000-00000000000a', now() - interval '10 days');

-- Commandes récupérées par QR code (déclencheurs coupés : seul l'état final compte).
set local session_replication_role = replica;
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, cree_le, terminee_le)
select pg_temp.o(n), pg_temp.c(n / 10), case when n in (31, 41) then 'd3250000-0000-0000-0000-00000000000a'::uuid else 'd3250000-0000-0000-0000-00000000000b'::uuid end,
  'recuperee', 'Client', '+2135553250' || lpad((n / 10)::text, 2, '0'), 3500, 'qr',
  case when n = 31 then now() - interval '1 minute' else now() - interval '1 day' end, now() - interval '1 minute'
from unnest(array[11, 12, 13, 14, 15, 21, 31, 41, 51]) n;
set local session_replication_role = origin;

-- 1. État de la migration : pas de programme « avis » tant que le propriétaire n'a pas fixé le budget.
select pg_temp.ok(not exists (select 1 from programmes_bons where type = 'avis'), 'pas de programme « avis » créé par la migration');
set local role anon;
select pg_temp.ok(recompense_avis() is null, 'sans programme : pas de mention publique');
reset role;
set local role authenticated;
select pg_temp.compte(pg_temp.c(1));
select pg_temp.ok((select (r->>'avis') is not null and r->'bon' = 'null'::jsonb from (select donner_avis(pg_temp.o(11), 5) r) x), 'sans programme : avis publié, pas de bon');
reset role;
select pg_temp.ok(pg_temp.bons_avis(pg_temp.c(1)) = 0, 'sans programme : aucun bon « avis »');
select pg_temp.erreur($$select prive.regler_bon_avis(-1)$$, '22023', 'Budget du mois', 'réglage : budget négatif refusé');
select pg_temp.ok((select (prive.regler_bon_avis(0)).actif) = false, 'réglage à 0 : programme créé mais arrêté');
select pg_temp.ok((select count(*) = 1 and bool_and(montant = 150 and minimum_achat = 1500 and validite_jours = 30 and not actif and budget = 0
  and nom_fr = 'Avis' and nom_ar = 'راي') from programmes_bons where type = 'avis'), 'programme « avis » : 150 DA dès 1 500 DA, 30 jours (décision du 10/10)');
select pg_temp.erreur($$insert into programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat) values ('avis', 'Avis 2', 'راي', 100, 1000)$$,
  '23505', 'programmes_bons_un_avis', 'un seul programme « avis »');
set local role anon;
select pg_temp.ok(recompense_avis() is null, 'programme arrêté (budget 0) : pas de mention publique');
reset role;

-- 2. Programme actif, budget du mois 450 DA (3 bons).
select pg_temp.ok((select (prive.regler_bon_avis(450)).actif) and (select count(*) from programmes_bons where type = 'avis') = 1, 'réglage à 450 : même programme, actif');
set local role anon;
select pg_temp.ok(recompense_avis() = '{"montant": 150, "minimum": 1500}'::jsonb, 'programme actif : mention publique (150 DA dès 1 500 DA)');
reset role;
set local role authenticated;
select pg_temp.compte(pg_temp.c(1));
select pg_temp.ok((select (donner_avis(pg_temp.o(12), 1)->>'bon')::integer = 150), 'avis 1 étoile : bon de 150 DA (quelle que soit la note)');
select pg_temp.ok((select (donner_avis(pg_temp.o(13), 5, '{accueil}', 'Très bien')->>'bon')::integer = 150), '2e avis du mois : 2e bon');
select pg_temp.ok((select donner_avis(pg_temp.o(14), 4)->'bon' = 'null'::jsonb), '3e avis du mois, même numéro : avis publié, pas de bon (2 par mois)');
select pg_temp.compte(pg_temp.c(2));
select pg_temp.ok((select donner_avis(pg_temp.o(21), 5)->'bon' = 'null'::jsonb), 'numéro non vérifié : pas de bon');
select pg_temp.compte(pg_temp.c(3));
select pg_temp.ok((select donner_avis(pg_temp.o(31), 5)->'bon' = 'null'::jsonb), 'rattaché à la boutique le jour même (US-31) : pas de bon');
select pg_temp.compte(pg_temp.c(4));
select pg_temp.ok((select (donner_avis(pg_temp.o(41), 3)->>'bon')::integer = 150), 'rattaché à la boutique il y a 10 jours : bon');
reset role;
select pg_temp.ok((select count(*) from avis where commande_id in (pg_temp.o(11), pg_temp.o(12), pg_temp.o(13), pg_temp.o(14), pg_temp.o(21), pg_temp.o(31), pg_temp.o(41)) and statut = 'publie') = 7,
  'tous les avis sont publiés, avec ou sans bon');
select pg_temp.ok((select count(*) = 2 and bool_and(b.montant = 150 and b.minimum_achat = 1500 and b.statut = 'disponible' and b.univers is null and b.villes = '{}'
    and p.type = 'avis' and b.expire_le between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour')
  from bons b join programmes_bons p on p.id = b.programme_id where b.profil_id = pg_temp.c(1) and b.origine = 'avis'),
  'bons « avis » : 150 DA, dès 1 500 DA, disponibles, 30 jours, programme « avis »');
select pg_temp.ok(pg_temp.bons_avis(pg_temp.c(2)) = 0 and pg_temp.bons_avis(pg_temp.c(3)) = 0 and pg_temp.bons_avis(pg_temp.c(4)) = 1, 'un bon seulement pour les avis qui y ont droit');
select pg_temp.ok((select count(*) from prive.bons_avis) = 3 and not exists (select 1 from prive.numeros_programmes n join programmes_bons p on p.id = n.programme_id where p.type = 'avis'),
  'trace à part (un bon par avis), pas numeros_programmes (une fois par programme)');

-- 3. Budget du mois épuisé (450 DA donnés) : pas de bon, plus de mention publique.
set local role anon;
select pg_temp.ok(recompense_avis() is null, 'budget du mois épuisé : plus de mention publique');
reset role;
set local role authenticated;
select pg_temp.compte(pg_temp.c(5));
select pg_temp.ok((select donner_avis(pg_temp.o(51), 5)->'bon' = 'null'::jsonb), 'budget du mois épuisé : avis publié, pas de bon');
reset role;
-- Budget filtré par origine : un bon de bienvenue du mois ne compte pas ; un bon « avis » annulé rend son montant.
insert into bons (profil_id, montant, origine, programme_id, minimum_achat, statut, expire_le)
select pg_temp.c(5), 300, 'bienvenue', p.id, 2000, 'disponible', now() + interval '30 days' from programmes_bons p where p.type = 'bienvenue';
select pg_temp.ok(prive.budget_avis_restant(p) = 0, 'budget « avis » : un bon de bienvenue ne compte pas') from programmes_bons p where p.type = 'avis';
update bons set statut = 'annule' where id = (select bon_id from prive.bons_avis t join avis a on a.id = t.avis_id where a.commande_id = pg_temp.o(41));
select pg_temp.ok(prive.budget_avis_restant(p) = 150, 'budget « avis » : un bon annulé rend son montant') from programmes_bons p where p.type = 'avis';

-- 4. Mois suivant : budget et plafond repartent (bons et trace de c1 reculés d'un mois).
select pg_temp.ok((prive.regler_bon_avis(600)).budget = 600, 'réglage du budget du mois : 600');
set local session_replication_role = replica;
update bons set cree_le = cree_le - interval '1 month' where profil_id = pg_temp.c(1) and origine = 'avis';
update prive.bons_avis set le = le - interval '1 month' where bon_id in (select id from bons where profil_id = pg_temp.c(1));
set local session_replication_role = origin;
select pg_temp.ok(prive.budget_avis_restant(p) = 600, 'nouveau mois : budget entier (bons du mois passé non comptés)') from programmes_bons p where p.type = 'avis';
set local role authenticated;
select pg_temp.compte(pg_temp.c(1));
select pg_temp.ok((select (donner_avis(pg_temp.o(15), 5)->>'bon')::integer = 150), 'nouveau mois : le plafond de 2 repart');
reset role;

-- 5. Un avis = un bon au plus ; masquer l'avis ne reprend pas le bon.
select pg_temp.ok(prive.donner_bon_avis((select id from avis where commande_id = pg_temp.o(15))) is null, 'même avis : pas de 2e bon');
update avis set statut = 'masque' where commande_id = pg_temp.o(15);
select pg_temp.ok((select b.statut = 'disponible' from bons b join prive.bons_avis t on t.bon_id = b.id join avis a on a.id = t.avis_id where a.commande_id = pg_temp.o(15)),
  'avis masqué : le bon reste disponible');

-- 6. Programme arrêté ou fermé par ses dates : pas de bon. Erreur imprévue de l'attribution : l'avis est quand même publié.
alter table prive.bons_avis rename to bons_avis_cache;
set local session_replication_role = replica;
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, terminee_le)
values (pg_temp.o(16), pg_temp.c(1), 'd3250000-0000-0000-0000-00000000000b', 'recuperee', 'Client', '+213555325001', 3500, 'qr', now());
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.compte(pg_temp.c(1));
select pg_temp.ok((select (r->>'avis') is not null and r->'bon' = 'null'::jsonb from (select donner_avis(pg_temp.o(16), 4) r) x),
  'erreur imprévue du bon : avis publié quand même, sans bon');
reset role;
alter table prive.bons_avis_cache rename to bons_avis;
update programmes_bons set actif = false where type = 'avis';
select pg_temp.ok(prive.donner_bon_avis((select id from avis where commande_id = pg_temp.o(16))) is null, 'programme arrêté : pas de bon');
update programmes_bons set actif = true, fin = now() - interval '1 second', debut = now() - interval '1 day' where type = 'avis';
select pg_temp.ok(prive.donner_bon_avis((select id from avis where commande_id = pg_temp.o(16))) is null, 'programme fini (dates) : pas de bon');

-- 7. Règles de l'avis inchangées (exemple : code à 6 chiffres), droits.
set local session_replication_role = replica;
update commandes set mode_remise = 'code' where id = pg_temp.o(51);
delete from avis where commande_id = pg_temp.o(51);
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.compte(pg_temp.c(5));
select pg_temp.erreur($$select donner_avis(pg_temp.o(51), 5)$$, '22023', 'récupérée avec votre QR code', 'règle de l''avis inchangée : QR code seulement');
reset role;
select pg_temp.ok(has_function_privilege('anon', 'public.recompense_avis()', 'execute')
  and not has_function_privilege('authenticated', 'prive.donner_bon_avis(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'prive.regler_bon_avis(integer)', 'execute')
  and not has_function_privilege('anon', 'prive.donner_bon_avis(uuid)', 'execute')
  and not has_table_privilege('authenticated', 'prive.bons_avis', 'select')
  and not has_function_privilege('anon', 'public.donner_avis(uuid, integer, text[], text)', 'execute'),
  'droits : mention publique ; attribution et trace privées ; donner_avis réservé aux comptes');

rollback;

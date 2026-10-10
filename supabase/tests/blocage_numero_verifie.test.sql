-- Tests SQL de la migration 20261010100000_blocage_numero_verifie.sql (US-21.3 : blocage par numéro vérifié).
-- Même mode d'emploi que corrections_relecture.test.sql :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/blocage_numero_verifie.test.sql
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

delete from prive.reglages where cle = 'connexion_client';
select pg_temp.ok(prive.blocage_par_numero(), 'réglage : blocage par numéro activé par la migration');
select pg_temp.ok(to_regprocedure('public.numeros_partages()') is null, 'admin : numeros_partages() supprimée');

-- Comptes : admin, boutique ; A (numéro vérifié X), C et D (e-mail, numéros saisis à la main).
insert into auth.users (id, email) values
  ('a3000000-0000-0000-0000-000000000001', 'admin3@test.dz'),
  ('b3000000-0000-0000-0000-000000000001', 'boutique3@test.dz'),
  ('c3000000-0000-0000-0000-00000000000c', 'ancien-c@test.dz'),
  ('c3000000-0000-0000-0000-00000000000d', 'ancien-d@test.dz');
insert into auth.users (id, phone, phone_confirmed_at) values ('c3000000-0000-0000-0000-00000000000a', '213555400001', now());
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3000000-0000-0000-0000-000000000001', 'Boutique Blocage', 'boutique-blocage', 'Centre', '+213555930001', 'validee', 'oran');
update profils set role = 'admin' where id = 'a3000000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd3000000-0000-0000-0000-000000000001' where id = 'b3000000-0000-0000-0000-000000000001';
update profils set nom = 'Client A' where id = 'c3000000-0000-0000-0000-00000000000a';
update profils set nom = 'Client C', telephone = '+213555400001' where id = 'c3000000-0000-0000-0000-00000000000c';
update profils set nom = 'Client D', telephone = '+213555400004' where id = 'c3000000-0000-0000-0000-00000000000d';
insert into articles (id, boutique_id, titre, categorie, prix, genre) values
  ('e3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'Chemise blocage', 'Chemises', 3000, 'homme');
insert into tailles (article_id, libelle, disponible) values ('e3000000-0000-0000-0000-000000000001', 'L', true);
update tailles set quantite = 100 where article_id = 'e3000000-0000-0000-0000-000000000001';

create function pg_temp.no_show(client uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform pg_temp.compte(client);
  c := passer_commande('d3000000-0000-0000-0000-000000000001', '[{"article_id":"e3000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]');
  perform pg_temp.compte('b3000000-0000-0000-0000-000000000001');
  perform changer_statut_commande(c, 'confirmee');
  perform changer_statut_commande(c, 'prete');
  reset role;
  -- Commande vieillie de 2 h : la limite de 3 commandes par heure et par boutique (relecture n°4) ne gêne pas.
  update commandes set expire_le = now() - interval '1 minute', cree_le = now() - interval '2 hours' where id = c;
  set local role authenticated;
  perform pg_temp.compte('b3000000-0000-0000-0000-000000000001');
  perform declarer_no_show(c);
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- Unicité du numéro vérifié
-- ---------------------------------------------------------------------------
select pg_temp.ok((select count(*) = 2 and count(telephone_verifie_le) = 1 from profils where telephone = '+213555400001'),
  'unicité : un numéro saisi à la main peut doubler un numéro vérifié (ancien compte C)');
select pg_temp.erreur($$update profils set telephone_verifie_le = now() where id = 'c3000000-0000-0000-0000-00000000000c'$$,
  '23505', 'profils_telephone_verifie_unique', 'unicité : deux comptes ne peuvent pas avoir le même numéro vérifié (index unique)');

-- ---------------------------------------------------------------------------
-- 5 no-shows avec le numéro vérifié X : A bloqué ; un nouveau compte qui vérifie X reprend les no-shows.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000a') as n1 \gset
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000a') as n2 \gset
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000a') as n3 \gset
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000a') as n4 \gset
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000a') as n5 \gset
reset role;
select pg_temp.ok((select bool_and(telephone_verifie and client_telephone = '+213555400001') from commandes where client_id = 'c3000000-0000-0000-0000-00000000000a'),
  'commandes : passées avec le numéro vérifié X');
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c3000000-0000-0000-0000-00000000000a'), 'A : bloqué au 5e no-show');
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = 'c3000000-0000-0000-0000-00000000000c'),
  'C (même numéro saisi à la main, non vérifié) : ni compté ni bloqué');
set local role authenticated;
select pg_temp.compte('c3000000-0000-0000-0000-00000000000c') \g /dev/null
select pg_temp.ok(passer_commande('d3000000-0000-0000-0000-000000000001', '[{"article_id":"e3000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]') is not null,
  'C : commande encore (un compte bloqué sur le même numéro, non vérifié chez C, ne le bloque pas)');
reset role;
-- A change de numéro par code (Y) : X se libère ; A reste bloqué (ses propres no-shows).
update auth.users set phone = '213555400002', phone_confirmed_at = now() where id = 'c3000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select telephone = '+213555400002' and no_shows = 5 and bloque from profils where id = 'c3000000-0000-0000-0000-00000000000a'),
  'A : nouveau numéro vérifié, toujours bloqué');
-- B crée un compte avec X et le vérifie : il reprend les 5 no-shows du numéro.
insert into auth.users (id, phone, phone_confirmed_at) values ('c3000000-0000-0000-0000-00000000000b', '213555400001', now());
update profils set nom = 'Client B' where id = 'c3000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select telephone = '+213555400001' and telephone_verifie_le is not null and no_shows = 5 and bloque
  from profils where id = 'c3000000-0000-0000-0000-00000000000b'), 'B : le numéro vérifié X reprend ses 5 no-shows → bloqué');
set local role authenticated;
select pg_temp.compte('c3000000-0000-0000-0000-00000000000b') \g /dev/null
select pg_temp.erreur($$select passer_commande('d3000000-0000-0000-0000-000000000001', '[{"article_id":"e3000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]')$$,
  '42501', 'bloqué', 'B : ne commande pas (un client bloqué ne recommence pas avec un autre compte sur le même numéro)');
select pg_temp.ok((select no_shows from profils where id = auth.uid()) = 5, 'B : /compte affiche les 5 no-shows du numéro');
reset role;
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = 'c3000000-0000-0000-0000-00000000000c'),
  'C : toujours ni compté ni bloqué');

-- ---------------------------------------------------------------------------
-- Les no-shows de commandes au numéro non vérifié ne suivent pas le numéro.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000d') \g /dev/null
select pg_temp.no_show('c3000000-0000-0000-0000-00000000000d') \g /dev/null
reset role;
insert into auth.users (id, phone, phone_confirmed_at) values ('c3000000-0000-0000-0000-00000000000e', '213555400004', now());
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = 'c3000000-0000-0000-0000-00000000000e')
  and (select no_shows from profils where id = 'c3000000-0000-0000-0000-00000000000d') = 2,
  'E vérifie le numéro de D : les no-shows de D (numéro saisi à la main) ne le suivent pas');

-- ---------------------------------------------------------------------------
-- Contestation en attente : le no-show du numéro ne compte plus dans le compteur, mais un compte déjà bloqué
-- le reste (relecture n°4 : 5 no-shows en comptant la contestation en attente).
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('c3000000-0000-0000-0000-00000000000a') \g /dev/null
select contester_no_show(:'n5', 'La boutique était fermée ce jour-là.') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 4 and bloque from profils where id = 'c3000000-0000-0000-0000-00000000000b'),
  'contestation par A en attente : B (numéro X) affiche 4 mais reste bloqué');
set local role authenticated;
select pg_temp.compte('a3000000-0000-0000-0000-000000000001') \g /dev/null
select valider_no_show(:'n5') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 5 and bloque from profils where id = 'c3000000-0000-0000-0000-00000000000b'),
  'contestation validée par l''admin : B de nouveau à 5, bloqué');

-- ---------------------------------------------------------------------------
-- Admin : déblocage (annule aussi les no-shows du numéro vérifié), blocage manuel inchangé.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.compte('a3000000-0000-0000-0000-000000000001') \g /dev/null
select debloquer_client('c3000000-0000-0000-0000-00000000000b') \g /dev/null
reset role;
select pg_temp.ok((select no_shows = 0 and not bloque from profils where id = 'c3000000-0000-0000-0000-00000000000b'),
  'admin : débloquer B remet son compteur à 0');
select pg_temp.ok((select count(*) = 5 from commandes where client_telephone = '+213555400001' and telephone_verifie and no_show_annule_le is not null),
  'admin : débloquer B annule les no-shows passés avec son numéro vérifié');
select pg_temp.ok((select count(*) from commandes where client_id = 'c3000000-0000-0000-0000-00000000000d' and no_show_annule_le is null and no_show_le is not null) = 2,
  'admin : débloquer B ne touche pas aux no-shows d''un numéro non vérifié');
set local role authenticated;
select pg_temp.compte('a3000000-0000-0000-0000-000000000001') \g /dev/null
select bloquer_client('c3000000-0000-0000-0000-00000000000e') \g /dev/null
reset role;
select pg_temp.ok((select bloque and no_shows = 0 from profils where id = 'c3000000-0000-0000-0000-00000000000e'), 'admin : blocage manuel');
set local role authenticated;
select pg_temp.compte('c3000000-0000-0000-0000-00000000000e') \g /dev/null
update profils set nom = 'Client E' where id = auth.uid();
select pg_temp.erreur($$select passer_commande('d3000000-0000-0000-0000-000000000001', '[{"article_id":"e3000000-0000-0000-0000-000000000001","taille":"L","quantite":1}]')$$,
  '42501', 'contactez OranPromo', 'admin : le compte bloqué à la main ne commande pas');
select pg_temp.compte('a3000000-0000-0000-0000-000000000001') \g /dev/null
select debloquer_client('c3000000-0000-0000-0000-00000000000e') \g /dev/null
reset role;
select pg_temp.ok((select not bloque from profils where id = 'c3000000-0000-0000-0000-00000000000e'), 'admin : déblocage manuel');

-- ---------------------------------------------------------------------------
-- Réglage coupé : retour au comptage par compte seulement.
-- ---------------------------------------------------------------------------
update prive.reglages set valeur = 'off' where cle = 'blocage_par_numero';
update commandes set no_show_annule_le = null where client_telephone = '+213555400001' and client_id = 'c3000000-0000-0000-0000-00000000000a';
select pg_temp.ok(prive.no_shows_actifs('c3000000-0000-0000-0000-00000000000b', '+213555400001') = 0
  and prive.no_shows_actifs('c3000000-0000-0000-0000-00000000000a', '+213555400002') = 5,
  'réglage « off » : seuls les no-shows du compte comptent');

rollback;

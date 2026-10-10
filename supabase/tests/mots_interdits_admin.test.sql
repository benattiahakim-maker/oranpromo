-- Tests SQL de la migration 20261019120000_mots_interdits_admin.sql (mots interdits tenus par l'admin).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/mots_interdits_admin.test.sql
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
  ('d3270000-0000-0000-0000-00000000000a', 'Atelier M', 'atelier-m-327', 'Gambetta', '+213555327001', 'validee', 'oran');
insert into auth.users (id, email) values ('a3270000-0000-0000-0000-000000000001', 'admin327@test.dz'),
  ('b3270000-0000-0000-0000-000000000001', 'boutique327@test.dz'), ('c3270000-0000-0000-0000-000000000001', 'client327@test.dz');
update profils set role = 'admin' where id = 'a3270000-0000-0000-0000-000000000001';
update profils set role = 'commercant', boutique_id = 'd3270000-0000-0000-0000-00000000000a' where id = 'b3270000-0000-0000-0000-000000000001';
create temp table t_avant as select mot from prive.mots_interdits;
grant select on t_avant to authenticated;

set local role authenticated;
-- Réservé à l'admin : ni client, ni commerçant.
select pg_temp.compte('c3270000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select * from mots_interdits()$$, '42501', 'Accès réservé', 'client : pas de liste');
select pg_temp.erreur($$select ajouter_mot_interdit('arnaqueur')$$, '42501', 'Accès réservé', 'client : pas d''ajout');
select pg_temp.compte('b3270000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select retirer_mot_interdit('zebi')$$, '42501', 'Accès réservé', 'commerçant : pas de retrait');

select pg_temp.compte('a3270000-0000-0000-0000-000000000001');
select pg_temp.ok((select array_agg(m) from mots_interdits() m) = (select array_agg(mot order by mot) from t_avant), 'admin : la liste complète, triée');
select pg_temp.ok(ajouter_mot_interdit('  Arnaqué ') = 'arnaque', 'ajout : forme normalisée (minuscules, sans accents, espaces retirés)');
select pg_temp.ok(ajouter_mot_interdit('ARNAQUE') = 'arnaque' and (select count(*) from mots_interdits() m where m = 'arnaque') = 1, 'ajout : déjà présent, pas de doublon ni d''erreur');
select pg_temp.ok(ajouter_mot_interdit('٩ahba٢') = '9ahba2', 'ajout : chiffres arabes ramenés à 0-9');
select pg_temp.ok(ajouter_mot_interdit('نصاب') = 'نصاب', 'ajout : mot en arabe');
select pg_temp.erreur($$select ajouter_mot_interdit('deux mots')$$, '22023', 'Un seul mot', 'refus : deux mots');
select pg_temp.erreur($$select ajouter_mot_interdit('arna.que')$$, '22023', 'ponctuation', 'refus : ponctuation (le filtre ne le reconnaîtrait jamais)');
select pg_temp.erreur($$select ajouter_mot_interdit('a')$$, '22023', 'entre 2 et 40', 'refus : trop court');
select pg_temp.erreur($$select ajouter_mot_interdit(repeat('a', 41))$$, '22023', 'entre 2 et 40', 'refus : trop long');
select pg_temp.erreur($$select ajouter_mot_interdit(null)$$, '22023', 'entre 2 et 40', 'refus : vide');
reset role;
-- Le filtre des avis utilise aussitôt la liste.
select pg_temp.ok(prive.contenu_interdit('Vendeur arnaqueur, ARNAQUÉ !'), 'filtre : le mot ajouté est refusé dans un avis');
set local role authenticated;
select pg_temp.compte('a3270000-0000-0000-0000-000000000001');
select retirer_mot_interdit('Arnaqué');
select pg_temp.erreur($$select retirer_mot_interdit('arnaque')$$, 'P0002', 'pas dans la liste', 'retrait : mot absent');
reset role;
select pg_temp.ok(not prive.contenu_interdit('Vendeur arnaqué !'), 'retrait : le mot n''est plus filtré');
select pg_temp.ok(prive.contenu_interdit('wesh 9ahba2') and prive.contenu_interdit('نصاب'), 'filtre : mots ajoutés (chiffres, arabe) reconnus');
select pg_temp.ok(not has_function_privilege('anon', 'public.mots_interdits()', 'execute')
  and not has_function_privilege('anon', 'public.ajouter_mot_interdit(text)', 'execute')
  and not has_function_privilege('anon', 'public.retirer_mot_interdit(text)', 'execute')
  and not has_table_privilege('authenticated', 'prive.mots_interdits', 'select'), 'droits : pas les visiteurs, table toujours privée');

rollback;

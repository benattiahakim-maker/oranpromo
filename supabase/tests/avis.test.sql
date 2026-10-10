-- Tests SQL de la migration 20261019090000_avis.sql (US-32.1 : avis clients sur les boutiques).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/avis.test.sql
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

-- Données : boutique A (validée, Oran), boutique B (validée, ville fermée Tlemcen), boutique C (en attente) ;
-- clients Amine Benali (A), Sara (B), Nadia (bloquée), un commerçant de A qui est aussi client ailleurs ; un admin.
insert into auth.users (id, email) values
  ('c3200000-0000-0000-0000-000000000001', 'amine32@test.dz'), ('c3200000-0000-0000-0000-000000000002', 'sara32@test.dz'),
  ('c3200000-0000-0000-0000-000000000003', 'nadia32@test.dz'), ('c3200000-0000-0000-0000-000000000004', 'yacine32@test.dz'),
  ('b3200000-0000-0000-0000-000000000001', 'boutique32@test.dz'), ('a3200000-0000-0000-0000-000000000001', 'admin32@test.dz');
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3200000-0000-0000-0000-000000000001', 'Boutique Avis', 'boutique-avis-32', 'Gambetta', '+213555320001', 'validee', 'oran'),
  ('d3200000-0000-0000-0000-000000000003', 'Boutique Attente', 'boutique-attente-32', 'Centre', '+213555320003', 'en_attente', 'oran');
alter table boutiques disable trigger user;
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3200000-0000-0000-0000-000000000002', 'Boutique Tlemcen', 'boutique-tlemcen-32', 'Centre', '+213555320002', 'validee', 'tlemcen');
alter table boutiques enable trigger user;
update profils set nom = 'Amine Benali' where id = 'c3200000-0000-0000-0000-000000000001';
update profils set nom = 'Sara' where id = 'c3200000-0000-0000-0000-000000000002';
update profils set nom = 'Nadia Mansouri', bloque = true, bloque_le = now(), bloque_par_admin = true where id = 'c3200000-0000-0000-0000-000000000003';
update profils set nom = 'Yacine Kadri' where id = 'c3200000-0000-0000-0000-000000000004';
update profils set role = 'commercant', boutique_id = 'd3200000-0000-0000-0000-000000000001', nom = 'Karim' where id = 'b3200000-0000-0000-0000-000000000001';
update profils set role = 'admin' where id = 'a3200000-0000-0000-0000-000000000001';

-- Commandes posées directement (déclencheurs de commande coupés : seul l'état final compte ici).
set local session_replication_role = replica;
insert into commandes (id, client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, terminee_le) values
  ('e3200000-0000-0000-0000-000000000001', 'c3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'qr', now() - interval '2 days'),
  ('e3200000-0000-0000-0000-000000000002', 'c3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'code', now() - interval '1 day'),
  ('e3200000-0000-0000-0000-000000000003', 'c3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'manuel', now() - interval '1 day'),
  ('e3200000-0000-0000-0000-000000000004', 'c3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Amine', '+213555000001', 3500, 'qr', now() - interval '15 days'),
  ('e3200000-0000-0000-0000-000000000005', 'c3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'prete', 'Amine', '+213555000001', 3500, null, null),
  ('e3200000-0000-0000-0000-000000000006', 'c3200000-0000-0000-0000-000000000002', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Sara', '+213555000002', 3500, 'qr', now() - interval '13 days 23 hours'),
  ('e3200000-0000-0000-0000-000000000007', 'c3200000-0000-0000-0000-000000000003', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Nadia', '+213555000003', 3500, 'qr', now() - interval '3 days'),
  ('e3200000-0000-0000-0000-000000000008', 'b3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Karim', '+213555000004', 3500, 'qr', now() - interval '1 day'),
  ('e3200000-0000-0000-0000-000000000009', 'c3200000-0000-0000-0000-000000000004', 'd3200000-0000-0000-0000-000000000002', 'recuperee', 'Yacine', '+213555000005', 3500, 'qr', now() - interval '1 day'),
  ('e3200000-0000-0000-0000-00000000000a', 'c3200000-0000-0000-0000-000000000004', 'd3200000-0000-0000-0000-000000000001', 'recuperee', 'Yacine', '+213555000005', 3500, 'qr', now() - interval '1 day');
set local session_replication_role = origin;

-- 1. Filtre de contenu.
select pg_temp.ok(not prive.contenu_interdit('Très bon accueil, la robe est comme sur la photo.'), 'filtre : commentaire normal accepté');
select pg_temp.ok(not prive.contenu_interdit('استقبال مليح، السلعة كيما في الصورة'), 'filtre : commentaire en arabe accepté');
select pg_temp.ok(not prive.contenu_interdit('Payé 3 500 DA, taille 42, 2 pièces.'), 'filtre : prix et tailles acceptés (moins de 8 chiffres)');
select pg_temp.ok(prive.contenu_interdit('Voir https://exemple.org'), 'filtre : lien http refusé');
select pg_temp.ok(prive.contenu_interdit('allez sur www.exemple'), 'filtre : www. refusé');
select pg_temp.ok(prive.contenu_interdit('mieux sur autreboutique.com !'), 'filtre : domaine .com refusé');
select pg_temp.ok(prive.contenu_interdit('Appelez le 0555 12 34 56'), 'filtre : numéro avec espaces refusé');
select pg_temp.ok(prive.contenu_interdit('0555.12.34.56'), 'filtre : numéro avec points refusé');
select pg_temp.ok(prive.contenu_interdit('رقمي ٠٥٥٥١٢٣٤٥٦'), 'filtre : numéro en chiffres arabes refusé');
select pg_temp.ok(prive.contenu_interdit('Vendeur CONNARD'), 'filtre : mot grossier (majuscules) refusé');
select pg_temp.ok(prive.contenu_interdit('vendeur enculé'), 'filtre : mot grossier accentué refusé');
select pg_temp.ok(prive.contenu_interdit('wesh zebi'), 'filtre : darja en lettres latines refusée');
select pg_temp.ok(prive.contenu_interdit('البياع قحبة'), 'filtre : mot grossier en arabe refusé');
select pg_temp.ok(not prive.contenu_interdit('Nickel, très propre'), 'filtre : mot qui contient un mot interdit (nickel) accepté');

-- 2. Donner un avis : règles.
set local role authenticated;
select pg_temp.compte(null);
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 5)$$, '42501', 'Connectez-vous', 'sans connexion : refusé');
select pg_temp.compte('c3200000-0000-0000-0000-000000000002');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 5)$$, 'P0002', 'Commande introuvable', 'commande d''un autre client : introuvable');
select pg_temp.compte('c3200000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000002', 5)$$, '22023', 'récupérée avec votre QR code', 'remise par code à 6 chiffres : refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000003', 5)$$, '22023', 'récupérée avec votre QR code', 'remise sans QR code : refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000005', 5)$$, '22023', 'récupérée avec votre QR code', 'commande pas encore récupérée : refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000004', 5)$$, '22023', '14 jours', 'récupérée il y a 15 jours : refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 0)$$, '22023', 'de 1 à 5', 'note 0 refusée');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 6)$$, '22023', 'de 1 à 5', 'note 6 refusée');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 5, array['prix'])$$, '22023', 'Critère inconnu', 'critère inconnu refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 5, array['accueil', 'accueil'])$$, '22023', 'Critère inconnu', 'critère en double refusé');
select pg_temp.erreur(format('select donner_avis(%L, 5, %L, %L)', 'e3200000-0000-0000-0000-000000000001', '{}', repeat('a', 301)), '22023', '300 caractères', 'commentaire de 301 caractères refusé');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 5, '{}', 'Appelez le 0555 12 34 56')$$, '22023',
  'ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier', 'commentaire avec numéro refusé (message n° 8)');
select pg_temp.ok((select count(*) from avis) = 0, 'aucun avis enregistré après les refus');
select pg_temp.ok((donner_avis('e3200000-0000-0000-0000-000000000001', 5, array['rapidite', 'accueil'], '  Très bon accueil, la robe est comme sur la photo.  ') ->> 'avis') is not null,
  'QR code, il y a 2 jours : avis publié');
select pg_temp.ok((select note = 5 and criteres = array['accueil', 'rapidite'] and commentaire = 'Très bon accueil, la robe est comme sur la photo.'
  and statut = 'publie' and reponse is null and boutique_id = 'd3200000-0000-0000-0000-000000000001' from avis),
  'avis : note, critères rangés, commentaire sans espaces autour, publié, boutique de la commande');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000001', 1)$$, '23505', 'déjà donné', 'deuxième avis sur la même commande : refusé');
select pg_temp.erreur($$update avis set note = 1$$, '42501', 'permission denied', 'client : pas de modification de son avis');
select pg_temp.erreur($$delete from avis$$, '42501', 'permission denied', 'client : pas de suppression');
select pg_temp.erreur($$insert into avis (commande_id, boutique_id, client_id, note) values ('e3200000-0000-0000-0000-000000000004', 'd3200000-0000-0000-0000-000000000001', 'c3200000-0000-0000-0000-000000000001', 5)$$,
  '42501', 'permission denied', 'client : pas d''écriture directe');
select pg_temp.ok((select statut::text = 'recuperee' and mode_remise = 'qr' from commandes where id = 'e3200000-0000-0000-0000-000000000001'),
  'la commande ne change pas');

select pg_temp.compte('c3200000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from avis) = 0, 'un client ne lit pas les avis des autres dans la table');
select pg_temp.ok((donner_avis('e3200000-0000-0000-0000-000000000006', 3, '{}', null) ->> 'avis') is not null, 'récupérée il y a 13 jours 23 h : avis publié, sans commentaire');
select pg_temp.ok((select count(*) = 1 and min(commentaire) is null and min(criteres::text) = '{}' from avis), 'le client lit son avis ; commentaire vide = null');

select pg_temp.compte('c3200000-0000-0000-0000-000000000003');
select pg_temp.ok((donner_avis('e3200000-0000-0000-0000-000000000007', 4, array['article_conforme'], 'Vendeur très gentil.') ->> 'avis') is not null,
  'client bloqué : garde le droit de donner un avis');
select pg_temp.ok((select bloque and bloque_par_admin from profils where id = 'c3200000-0000-0000-0000-000000000003'), 'client bloqué : toujours bloqué');

select pg_temp.compte('b3200000-0000-0000-0000-000000000001');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-000000000008', 5)$$, '42501', 'propre boutique', 'commerçant : pas d''avis sur sa propre boutique');
select pg_temp.ok((select count(*) from avis) = 0, 'commerçant : ne lit pas la table des avis');

-- 3. Lectures publiques.
select pg_temp.compte(null);
set local role anon;
select pg_temp.erreur($$select * from avis$$, '42501', 'permission denied', 'visiteur : pas de lecture de la table');
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000001')) = 3, 'avis_boutique : 3 avis publiés');
select pg_temp.ok((select auteur from avis_boutique('d3200000-0000-0000-0000-000000000001') where note = 5) = 'Amine B.', 'auteur : prénom et initiale (« Amine B. »)');
select pg_temp.ok((select auteur from avis_boutique('d3200000-0000-0000-0000-000000000001') where note = 3) = 'Sara', 'auteur : prénom seul quand le nom n''a qu''un mot');
select pg_temp.ok((select mois from avis_boutique('d3200000-0000-0000-0000-000000000001') limit 1) = date_trunc('month', now() at time zone 'Africa/Algiers')::date,
  'mois seulement, jamais la date exacte');
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000001', 2)) = 2, 'avis_boutique : limite');
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000001', 2, 2)) = 1, 'avis_boutique : page suivante');
select pg_temp.ok((select array_agg(p.parameter_name::text order by p.ordinal_position) from information_schema.parameters p
  join information_schema.routines r on r.specific_name = p.specific_name where r.routine_name = 'avis_boutique' and p.parameter_mode = 'OUT')
  = array['id', 'auteur', 'note', 'criteres', 'commentaire', 'mois', 'reponse'], 'avis_boutique : ni client, ni commande, ni numéro, ni date exacte');
select pg_temp.ok((select nombre = 3 and moyenne = 4.0 and criteres = '{"accueil": 1, "article_conforme": 1, "rapidite": 1}'::jsonb
  from resume_avis(array['d3200000-0000-0000-0000-000000000001'::uuid])), 'resume_avis : 3 avis, moyenne 4,0, critères comptés');

-- Seuil : 2 avis → pas de moyenne.
reset role;
update avis set statut = 'masque' where commande_id = 'e3200000-0000-0000-0000-000000000007';
set local role anon;
select pg_temp.ok((select nombre = 2 and moyenne is null from resume_avis(array['d3200000-0000-0000-0000-000000000001'::uuid])),
  'sous le seuil (2 avis publiés) : pas de moyenne ; avis masqué non compté');
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000001')) = 2, 'avis masqué : plus lisible');
reset role;
insert into prive.reglages (cle, valeur) values ('avis_seuil', '2');
set local role anon;
select pg_temp.ok((select moyenne = 4.0 from resume_avis(array['d3200000-0000-0000-0000-000000000001'::uuid])), 'seuil réglable (avis_seuil = 2)');
reset role;
delete from prive.reglages where cle = 'avis_seuil';

-- Boutique d'une ville fermée, boutique en attente, boutique sans avis.
set local session_replication_role = replica;
insert into avis (commande_id, boutique_id, client_id, note) values
  ('e3200000-0000-0000-0000-000000000009', 'd3200000-0000-0000-0000-000000000002', 'c3200000-0000-0000-0000-000000000004', 5);
set local session_replication_role = origin;
set local role anon;
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000002')) = 0, 'ville fermée (Tlemcen) : avis non lisibles');
select pg_temp.ok((select count(*) from resume_avis(array['d3200000-0000-0000-0000-000000000002'::uuid, 'd3200000-0000-0000-0000-000000000003'::uuid])) = 0,
  'resume_avis : ville fermée et boutique en attente absentes');
reset role;
update boutiques set statut = 'suspendue' where id = 'd3200000-0000-0000-0000-000000000001';
set local role anon;
select pg_temp.ok((select count(*) from avis_boutique('d3200000-0000-0000-0000-000000000001')) = 0, 'boutique suspendue : avis non lisibles');
reset role;
update boutiques set statut = 'validee' where id = 'd3200000-0000-0000-0000-000000000001';
insert into boutiques (id, nom, slug, quartier, whatsapp, statut, ville) values
  ('d3200000-0000-0000-0000-000000000004', 'Boutique Neuve', 'boutique-neuve-32', 'Centre', '+213555320004', 'validee', 'oran');
set local role anon;
select pg_temp.ok((select nombre = 0 and moyenne is null and criteres = '{"accueil": 0, "article_conforme": 0, "rapidite": 0}'::jsonb
  from resume_avis(array['d3200000-0000-0000-0000-000000000004'::uuid])), 'boutique sans avis : 0, pas de moyenne');
select pg_temp.ok((select count(*) from resume_avis(array['d3200000-0000-0000-0000-000000000001'::uuid, 'd3200000-0000-0000-0000-000000000004'::uuid,
  'd3200000-0000-0000-0000-000000000001'::uuid])) = 2, 'resume_avis : une ligne par boutique (doublons ignorés)');
select pg_temp.erreur($$select donner_avis('e3200000-0000-0000-0000-00000000000a', 5)$$, '42501', 'permission denied', 'visiteur : donner_avis non accessible');

-- 4. Admin.
reset role;
set local role authenticated;
select pg_temp.compte('a3200000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from avis) = 4, 'admin : lit tous les avis');
reset role;

-- 5. Droits : fonctions privées non accessibles par l'API.
select pg_temp.ok(not has_function_privilege('anon', 'prive.contenu_interdit(text)', 'execute')
  and not has_function_privilege('authenticated', 'prive.contenu_interdit(text)', 'execute')
  and not has_table_privilege('authenticated', 'prive.mots_interdits', 'select'), 'filtre et liste de mots : hors de l''API');
select pg_temp.ok(has_function_privilege('anon', 'public.avis_boutique(uuid, integer, integer)', 'execute')
  and has_function_privilege('anon', 'public.resume_avis(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.donner_avis(uuid, integer, text[], text)', 'execute'), 'droits : lectures publiques, écriture pour les comptes');

rollback;

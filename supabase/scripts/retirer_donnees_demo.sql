-- =============================================================================
-- OranPromo : retirer les données de démonstration (avant la mise en ligne)
-- =============================================================================
-- CE N'EST PAS UNE MIGRATION : ce fichier est hors de supabase/migrations et n'est
-- jamais appliqué automatiquement. Le propriétaire décide du jour où il le lance.
--
-- Mode d'emploi (Supabase > SQL Editor, coller tout le fichier) :
--   1. ESSAI À BLANC : lancer le fichier tel quel. Rien n'est supprimé ; le tableau
--      final indique, table par table, ce qui SERAIT supprimé.
--   2. SUPPRESSION : remplacer « appliquer constant boolean := false » par « true »
--      (ligne marquée ⚠ plus bas), relancer. Le tableau indique ce qui a été supprimé.
--   3. Relancer une deuxième fois (avec true) doit donner 0 partout (script idempotent).
--
-- Tout se passe dans UNE instruction (bloc DO) : en cas d'erreur, rien n'est supprimé.
--
-- Ce qui est supprimé (liste vérifiée en lecture sur la base le 9 octobre 2026) :
--   - compte de test hakim3142@gmail.com (da9f4aa4-9bfa-4312-9a8f-05c3eefffc99,
--     commerçant de Boutique Nour) et tout ce qui en dépend (profil, connexions,
--     commandes passées, contestations, quota IA, décisions de modération écrites) ;
--   - boutique « Boutique Nour » (22222222-2222-2222-2222-222222222222, slug boutique-nour)
--     et tout ce qui en dépend (articles, commandes reçues, statistiques) ;
--   - les 5 articles de démonstration a0000000-0000-0000-0000-00000000000[1-5]
--     (3 de Maison Ilyes, 2 de Boutique Nour), leurs photos, tailles, promos, statistiques,
--     signalements ;
--   - si supabase/scripts/demo_parfumerie.sql a été lancé (US-25) : la boutique « Parfumerie Démo »
--     (33333333-3333-3333-3333-333333333333, slug parfumerie-demo, WhatsApp de test +213000000003),
--     ses 5 articles a0000000-0000-0000-0000-000000000006 à …010 (parfums), leurs 5 photos
--     placehold.co, 6 contenances, 4 promos, et tout ce qui en dépend (commandes reçues et
--     leurs messages, statistiques, signalements) ;
--   - plus généralement, tout article dont l'identifiant commence par a0000000-0000-0000-0000- ;
--   - toute photo dont l'adresse est sur placehold.co ;
--   - les messages WhatsApp liés à ces commandes ou envoyés aux numéros de test.
-- Ce qui est GARDÉ :
--   - le compte admin benattia.hakim@gmail.com (78b03d9d-299d-480b-b2b9-f6149523bb27),
--     et plus généralement tout compte admin (le script s'arrête s'il devait en supprimer un) ;
--   - la boutique « Maison Ilyes » (boutique de l'admin), vide d'articles après le retrait ;
--   - les réglages (prive.reglages) ;
--   - les lignes de vraies commandes qui citaient un article de démonstration : la commande
--     reste, la ligne garde son titre et son prix, seul le lien vers l'article est retiré.
-- Photos dans le stockage Supabase : la base interdit de les supprimer en SQL
-- (protect_objects_delete). S'il en existe pour la démo, le script s'arrête et demande de
-- les supprimer d'abord dans Storage > photos (aucune le 9 octobre 2026).
-- =============================================================================

create temp table if not exists rapport_retrait_demo (ordre int, objet text, nombre bigint);
truncate rapport_retrait_demo;

do $retrait$
declare
  -- ⚠ false = essai à blanc (rien n'est supprimé) ; true = suppression réelle.
  appliquer constant boolean := false or coalesce(current_setting('oranpromo.retirer_demo', true), '') = 'oui';

  comptes_demo constant uuid[] := array['da9f4aa4-9bfa-4312-9a8f-05c3eefffc99']::uuid[];
  -- Boutique Nour ; Parfumerie Démo (US-25, présente seulement si demo_parfumerie.sql a été lancé).
  boutiques_demo constant uuid[] := array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[];

  articles_demo uuid[];
  commandes_demo uuid[];
  numeros_demo text[];
  tables_suivies constant text[] := array[
    'auth.users', 'auth.identities', 'auth.sessions', 'profils', 'boutiques', 'articles', 'photos',
    'tailles', 'promos', 'evenements', 'signalements', 'decisions', 'commandes', 'lignes_commande',
    'suivi_commandes', 'contestations', 'messages_whatsapp', 'appels_ia', 'prive.envois_codes'];
  avant bigint[] := '{}';
  apres bigint[] := '{}';
  lignes_detachees bigint;
  admins_avant bigint;
  i int;
  n bigint;

begin
  -- Garde-fous ----------------------------------------------------------------
  if exists (select 1 from profils where id = any(comptes_demo) and role = 'admin') then
    raise exception 'Arrêt : un compte de la liste de démonstration est admin. Rien n''a été supprimé.';
  end if;
  select count(*) into admins_avant from profils where role = 'admin';

  -- Périmètre (calculé avant toute suppression) --------------------------------
  select coalesce(array_agg(id), '{}') into articles_demo from articles
   where id::text like 'a0000000-0000-0000-0000-%' or boutique_id = any(boutiques_demo);
  select coalesce(array_agg(id), '{}') into commandes_demo from commandes
   where boutique_id = any(boutiques_demo) or client_id = any(comptes_demo);
  select coalesce(array_agg(distinct numero), '{}') into numeros_demo from (
    select whatsapp as numero from boutiques where id = any(boutiques_demo)
    union select telephone from profils where id = any(comptes_demo) and telephone is not null) x;

  if to_regclass('storage.objects') is not null then
    execute $q$select count(*) from storage.objects where bucket_id = 'photos'
      and (split_part(name, '/', 1) = any($1) or split_part(name, '/', 2) = any($2))$q$
      into n using (select array_agg(b::text) from unnest(boutiques_demo) b), (select coalesce(array_agg(a::text), '{}') from unnest(articles_demo) a);
    if n > 0 then
      raise exception 'Arrêt : % fichier(s) de démonstration dans Storage > photos. Supprimez-les d''abord dans le tableau de bord Supabase, puis relancez. Rien n''a été supprimé.', n;
    end if;
  end if;

  select count(*) into lignes_detachees from lignes_commande
   where article_id = any(articles_demo) and not (commande_id = any(commandes_demo));

  for i in 1 .. array_length(tables_suivies, 1) loop
    n := null;
    if to_regclass(tables_suivies[i]) is not null then execute format('select count(*) from %s', tables_suivies[i]) into n; end if;
    avant := avant || n;
  end loop;

  -- Suppression (annulée à la fin en essai à blanc) ----------------------------
  begin
    -- Décisions de modération écrites par un compte de démo ou portant sur un article de démo
    -- (la clé decisions.auteur_id bloquerait la suppression du compte).
    delete from decisions where auteur_id = any(comptes_demo)
       or signalement_id in (select id from signalements where article_id = any(articles_demo));
    -- Messages WhatsApp : liés aux commandes de démo ou envoyés aux numéros de test.
    delete from messages_whatsapp where commande_id = any(commandes_demo) or destinataire = any(numeros_demo);
    -- Commandes (lignes, suivi, contestations suivent par cascade).
    delete from commandes where id = any(commandes_demo);
    -- Photos d'exemple (placehold.co), même sur un article qui resterait.
    delete from photos where adresse like 'https://placehold.co/%' or adresse_vignette like 'https://placehold.co/%';
    -- Articles (photos, tailles, promos, statistiques, signalements suivent par cascade ;
    -- les lignes de vraies commandes gardent leur titre, article_id devient vide).
    delete from articles where id = any(articles_demo);
    -- Boutiques (statistiques par cascade ; un profil rattaché perd son rattachement).
    delete from boutiques where id = any(boutiques_demo);
    -- Codes de connexion envoyés aux numéros de test.
    if to_regclass('prive.envois_codes') is not null then
      delete from prive.envois_codes where telephone = any(numeros_demo);
    end if;
    -- Comptes (profil, connexions, quota IA suivent par cascade).
    delete from auth.users where id = any(comptes_demo);

    if (select count(*) from profils where role = 'admin') <> admins_avant then
      raise exception 'Arrêt : un compte admin aurait été supprimé. Rien n''a été supprimé.';
    end if;

    for i in 1 .. array_length(tables_suivies, 1) loop
      n := null;
      if to_regclass(tables_suivies[i]) is not null then execute format('select count(*) from %s', tables_suivies[i]) into n; end if;
      apres := apres || n;
    end loop;

    if not appliquer then
      raise exception using errcode = 'OPDEM', message = 'essai à blanc';
    end if;
  exception when sqlstate 'OPDEM' then
    null; -- essai à blanc : toutes les suppressions du bloc sont annulées
  end;

  -- Rapport --------------------------------------------------------------------
  insert into rapport_retrait_demo values (0, case when appliquer then 'SUPPRESSION EFFECTUÉE' else 'ESSAI À BLANC : rien n''a été supprimé, voici ce qui le serait' end, null);
  for i in 1 .. array_length(tables_suivies, 1) loop
    if avant[i] is not null then
      insert into rapport_retrait_demo values (i, tables_suivies[i], avant[i] - apres[i]);
    end if;
  end loop;
  insert into rapport_retrait_demo values (100, 'lignes_commande gardées, lien vers l''article retiré', lignes_detachees);
end
$retrait$;

select objet as "Table", nombre as "Lignes supprimées (ou qui le seraient)" from rapport_retrait_demo order by ordre;

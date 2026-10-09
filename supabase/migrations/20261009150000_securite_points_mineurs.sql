-- Sécurité : points mineurs de la revue de code.
-- Règles appliquées par la base : elles tiennent même si le navigateur appelle Supabase
-- directement avec la clé publique. Des triggers plutôt que des contraintes CHECK : les
-- lignes existantes (ex. photos de démonstration placehold.co) ne sont pas revalidées et
-- ne bloquent pas les autres modifications.

-- ---------------------------------------------------------------------------
-- 1. Prix promo : entier > 0 et strictement inférieur au prix normal de l'article.
--    Vérifié à l'écriture de la promo ET à la baisse du prix de l'article
--    (avant : contrôle uniquement dans lib/promo.ts et lib/gestion-articles.ts).
-- ---------------------------------------------------------------------------
create or replace function prive.verifier_prix_promo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prix_normal integer;
begin
  select a.prix into prix_normal from articles a where a.id = new.article_id;
  if new.prix_promo is null or new.prix_promo <= 0 or prix_normal is null or new.prix_promo >= prix_normal then
    raise exception 'Le prix promo doit être supérieur à 0 et inférieur au prix normal.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke execute on function prive.verifier_prix_promo() from public, anon, authenticated;

create trigger promo_prix_verifie before insert or update of prix_promo, article_id on promos
  for each row execute function prive.verifier_prix_promo();

create or replace function prive.verifier_prix_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.prix is distinct from old.prix
     and exists (select 1 from promos p where p.article_id = new.id and p.prix_promo >= new.prix) then
    raise exception 'Le prix doit rester supérieur au prix promo, ou arrêtez d''abord la promo.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke execute on function prive.verifier_prix_article() from public, anon, authenticated;

create trigger article_prix_verifie before update of prix on articles
  for each row execute function prive.verifier_prix_article();

-- ---------------------------------------------------------------------------
-- 2. Adresse des photos : uniquement le stockage public « photos » du projet, dans le dossier
--    de l'article (<boutique_id>/<article_id>/<fichier>), comme le produit lib/publication-article.ts.
--    Vérifié à l'insertion et quand adresse, adresse_vignette ou article_id changent.
--    Le service (clé secrète, données de démonstration) n'est pas concerné.
-- ---------------------------------------------------------------------------
create or replace function prive.verifier_adresse_photo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dossier text;
  modele text;
begin
  if auth.uid() is null and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'anon' then
    return new; -- service (clé secrète, migrations)
  end if;
  if tg_op = 'UPDATE' and new.adresse is not distinct from old.adresse
     and new.adresse_vignette is not distinct from old.adresse_vignette
     and new.article_id is not distinct from old.article_id then
    return new; -- ex. changement d'ordre d'une photo de démonstration
  end if;
  select a.boutique_id::text || '/' || a.id::text || '/' into dossier from articles a where a.id = new.article_id;
  modele := '^https://iloyliuzsflzbkhpvxjt\.supabase\.co/storage/v1/object/public/photos/'
    || coalesce(dossier, 'aucun') || '[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$';
  if new.adresse !~ modele or (new.adresse_vignette is not null and new.adresse_vignette !~ modele) then
    raise exception 'Adresse de photo invalide : seules les photos envoyées dans le dossier de l''article sont acceptées.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke execute on function prive.verifier_adresse_photo() from public, anon, authenticated;

create trigger photo_adresse_verifiee before insert or update on photos
  for each row execute function prive.verifier_adresse_photo();

-- ---------------------------------------------------------------------------
-- 3. Statistiques (evenements) : date fixée par la base, et débit limité par boutique.
--    Sans identifiant de visiteur (choix de confidentialité), on ne peut pas distinguer deux
--    visiteurs : la limite borne le volume et le gonflement des chiffres, sans l'empêcher.
-- ---------------------------------------------------------------------------
create or replace function prive.controler_evenement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.date := now();
  if (select count(*) from evenements e
      where e.boutique_id = new.boutique_id and e.date > now() - interval '1 minute') >= 120 then
    raise exception 'Trop d''événements pour cette boutique, réessayez plus tard.' using errcode = '54000';
  end if;
  return new;
end $$;

revoke execute on function prive.controler_evenement() from public, anon, authenticated;

create trigger evenement_controle before insert on evenements
  for each row execute function prive.controler_evenement();

-- ---------------------------------------------------------------------------
-- 4. Signalements : date et statut fixés par la base à la création, débit limité
--    (10 par heure et par article, 200 par heure au total). Le commentaire reste limité
--    à 1000 caractères (contrainte du schéma initial).
-- ---------------------------------------------------------------------------
create index signalements_article_date_idx on signalements (article_id, cree_le);
create index signalements_date_idx on signalements (cree_le);

create or replace function prive.controler_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.cree_le := now();
  new.statut := 'ouvert';
  if (select count(*) from signalements s
      where s.article_id = new.article_id and s.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Cet article a déjà été signalé plusieurs fois, merci. Il sera examiné rapidement.' using errcode = '54000';
  end if;
  if (select count(*) from signalements s where s.cree_le > now() - interval '1 hour') >= 200 then
    raise exception 'Trop de signalements en ce moment, réessayez plus tard.' using errcode = '54000';
  end if;
  return new;
end $$;

revoke execute on function prive.controler_signalement() from public, anon, authenticated;

create trigger signalement_controle before insert on signalements
  for each row execute function prive.controler_signalement();

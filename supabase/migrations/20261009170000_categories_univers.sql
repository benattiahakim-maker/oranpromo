-- Catégories : nouvelle liste en 4 univers (Femme · Homme · Enfant · Beauté).
-- Liste officielle dans lib/article.ts (CATEGORIES_MODE, CATEGORIES_BEAUTE) : la garder identique ici.
-- Le genre reste obligatoire dans la base (type genre_article, « mixte » par défaut) : pour la beauté,
-- un genre non précisé est enregistré « mixte » par l'application.

-- ---------------------------------------------------------------------------
-- 1. Reprise des articles existants : anciennes catégories → nouvelles catégories les plus proches.
--    Les tailles existantes restent valides (mêmes listes de tailles pour ces catégories).
-- ---------------------------------------------------------------------------
update articles set categorie = case categorie
    when 'Polos' then 'T-shirts et polos'
    when 'T-shirts' then 'T-shirts et polos'
    when 'Pulls' then 'Pulls et sweats'
    when 'Vestes' then 'Vestes et manteaux'
    when 'Pantalons' then 'Pantalons et jeans'
    when 'Jeans' then 'Pantalons et jeans'
    else categorie
  end
where categorie in ('Polos', 'T-shirts', 'Pulls', 'Vestes', 'Pantalons', 'Jeans');

-- ---------------------------------------------------------------------------
-- 2. Seules les catégories de la liste sont acceptées à l'écriture (commerçant, admin).
--    Trigger plutôt que contrainte CHECK, comme les autres règles : une ligne existante hors liste
--    (données de démonstration) n'est pas revalidée tant que sa catégorie ne change pas.
--    Le service (clé secrète, migrations) n'est pas concerné.
-- ---------------------------------------------------------------------------
create or replace function prive.verifier_categorie_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- service (clé secrète, migrations)
  end if;
  if tg_op = 'UPDATE' and new.categorie is not distinct from old.categorie then
    return new;
  end if;
  if new.categorie is null or new.categorie not in (
    'T-shirts et polos', 'Chemises', 'Pulls et sweats', 'Vestes et manteaux', 'Pantalons et jeans',
    'Survêtements et ensembles', 'Robes', 'Jupes', 'Abayas, djellabas, kamis', 'Tenues traditionnelles',
    'Hijabs et foulards', 'Chaussures', 'Sacs', 'Accessoires',
    'Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel'
  ) then
    raise exception 'Catégorie inconnue : choisissez une catégorie de la liste.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke execute on function prive.verifier_categorie_article() from public, anon, authenticated;

create trigger article_categorie_verifiee before insert or update of categorie on articles
  for each row execute function prive.verifier_categorie_article();

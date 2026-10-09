-- US-20.1 : stock par article et par taille.
-- tailles.quantite = nombre de pièces (stock indicatif : la boutique vend aussi en direct).
-- tailles.disponible devient un champ calculé par la base (quantite > 0), pour que tout le code
-- existant (fiche, catalogue, filtre de taille) continue de fonctionner sans changement.

-- ---------------------------------------------------------------------------
-- 1. Quantité : 1 pièce par taille disponible, 0 sinon (reprise des données existantes).
-- ---------------------------------------------------------------------------
alter table tailles add column quantite integer not null default 1
  check (quantite between 0 and 999);
update tailles set quantite = case when disponible then 1 else 0 end;

-- ---------------------------------------------------------------------------
-- 2. disponible = quantite > 0.
--    Une écriture de « disponible » seule (formulaire de modification, ancien code) est traduite :
--    false → quantité 0 ; true → au moins 1 pièce (la quantité connue est gardée si elle est > 0).
-- ---------------------------------------------------------------------------
create or replace function prive.synchroniser_disponibilite_taille() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not new.disponible then
      new.quantite := 0;
    end if;
  elsif new.quantite is not distinct from old.quantite and new.disponible is distinct from old.disponible then
    new.quantite := case when new.disponible then greatest(old.quantite, 1) else 0 end;
  end if;
  new.disponible := new.quantite > 0;
  return new;
end $$;

revoke execute on function prive.synchroniser_disponibilite_taille() from public, anon, authenticated;

create trigger taille_disponibilite_synchronisee before insert or update on tailles
  for each row execute function prive.synchroniser_disponibilite_taille();

-- ---------------------------------------------------------------------------
-- 3. Visibilité : un article dont toutes les tailles sont à 0 passe « Vendu » (il sort des listes,
--    sa fiche affiche « Article plus disponible ») ; quand le stock repasse de 0 à plus de 0,
--    un article « Vendu » redevient « Disponible ». Un article masqué n'est jamais touché.
--    Un article « Vendu » à la main avec du stock reste « Vendu » tant que son stock ne passe pas par 0.
-- ---------------------------------------------------------------------------
create or replace function prive.statut_article_selon_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  article uuid := coalesce(new.article_id, old.article_id);
  total integer;
  total_avant integer;
begin
  select coalesce(sum(t.quantite), 0) into total from tailles t where t.article_id = article;
  total_avant := total
    - (case when tg_op in ('INSERT', 'UPDATE') then new.quantite else 0 end)
    + (case when tg_op in ('UPDATE', 'DELETE') then old.quantite else 0 end);
  if total = 0 and exists (select 1 from tailles t where t.article_id = article) then
    update articles set statut = 'vendu' where id = article and statut in ('disponible', 'reserve');
  elsif total > 0 and total_avant = 0 then
    update articles set statut = 'disponible' where id = article and statut = 'vendu';
  end if;
  return null;
end $$;

revoke execute on function prive.statut_article_selon_stock() from public, anon, authenticated;

create trigger article_statut_selon_stock after insert or update of quantite or delete on tailles
  for each row execute function prive.statut_article_selon_stock();

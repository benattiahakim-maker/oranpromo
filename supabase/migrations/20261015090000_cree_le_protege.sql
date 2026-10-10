-- Relecture n°6, point 1 : profils.cree_le n'est plus modifiable en direct (client, commerçant, admin).
-- Avant : un client pouvait remettre sa date d'inscription à maintenant (update profils set cree_le = now()) et
-- contourner les 7 jours de choisir_parrain, l'ordre anti-boucle (parrain inscrit avant le filleul) et les 60 jours
-- de valider_parrainage / parrainage_quotidien. Même fonction que 20261012090000_parrainage.sql, une ligne en plus.
-- Les fonctions de la base (security definer, propriétaire postgres) et le SQL Editor gardent la main.
create or replace function prive.proteger_colonnes_parrainage() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_table_name = 'profils' then
      new.code_parrainage := old.code_parrainage;
      new.parrainage_exclu := old.parrainage_exclu;
      new.cree_le := old.cree_le;
    elsif tg_op = 'INSERT' then
      new.bons_acceptes := true;
    else
      new.bons_acceptes := old.bons_acceptes;
    end if;
  end if;
  return new;
end $$;
revoke execute on function prive.proteger_colonnes_parrainage() from public, anon, authenticated;

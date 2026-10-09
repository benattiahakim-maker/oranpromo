-- Nom de boutique : une seule limite, 2 à 80 caractères, à l'écran, sur le serveur et dans la base.
-- La contrainte boutiques.nom (char_length entre 2 et 80) existe depuis le schéma initial, mais le formulaire acceptait
-- 120 caractères et la base répondait par une erreur technique. Ce déclencheur retire les espaces autour du nom (comme
-- le serveur) et refuse un nom hors limite avec un message clair en français, même pour un appel direct à Supabase.
-- Les noms existants sont déjà conformes (contrainte) ; la contrainte reste en place.

create or replace function prive.verifier_nom_boutique() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nom := btrim(new.nom);
  if new.nom is null or char_length(new.nom) not between 2 and 80 then
    raise exception 'Le nom de la boutique doit contenir entre 2 et 80 caractères.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function prive.verifier_nom_boutique() from public, anon, authenticated;

create trigger boutique_nom_verifie before insert or update of nom on public.boutiques
  for each row execute function prive.verifier_nom_boutique();

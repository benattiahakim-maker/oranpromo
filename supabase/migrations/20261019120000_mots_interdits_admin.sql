-- US-32 (suite, demande du chef de projet) : liste des mots interdits tenue par l'admin dans /admin/moderation
-- (onglet « Mots interdits ») au lieu de l'éditeur SQL. docs/architecture.md, « Avis clients sur les boutiques (US-32) ».
-- La table prive.mots_interdits (20261019090000_avis.sql) et le filtre prive.contenu_interdit ne changent pas :
-- trois fonctions réservées à l'admin (lire, ajouter, retirer). Le mot est ramené à la forme comparée par le filtre
-- (prive.texte_normalise : minuscules, sans accents, chiffres arabes en 0-9). Les avis déjà publiés ne changent pas.

create or replace function public.mots_interdits() returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_admin() then raise exception 'Accès réservé' using errcode = '42501'; end if;
  return query select m.mot from prive.mots_interdits m order by m.mot;
end $$;
revoke execute on function public.mots_interdits() from public, anon;
grant execute on function public.mots_interdits() to authenticated;

-- Retourne le mot tel qu'il est enregistré (forme normalisée). Déjà présent : aucune erreur, rien ne change.
create or replace function public.ajouter_mot_interdit(mot text) returns text
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  m text := btrim(prive.texte_normalise(mot));
begin
  if not prive.est_admin() then raise exception 'Accès réservé' using errcode = '42501'; end if;
  if m ~ '\s' then raise exception 'Un seul mot, sans espace.' using errcode = '22023'; end if;
  -- Le filtre coupe le texte sur la ponctuation : un mot qui en contient ne serait jamais reconnu.
  if m ~ '[[:punct:]،؛؟«»…’]' then raise exception 'Le mot ne doit pas contenir de ponctuation.' using errcode = '22023'; end if;
  if char_length(m) not between 2 and 40 then raise exception 'Le mot doit faire entre 2 et 40 caractères.' using errcode = '22023'; end if;
  insert into prive.mots_interdits (mot) values (m) on conflict on constraint mots_interdits_pkey do nothing;
  return m;
end $$;
revoke execute on function public.ajouter_mot_interdit(text) from public, anon;
grant execute on function public.ajouter_mot_interdit(text) to authenticated;

create or replace function public.retirer_mot_interdit(mot text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
begin
  if not prive.est_admin() then raise exception 'Accès réservé' using errcode = '42501'; end if;
  delete from prive.mots_interdits i where i.mot = btrim(prive.texte_normalise(mot));
  if not found then raise exception 'Ce mot n''est pas dans la liste.' using errcode = 'P0002'; end if;
end $$;
revoke execute on function public.retirer_mot_interdit(text) from public, anon;
grant execute on function public.retirer_mot_interdit(text) to authenticated;

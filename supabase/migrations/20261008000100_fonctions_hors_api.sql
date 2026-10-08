-- Les fonctions internes sortent du schéma exposé par l'API (alerte sécurité Supabase).
create schema if not exists prive;
grant usage on schema prive to anon, authenticated;

alter function public.ma_boutique() set schema prive;
alter function public.est_admin() set schema prive;
alter function public.article_visible(uuid) set schema prive;
alter function public.article_de_ma_boutique(uuid) set schema prive;
alter function public.creer_profil() set schema prive;
alter function public.proteger_statut_boutique() set schema prive;
alter function public.rattacher_boutique() set schema prive;
alter function public.proteger_profil() set schema prive;

-- Les fonctions de déclencheur ne sont jamais appelées directement.
revoke execute on function prive.creer_profil() from public, anon, authenticated;
revoke execute on function prive.proteger_statut_boutique() from public, anon, authenticated;
revoke execute on function prive.rattacher_boutique() from public, anon, authenticated;
revoke execute on function prive.proteger_profil() from public, anon, authenticated;

-- Les corps des fonctions appelaient public.ma_boutique()/public.est_admin() : on les réécrit.
create or replace function prive.article_de_ma_boutique(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from articles where id = a_id and boutique_id = prive.ma_boutique())
$$;

create or replace function prive.proteger_statut_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if prive.est_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.statut := 'en_attente';
  else
    new.statut := old.statut;
  end if;
  return new;
end $$;

create or replace function prive.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() and auth.uid() is not null then
    new.role := old.role;
    new.boutique_id := old.boutique_id;
  end if;
  return new;
end $$;

-- US-16 : un admin ou un ambassadeur crée une boutique pour un commerçant, puis l'admin rattache le compte du commerçant.

create or replace function prive.est_admin_ou_ambassadeur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils where id = auth.uid() and role in ('admin', 'ambassadeur'))
$$;

-- Création : un commerçant sans boutique crée la sienne ; admin et ambassadeur en créent pour les autres.
alter policy "commerçant crée sa boutique" on boutiques
  with check (prive.ma_boutique() is null or prive.est_admin_ou_ambassadeur());

-- Lecture : l'ambassadeur voit aussi les boutiques en attente pour suivre ses installations.
alter policy "public voit les boutiques validées" on boutiques
  using (statut = 'validee' or id = prive.ma_boutique() or prive.est_admin_ou_ambassadeur());

-- Une boutique créée par un admin ou un ambassadeur n'est pas rattachée à son propre compte.
create or replace function prive.rattacher_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not prive.est_admin_ou_ambassadeur() then
    update profils set boutique_id = new.id where id = auth.uid() and boutique_id is null;
  end if;
  return new;
end $$;

-- Rattacher le compte d'un commerçant (par son e-mail) à une boutique. Réservé aux admins.
create or replace function public.rattacher_commercant(email_commercant text, boutique uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select id into compte from auth.users where lower(email) = lower(trim(email_commercant));
  if compte is null then
    raise exception 'Aucun compte avec cette adresse : le commerçant doit d''abord se connecter une fois.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from boutiques where id = boutique) then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;
  update profils set boutique_id = boutique where id = compte;
end $$;

revoke execute on function public.rattacher_commercant(text, uuid) from public, anon;
grant execute on function public.rattacher_commercant(text, uuid) to authenticated;

-- US-27.3 : la page publique /parrainage et le bloc d'accueil ne s'affichent que si le parrainage est ouvert.
-- prive.reglages n'est pas lisible depuis l'API : cette fonction ne renvoie que l'interrupteur (vrai / faux),
-- jamais le budget ni un autre réglage.
create or replace function public.parrainage_ouvert() returns boolean
language sql stable security definer set search_path = public as $$
  select prive.parrainage_actif()
$$;
revoke execute on function public.parrainage_ouvert() from public;
grant execute on function public.parrainage_ouvert() to anon, authenticated;

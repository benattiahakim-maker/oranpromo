-- US-32.5 (suite, demande de BOLOSS du 10/10) : /admin/bons, « reste » d'un programme à budget MENSUEL (« avis ») calculé
-- sur le mois en cours (heure d'Alger), affiché « ce mois-ci ». Fonction à part, lue en plus de programmes_admin() :
-- programmes_admin (US-33.5, redéfinie par 20261020090000) n'est pas touchée, l'ordre des fichiers n'a donc pas d'effet.
-- Le reste du mois est celui qui décide de l'attribution : prive.budget_avis_restant (20261019130000).
create or replace function public.reste_mois_programmes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'restant', prive.budget_avis_restant(p)) order by p.id), '[]'::jsonb)
          from public.programmes_bons p where p.type = 'avis');
end $$;
revoke execute on function public.reste_mois_programmes() from public, anon;
grant execute on function public.reste_mois_programmes() to authenticated;

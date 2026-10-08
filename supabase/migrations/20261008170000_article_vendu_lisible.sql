-- US-02 : un lien vers un article vendu doit afficher « Article plus disponible ».
-- Le public peut donc lire un article vendu (les listes filtrent toujours disponible/réservé).
create or replace function prive.article_visible(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from articles a join boutiques b on b.id = a.boutique_id
    where a.id = a_id
      and b.statut = 'validee'
      and a.statut in ('disponible', 'reserve', 'vendu')
      and a.derniere_confirmation > now() - interval '21 days'
  )
$$;

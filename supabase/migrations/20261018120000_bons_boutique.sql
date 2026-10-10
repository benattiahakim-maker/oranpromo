-- US-33.4 : côté boutique, le bon a son nom (« Bon Aïd 2026 », « Bon de bienvenue », « Bon parrainage ») au scan,
-- dans les commandes reçues, sur le suivi du client et la page du proche ; relevé avec l'origine ; plafond par campagne.
-- Lectures seulement : aucune fonction existante ne change (remise, relevé, blocage, no-shows, numéro inchangés).

-- Bon de chaque commande demandée : {"commande", "origine", "nom_fr", "nom_ar"} (noms vides pour le parrainage et la bienvenue).
-- Seulement les commandes de la boutique du compte, ses propres commandes de client, ou toutes pour l'admin.
create or replace function public.bons_des_commandes(commandes uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('commande', c.id, 'origine', b.origine, 'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar)), '[]'::jsonb)
  from commandes c
  join bons b on b.id = c.bon_id
  left join programmes_bons p on p.id = b.programme_id
  where c.id = any (coalesce(bons_des_commandes.commandes, '{}'::uuid[]))
    and (c.boutique_id = prive.ma_boutique() or c.client_id = auth.uid() or prive.est_admin())
$$;
revoke execute on function public.bons_des_commandes(uuid[]) from public, anon;
grant execute on function public.bons_des_commandes(uuid[]) to authenticated;

-- Page du proche (/retrait/<jeton>, sans compte) : nom du bon de la commande du lien, ou null.
create or replace function public.bon_par_lien(jeton text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when bon_par_lien.jeton ~ '^[A-Za-z0-9_-]{22}$' then (
    select jsonb_build_object('origine', b.origine, 'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar)
    from prive.retraits r
    join commandes c on c.id = r.commande_id
    join bons b on b.id = c.bon_id
    left join programmes_bons p on p.id = b.programme_id
    where r.jeton = bon_par_lien.jeton and c.remise_bon > 0) end
$$;
revoke execute on function public.bon_par_lien(text) from public;
grant execute on function public.bon_par_lien(text) to anon, authenticated;

-- Relevé de la boutique : nom des programmes de ses lignes (campagnes, bienvenue), lu par programme_id.
create or replace function public.noms_programmes_releve() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'type', p.type, 'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar)), '[]'::jsonb)
  from programmes_bons p
  where exists (select 1 from lignes_releve l where l.programme_id = p.id and l.boutique_id = prive.ma_boutique())
$$;
revoke execute on function public.noms_programmes_releve() from public, anon;
grant execute on function public.noms_programmes_releve() to authenticated;

-- Plafond par campagne ouverte dans la boutique du compte : {"nom_fr", "nom_ar", "utilises", "plafond"}
-- (bons réservés ou utilisés dans la boutique, même compte que prive.raison_bon).
create or replace function public.plafonds_bons_boutique() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('nom_fr', p.nom_fr, 'nom_ar', p.nom_ar, 'plafond', p.plafond_par_boutique,
      'utilises', (select count(*) from bons x join commandes y on y.id = x.commande_id
                   where x.programme_id = p.id and x.statut in ('reserve', 'utilise') and y.boutique_id = prive.ma_boutique()))
    order by p.fin nulls last, p.cree_le), '[]'::jsonb)
  from programmes_bons p
  where prive.ma_boutique() is not null and p.type = 'campagne' and p.plafond_par_boutique is not null
    and prive.programme_ouvert(p)
$$;
revoke execute on function public.plafonds_bons_boutique() from public, anon;
grant execute on function public.plafonds_bons_boutique() to authenticated;

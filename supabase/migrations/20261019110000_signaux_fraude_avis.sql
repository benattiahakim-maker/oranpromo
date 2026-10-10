-- US-32 (suite du rapport, demande de BOLOSS du 10/10, 11 h) : signaux de fraude des avis, docs/architecture.md
-- « Avis clients sur les boutiques (US-32) ». Seuil confirmé : 3. Ce sont des SIGNAUX montrés à l'admin dans
-- /admin/moderation (onglet « Avis »), jamais une action automatique : rien n'est masqué, bloqué ni annulé.
-- signaux_avis() (US-32.4) reste en place, inchangée (l'application lit désormais signaux_fraude_avis()).
-- Fenêtres : 7 jours pour les comptes récents (conception) ; 30 jours pour les autres signaux (choix à confirmer).

create or replace function public.signaux_fraude_avis()
returns table (signal text, boutique_id uuid, boutique text, nombre integer, detail text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_admin() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  return query
  -- 1. Avis 5 étoiles des 7 derniers jours venant de comptes créés moins de 7 jours avant l'avis.
  select 'comptes_recents'::text, b.id, b.nom, count(*)::integer, null::text
  from public.avis a
  join public.boutiques b on b.id = a.boutique_id
  join public.profils p on p.id = a.client_id
  where a.statut = 'publie' and a.note = 5 and a.cree_le > now() - interval '7 days'
    and p.cree_le > a.cree_le - interval '7 days'
  group by b.id, b.nom
  having count(*) >= 3
  union all
  -- 2. Avis groupés : 3 avis ou plus sur la même boutique dans la même minute (heure d'Alger).
  select 'avis_groupes', b.id, b.nom, count(*)::integer,
         to_char(date_trunc('minute', a.cree_le at time zone 'Africa/Algiers'), 'DD/MM HH24:MI')
  from public.avis a
  join public.boutiques b on b.id = a.boutique_id
  where a.cree_le > now() - interval '30 days'
  group by b.id, b.nom, date_trunc('minute', a.cree_le at time zone 'Africa/Algiers')
  having count(*) >= 3
  union all
  -- 3. Même numéro (celui de la commande) : 3 avis ou plus, tous sur la même boutique. Numéro abrégé.
  select 'meme_numero', min(b.id::text)::uuid, min(b.nom), count(*)::integer,
         left(c.client_telephone, 4) || ' … ' || right(c.client_telephone, 2)
  from public.avis a
  join public.commandes c on c.id = a.commande_id
  join public.boutiques b on b.id = a.boutique_id
  where a.cree_le > now() - interval '30 days'
  group by c.client_telephone
  having count(*) >= 3 and count(distinct a.boutique_id) = 1
  union all
  -- 4. Retraits rapides : 3 commandes ou plus récupérées moins de 30 minutes après leur création.
  select 'retraits_rapides', b.id, b.nom, count(*)::integer, null::text
  from public.commandes c
  join public.boutiques b on b.id = c.boutique_id
  where c.statut = 'recuperee' and c.terminee_le is not null and c.terminee_le > now() - interval '30 days'
    and c.terminee_le - c.cree_le < interval '30 minutes'
  group by b.id, b.nom
  having count(*) >= 3
  order by 1, 4 desc, 3;
end $$;
revoke execute on function public.signaux_fraude_avis() from public, anon;
grant execute on function public.signaux_fraude_avis() to authenticated;

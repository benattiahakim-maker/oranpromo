-- US-20.3 : la boutique (ou un admin) fait avancer les commandes ; le stock bouge à la confirmation.
-- Transitions autorisées (toute autre est refusée) :
--   boutique / admin : demandee → confirmee (stock − quantité, jamais sous 0)
--                      confirmee → prete (le client a 24 h : expire_le = prete_le + 24 h)
--                      prete → recuperee
--                      demandee | confirmee | prete → annulee, motif plus_en_stock | boutique_indisponible | autre
--   client           : demandee | confirmee → annulee (motif client_a_annule)
-- Annuler une commande confirmée ou prête remet le stock (prive.remettre_stock).
-- « expiree » n'est donnée que par la tâche planifiée (US-20.4).

create or replace function prive.retirer_stock(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- La boutique confirme qu'elle a les articles : le stock indicatif baisse, sans passer sous 0.
  update tailles t set quantite = greatest(0, t.quantite - l.quantite)
  from lignes_commande l
  where l.commande_id = c_id and l.article_id = t.article_id and l.taille = t.libelle;
end $$;

revoke execute on function prive.retirer_stock(uuid) from public, anon, authenticated;

create or replace function public.changer_statut_commande(commande uuid, statut statut_commande, motif text default null, note text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  actuelle commandes%rowtype;
  auteur_role text;
  note_propre text := nullif(btrim(coalesce(note, '')), '');
begin
  if compte is null then
    raise exception 'Connectez-vous pour modifier une commande.' using errcode = '42501';
  end if;
  if note_propre is not null and char_length(note_propre) > 300 then
    raise exception 'La note doit faire 300 caractères au plus.' using errcode = '23514';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if prive.est_admin() then
    auteur_role := 'admin';
  elsif actuelle.boutique_id = prive.ma_boutique() then
    auteur_role := 'boutique';
  elsif actuelle.client_id = compte then
    auteur_role := 'client';
  else
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;

  if auteur_role = 'client' then
    if statut <> 'annulee' or actuelle.statut not in ('demandee', 'confirmee') then
      raise exception 'Vous pouvez annuler une commande tant qu''elle n''est pas prête.' using errcode = '23514';
    end if;
    if actuelle.statut = 'confirmee' then
      perform prive.remettre_stock(actuelle.id);
    end if;
    update commandes c set statut = 'annulee', motif_annulation = 'client_a_annule', terminee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut = 'demandee' and statut = 'confirmee' then
    perform prive.retirer_stock(actuelle.id);
    update commandes c set statut = 'confirmee', confirmee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut = 'confirmee' and statut = 'prete' then
    update commandes c set statut = 'prete', prete_le = now(), expire_le = now() + interval '24 hours' where c.id = actuelle.id;

  elsif actuelle.statut = 'prete' and statut = 'recuperee' then
    update commandes c set statut = 'recuperee', terminee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut in ('demandee', 'confirmee', 'prete') and statut = 'annulee' then
    if motif is null or motif not in ('plus_en_stock', 'boutique_indisponible', 'autre') then
      raise exception 'Choisissez le motif de l''annulation.' using errcode = '23514';
    end if;
    if actuelle.statut in ('confirmee', 'prete') then
      perform prive.remettre_stock(actuelle.id);
    end if;
    update commandes c set statut = 'annulee', motif_annulation = motif, terminee_le = now() where c.id = actuelle.id;

  else
    raise exception 'Changement de statut impossible : la commande est déjà « % ».',
      case actuelle.statut when 'demandee' then 'demandée' when 'confirmee' then 'confirmée' when 'prete' then 'prête'
        when 'recuperee' then 'récupérée' when 'annulee' then 'annulée' else 'expirée' end
      using errcode = '23514';
  end if;

  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (actuelle.id, statut, compte, auteur_role, note_propre);
end $$;

revoke execute on function public.changer_statut_commande(uuid, statut_commande, text, text) from public, anon;
grant execute on function public.changer_statut_commande(uuid, statut_commande, text, text) to authenticated;

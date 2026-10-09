-- Relecture n°4 (Claude), point 1 : restes de la relecture n°3.
-- a. Un compte DÉJÀ bloqué reste bloqué tant que ses no-shows, contestations en attente comprises, sont 5 ou plus :
--    contester ne débloque plus ; seule une décision de l'admin (annuler un no-show, débloquer) le débloque.
--    Une contestation en attente empêche toujours un NOUVEAU blocage (comme avant). Pas de nouveau message
--    « compte bloqué » : le compte ne repasse jamais par « non bloqué ».
-- b. Boutique saturée : au plus 3 commandes par heure pour un même client dans une même boutique ; dans la limite
--    de 20 commandes par heure de la boutique, on ne compte plus les commandes annulées par le client dans les
--    2 minutes qui suivent leur création.

-- ---------------------------------------------------------------------------
-- a. Blocage maintenu pendant une contestation
-- ---------------------------------------------------------------------------
-- Même compte que prive.no_shows_actifs, mais les no-shows contestés en attente comptent aussi.
create or replace function prive.no_shows_avec_contestations(client_cible uuid, telephone_cible text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from commandes c
  where c.no_show_le is not null and c.no_show_annule_le is null
    and (c.client_id = client_cible
         or (prive.blocage_par_numero() and telephone_cible is not null and c.telephone_verifie
             and c.client_telephone = telephone_cible
             and exists (select 1 from profils p where p.id = client_cible and p.telephone = telephone_cible
                         and p.telephone_verifie_le is not null)))
$$;
revoke execute on function prive.no_shows_avec_contestations(uuid, text) from public, anon, authenticated;

-- Recalcul : bloqué au 5e no-show compté, ou par l'admin (bloque_par_admin, jamais levé ici), ou déjà bloqué
-- avec 5 no-shows ou plus en comptant les contestations en attente.
create or replace function prive.recalculer_no_shows(client_cible uuid, telephone_cible text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  total integer;
  bloquer boolean;
  avant text := coalesce(current_setting('oranpromo.traitement_systeme', true), '');
begin
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for p in
    select pr.id, pr.telephone, pr.bloque, pr.bloque_par_admin from profils pr
    where pr.id = client_cible or (telephone_cible is not null and pr.telephone = telephone_cible)
    order by pr.id for update
  loop
    total := prive.no_shows_actifs(p.id, p.telephone);
    bloquer := total >= 5 or p.bloque_par_admin
      or (p.bloque and prive.no_shows_avec_contestations(p.id, p.telephone) >= 5);
    update profils pr set
      no_shows = total,
      bloque = bloquer,
      bloque_le = case when bloquer then coalesce(pr.bloque_le, now()) end
    where pr.id = p.id and (pr.no_shows is distinct from total or pr.bloque is distinct from bloquer);
  end loop;
  perform set_config('oranpromo.traitement_systeme', avant, true);
end $$;
revoke execute on function prive.recalculer_no_shows(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- b. Limites de commandes par boutique
-- ---------------------------------------------------------------------------
create or replace function prive.limiter_commandes_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('commandes-boutique:' || new.boutique_id::text, 0));
  -- Un même client : 3 commandes par heure dans une même boutique (annulées comprises).
  if (select count(*) from commandes c
      where c.boutique_id = new.boutique_id and c.client_id = new.client_id
        and c.cree_le > now() - interval '1 hour') >= 3 then
    raise exception 'Vous avez déjà passé 3 commandes dans cette boutique en une heure : réessayez plus tard.' using errcode = '54000';
  end if;
  -- Toute la boutique : 20 commandes par heure, sans compter celles que le client a annulées dans les 2 minutes.
  if (select count(*) from commandes c
      where c.boutique_id = new.boutique_id and c.cree_le > now() - interval '1 hour'
        and not (c.statut = 'annulee' and c.motif_annulation = 'client_a_annule'
                 and c.terminee_le is not null and c.terminee_le <= c.cree_le + interval '2 minutes')) >= 20 then
    raise exception 'Cette boutique a reçu trop de commandes dans la dernière heure : réessayez un peu plus tard.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function prive.limiter_commandes_boutique() from public, anon, authenticated;

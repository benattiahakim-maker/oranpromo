-- US-20 : contestation d'un no-show par le client (décision du propriétaire, point 4 de la relecture n°2).
-- Une boutique peut passer une commande « prête » tout de suite puis déclarer « Client pas venu » 24 h plus tard.
-- Le client conteste depuis /compte avec un motif court (une fois par no-show, seulement le compte de la commande).
-- Tant que la contestation est en attente, le no-show ne compte pas pour le blocage automatique (le compteur est
-- recalculé, le compte est débloqué s'il repasse sous 5) ; un blocage décidé par l'admin n'est jamais levé.
-- L'admin voit les contestations dans /admin/clients : il valide le no-show (il compte de nouveau, blocage possible)
-- ou l'annule (annuler_no_show, déjà existant). Aucun message WhatsApp (pas de nouveau modèle Meta).
-- Rien n'est modifié dans les anciennes migrations : les fonctions concernées sont remplacées ici.

-- ===========================================================================
-- Colonnes
-- ===========================================================================
alter table commandes
  add column contestee_le timestamptz,
  add column contestation_motif text,
  add column contestation_validee_le timestamptz,
  add constraint commandes_contestation_coherente check (
    (contestee_le is null and contestation_motif is null and contestation_validee_le is null)
    or (contestee_le is not null and no_show_le is not null and contestation_motif is not null
        and char_length(contestation_motif) between 5 and 300)
  );
create index commandes_contestations_en_attente_idx on commandes (contestee_le)
  where contestee_le is not null and contestation_validee_le is null and no_show_annule_le is null;

-- Blocage décidé par l'admin : marqué explicitement (avant : déduit de « bloqué avec moins de 5 no-shows », ce qui
-- ne suffisait plus quand une contestation fait baisser le compteur d'un compte bloqué à la main avec 5 no-shows).
alter table profils add column bloque_par_admin boolean not null default false;
update profils set bloque_par_admin = true where bloque and no_shows < 5;

-- Le client ne modifie jamais bloque_par_admin (même règle que no_shows et bloque).
create or replace function prive.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nom is distinct from old.nom and new.nom is not null then
    new.nom := regexp_replace(btrim(new.nom), ' {2,}', ' ', 'g');
    if not prive.nom_valide(new.nom) then
      raise exception 'Nom invalide : lettres, espaces, apostrophe et tiret seulement (2 à 60 caractères, sans chiffres).' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is null or prive.est_admin() or current_setting('oranpromo.traitement_systeme', true) = 'on' then
    return new; -- service, admin ou traitement système
  end if;
  new.role := old.role;
  new.boutique_id := old.boutique_id;
  new.no_shows := old.no_shows;
  new.bloque := old.bloque;
  new.bloque_le := old.bloque_le;
  new.bloque_par_admin := old.bloque_par_admin;
  if new.telephone is distinct from old.telephone then
    if old.bloque then
      raise exception 'Votre compte est bloqué : vous ne pouvez pas changer de numéro. Contactez OranPromo.' using errcode = '42501';
    end if;
    if new.telephone is not null and new.telephone !~ '^\+213[1-9][0-9]{8}$' then
      raise exception 'Numéro de téléphone invalide : format attendu +213XXXXXXXXX.' using errcode = '23514';
    end if;
    new.no_shows := prive.no_shows_actifs(new.id, new.telephone);
    new.bloque := old.bloque_par_admin or new.no_shows >= 5;
    new.bloque_le := case when new.bloque then coalesce(old.bloque_le, now()) end;
  end if;
  return new;
end $$;

-- ===========================================================================
-- Compteur : un no-show contesté en attente ne compte pas.
-- ===========================================================================
create or replace function prive.no_shows_actifs(client_cible uuid, telephone_cible text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from commandes c
  where c.no_show_le is not null and c.no_show_annule_le is null
    and (c.contestee_le is null or c.contestation_validee_le is not null)
    and (c.client_id = client_cible
         or (prive.blocage_par_numero() and telephone_cible is not null and c.client_telephone = telephone_cible))
$$;
revoke execute on function prive.no_shows_actifs(uuid, text) from public, anon, authenticated;

-- Recalcul : bloqué au 5e no-show compté, ou par l'admin (bloque_par_admin, jamais levé ici).
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
    select pr.id, pr.telephone, pr.bloque_par_admin from profils pr
    where pr.id = client_cible or (telephone_cible is not null and pr.telephone = telephone_cible)
    order by pr.id for update
  loop
    total := prive.no_shows_actifs(p.id, p.telephone);
    bloquer := total >= 5 or p.bloque_par_admin;
    update profils pr set
      no_shows = total,
      bloque = bloquer,
      bloque_le = case when bloquer then coalesce(pr.bloque_le, now()) end
    where pr.id = p.id and (pr.no_shows is distinct from total or pr.bloque is distinct from bloquer);
  end loop;
  perform set_config('oranpromo.traitement_systeme', avant, true);
end $$;
revoke execute on function prive.recalculer_no_shows(uuid, text) from public, anon, authenticated;

-- Message « bloqué après 5 commandes non récupérées » : seulement pour un blocage automatique.
create or replace function prive.message_compte_bloque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bloque_par_admin or new.no_shows < 5 then
    return new;
  end if;
  perform prive.ajouter_message_whatsapp(new.telephone, 'oranpromo_compte_bloque',
    'Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo.',
    array[case when prive.nom_valide(new.nom) then new.nom else 'cher client' end], null);
  return new;
end $$;

-- Blocage par l'admin : marqué bloque_par_admin.
create or replace function public.bloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from profils p where p.id = client) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  update profils p set bloque = true, bloque_par_admin = true, bloque_le = coalesce(p.bloque_le, now())
  where p.id = client and not (p.bloque and p.bloque_par_admin);
end $$;
revoke execute on function public.bloquer_client(uuid) from public, anon;
grant execute on function public.bloquer_client(uuid) to authenticated;

-- Déblocage par l'admin : lève aussi le blocage manuel (no-shows du compte annulés, comme avant).
create or replace function public.debloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  numero_client text;
  annulee record;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select p.telephone into numero_client from profils p where p.id = client;
  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  update profils p set bloque_par_admin = false where p.id = client and p.bloque_par_admin;
  for annulee in
    update commandes c set no_show_annule_le = now()
    where c.no_show_le is not null and c.no_show_annule_le is null
      and (c.client_id = client
           or (prive.blocage_par_numero() and numero_client is not null and c.client_telephone = numero_client))
    returning c.client_id, c.client_telephone
  loop
    perform prive.recalculer_no_shows(annulee.client_id, annulee.client_telephone);
  end loop;
  perform prive.recalculer_no_shows(client, numero_client);
  update profils p set no_shows = 0, bloque = false, bloque_le = null where p.id = client and (p.no_shows <> 0 or p.bloque);
end $$;
revoke execute on function public.debloquer_client(uuid) from public, anon;
grant execute on function public.debloquer_client(uuid) to authenticated;

-- ===========================================================================
-- Contester (client), valider (admin). Annuler : public.annuler_no_show (inchangé).
-- ===========================================================================
create or replace function public.contester_no_show(commande uuid, motif text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  actuelle commandes%rowtype;
  motif_propre text := regexp_replace(btrim(coalesce(motif, '')), '\s+', ' ', 'g');
begin
  if compte is null then
    raise exception 'Connectez-vous pour contester.' using errcode = '42501';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found or actuelle.client_id is distinct from compte then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if actuelle.no_show_le is null or actuelle.no_show_annule_le is not null then
    raise exception 'Aucun no-show à contester sur cette commande.' using errcode = 'P0002';
  end if;
  if actuelle.contestee_le is not null then
    raise exception 'Vous avez déjà contesté ce no-show.' using errcode = '23514';
  end if;
  if char_length(motif_propre) not between 5 and 300 then
    raise exception 'Expliquez en quelques mots pourquoi vous contestez (5 à 300 caractères).' using errcode = '23514';
  end if;
  update commandes c set contestee_le = now(), contestation_motif = motif_propre where c.id = actuelle.id;
  perform prive.recalculer_no_shows(actuelle.client_id, actuelle.client_telephone);
end $$;
revoke execute on function public.contester_no_show(uuid, text) from public, anon;
grant execute on function public.contester_no_show(uuid, text) to authenticated;

-- L'admin confirme le no-show contesté : il compte de nouveau (blocage au 5e possible).
create or replace function public.valider_no_show(commande uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  actuelle commandes%rowtype;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found or actuelle.contestee_le is null or actuelle.contestation_validee_le is not null
     or actuelle.no_show_annule_le is not null then
    raise exception 'Aucune contestation en attente sur cette commande.' using errcode = 'P0002';
  end if;
  update commandes c set contestation_validee_le = now() where c.id = actuelle.id;
  perform prive.recalculer_no_shows(actuelle.client_id, actuelle.client_telephone);
end $$;
revoke execute on function public.valider_no_show(uuid) from public, anon;
grant execute on function public.valider_no_show(uuid) to authenticated;

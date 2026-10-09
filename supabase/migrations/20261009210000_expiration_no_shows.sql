-- US-20.4 : expiration des commandes prêtes non récupérées, no-shows et blocage.
-- Une commande « prete » dont expire_le (prete_le + 24 h) est passé devient « expiree » :
-- le stock revient, le client prend 1 no-show, et son compte est bloqué au 5e.
-- Lancée toutes les 15 minutes par pg_cron (voir la fin du fichier). Seul l'admin débloque.

-- ---------------------------------------------------------------------------
-- 1. Expiration (service uniquement : tâche planifiée, jamais appelée par l'API).
-- ---------------------------------------------------------------------------
create or replace function prive.expirer_commandes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  expiree record;
  nombre integer := 0;
begin
  -- Marque la transaction comme traitement système : prive.proteger_profil laisse passer no_shows et bloque
  -- même si une session utilisateur est présente (la tâche pg_cron n'en a pas).
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for expiree in
    select c.id, c.client_id from commandes c
    where c.statut = 'prete' and c.expire_le <= now()
    order by c.expire_le
    for update skip locked
  loop
    perform prive.remettre_stock(expiree.id);
    update commandes c set statut = 'expiree', terminee_le = now() where c.id = expiree.id;
    insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
    values (expiree.id, 'expiree', null, 'systeme', 'Non récupérée dans les 24 heures.');
    -- Les expressions de droite lisent les valeurs d'avant la mise à jour.
    update profils p set
      no_shows = p.no_shows + 1,
      bloque = p.bloque or p.no_shows + 1 >= 5,
      bloque_le = case when not p.bloque and p.no_shows + 1 >= 5 then now() else p.bloque_le end
    where p.id = expiree.client_id;
    nombre := nombre + 1;
  end loop;
  return nombre;
end $$;

revoke execute on function prive.expirer_commandes() from public, anon, authenticated;

-- Le profil reste protégé contre le client ; seul le traitement système (ci-dessus), le service et l'admin
-- changent no_shows et bloque.
create or replace function prive.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or prive.est_admin() or current_setting('oranpromo.traitement_systeme', true) = 'on' then
    return new;
  end if;
  new.role := old.role;
  new.boutique_id := old.boutique_id;
  new.no_shows := old.no_shows;
  new.bloque := old.bloque;
  new.bloque_le := old.bloque_le;
  if new.nom is distinct from old.nom and new.nom is not null then
    new.nom := btrim(new.nom);
  end if;
  if new.telephone is distinct from old.telephone and new.telephone is not null
     and new.telephone !~ '^\+213[1-9][0-9]{8}$' then
    raise exception 'Numéro de téléphone invalide : format attendu +213XXXXXXXXX.' using errcode = '23514';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Déblocage par un admin : le compteur repart de 0.
-- ---------------------------------------------------------------------------
create or replace function public.debloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  update profils p set bloque = false, bloque_le = null, no_shows = 0 where p.id = client;
  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.debloquer_client(uuid) from public, anon;
grant execute on function public.debloquer_client(uuid) to authenticated;

create index profils_surveillance_idx on profils (bloque, no_shows) where bloque or no_shows > 0;

-- ---------------------------------------------------------------------------
-- 3. Tâche planifiée : toutes les 15 minutes avec pg_cron.
--    Sur Supabase, pg_cron est disponible (Database > Extensions). Si l'extension ne peut pas être
--    activée ici, la migration passe quand même avec un avertissement : activer pg_cron puis exécuter
--      select cron.schedule('expirer-commandes', '*/15 * * * *', 'select prive.expirer_commandes()');
--    Vérifier : select jobname, schedule, command from cron.job;
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise warning 'pg_cron indisponible : les commandes prêtes n''expireront pas automatiquement (voir la migration 20261009210000).';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('expirer-commandes', '*/15 * * * *', 'select prive.expirer_commandes()');
exception when others then
  raise warning 'Tâche planifiée non créée (%) : activer pg_cron puis lancer cron.schedule (voir la migration 20261009210000).', sqlerrm;
end $$;

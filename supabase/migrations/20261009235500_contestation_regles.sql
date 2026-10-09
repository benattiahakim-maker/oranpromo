-- US-20 : règles de la contestation d'un no-show (décisions du propriétaire).
-- 1. Contestation possible seulement dans les 7 jours qui suivent la déclaration du no-show.
-- 2. Une seule contestation en attente à la fois par compte.
-- 3. Le motif n'est lisible que par l'admin et par le client qui l'a écrit, jamais par la boutique : il quitte la table
--    commandes (que la boutique lit en entier) pour la table contestations (RLS). Les motifs existants y sont copiés.
--    commandes garde contestee_le et contestation_validee_le (état de la contestation, sans le motif).
-- Rien n'est modifié dans les anciennes migrations : les fonctions concernées sont remplacées ici.

-- ===========================================================================
-- Point 3 : table contestations (motif), lecture client (le sien) et admin seulement.
-- ===========================================================================
create table contestations (
  commande_id uuid primary key references commandes (id) on delete cascade,
  client_id uuid not null references profils (id) on delete cascade,
  motif text not null check (char_length(motif) between 5 and 300),
  cree_le timestamptz not null default now()
);
create index contestations_client_idx on contestations (client_id);
alter table contestations enable row level security;
revoke insert, update, delete, truncate on contestations from public, anon, authenticated;
grant select on contestations to authenticated;
create policy "le client ou l'admin lit la contestation" on contestations for select to authenticated
  using (client_id = auth.uid() or prive.est_admin());

insert into contestations (commande_id, client_id, motif, cree_le)
select c.id, c.client_id, c.contestation_motif, c.contestee_le
from commandes c
where c.contestee_le is not null and c.contestation_motif is not null;

alter table commandes drop constraint commandes_contestation_coherente;
alter table commandes drop column contestation_motif;
alter table commandes add constraint commandes_contestation_coherente check (
  (contestee_le is null and contestation_validee_le is null)
  or (contestee_le is not null and no_show_le is not null)
);

-- ===========================================================================
-- Points 1 et 2 : contester.
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
  -- Une contestation à la fois par compte : deux envois simultanés ne passent pas tous les deux.
  perform pg_advisory_xact_lock(hashtextextended('contestation:' || compte::text, 0));
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
  if actuelle.no_show_le < now() - interval '7 days' then
    raise exception 'Le délai pour contester est dépassé : un no-show se conteste dans les 7 jours.' using errcode = '23514';
  end if;
  if exists (select 1 from commandes c
             where c.client_id = compte and c.id <> actuelle.id and c.contestee_le is not null
               and c.contestation_validee_le is null and c.no_show_annule_le is null) then
    raise exception 'Vous avez déjà une contestation en attente : attendez la réponse d''OranPromo avant d''en envoyer une autre.' using errcode = '23514';
  end if;
  if char_length(motif_propre) not between 5 and 300 then
    raise exception 'Expliquez en quelques mots pourquoi vous contestez (5 à 300 caractères).' using errcode = '23514';
  end if;
  update commandes c set contestee_le = now() where c.id = actuelle.id;
  insert into contestations (commande_id, client_id, motif) values (actuelle.id, compte, motif_propre);
  perform prive.recalculer_no_shows(actuelle.client_id, actuelle.client_telephone);
end $$;
revoke execute on function public.contester_no_show(uuid, text) from public, anon;
grant execute on function public.contester_no_show(uuid, text) to authenticated;

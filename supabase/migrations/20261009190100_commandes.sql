-- US-20.2 : comptes clients, commandes, lignes et suivi (frise).
-- Aucune écriture directe dans les tables de commande : tout passe par passer_commande() et
-- changer_statut_commande() (security definer), qui vérifient les droits et les règles.
-- Convention des migrations précédentes : auth.uid() null = service (clé secrète, migrations, tâches planifiées).

-- ---------------------------------------------------------------------------
-- 1. Profils : rôle client par défaut, nom, no-shows et blocage.
-- ---------------------------------------------------------------------------
alter table profils alter column role set default 'client';
alter table profils
  add column nom text check (nom is null or char_length(nom) between 2 and 80),
  add column no_shows integer not null default 0 check (no_shows >= 0),
  add column bloque boolean not null default false,
  add column bloque_le timestamptz;

-- Le client modifie son nom et son téléphone ; jamais son rôle, sa boutique, ses no-shows ni son blocage.
create or replace function prive.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or prive.est_admin() then
    return new; -- service ou admin
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

-- Rattacher un compte client à une boutique en fait un commerçant (US-16).
create or replace function public.rattacher_commercant(email_commercant text, boutique uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select id into compte from auth.users where lower(email) = lower(trim(email_commercant));
  if compte is null then
    raise exception 'Aucun compte avec cette adresse : le commerçant doit d''abord se connecter une fois.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from boutiques where id = boutique) then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;
  update profils set boutique_id = boutique, role = case when role = 'client' then 'commercant'::role_utilisateur else role end
  where id = compte;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create type statut_commande as enum ('demandee', 'confirmee', 'prete', 'recuperee', 'annulee', 'expiree');

create table commandes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  client_id uuid not null references profils (id) on delete cascade,
  boutique_id uuid not null references boutiques (id) on delete cascade,
  statut statut_commande not null default 'demandee',
  client_nom text not null,
  client_telephone text not null,
  note text check (note is null or char_length(note) <= 300),
  motif_annulation text check (motif_annulation in ('plus_en_stock', 'boutique_indisponible', 'client_a_annule', 'autre')),
  total integer not null default 0 check (total >= 0),
  cree_le timestamptz not null default now(),
  confirmee_le timestamptz,
  prete_le timestamptz,
  expire_le timestamptz,
  terminee_le timestamptz
);
create index commandes_client_idx on commandes (client_id, cree_le desc);
create index commandes_boutique_idx on commandes (boutique_id, cree_le desc);
create index commandes_expiration_idx on commandes (expire_le) where statut = 'prete';

create table lignes_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes (id) on delete cascade,
  article_id uuid references articles (id) on delete set null,
  titre text not null,
  taille text not null,
  quantite integer not null check (quantite between 1 and 10),
  prix_unitaire integer not null check (prix_unitaire > 0)
);
create index lignes_commande_commande_idx on lignes_commande (commande_id);

create table suivi_commandes (
  id bigint generated always as identity primary key,
  commande_id uuid not null references commandes (id) on delete cascade,
  statut statut_commande not null,
  date timestamptz not null default now(),
  auteur_id uuid references profils (id) on delete set null,
  auteur text not null check (auteur in ('client', 'boutique', 'admin', 'systeme')),
  note text check (note is null or char_length(note) <= 300)
);
create index suivi_commandes_commande_idx on suivi_commandes (commande_id, date);

-- ---------------------------------------------------------------------------
-- 3. Droits : lecture par le client, la boutique ou l'admin ; aucune écriture directe.
-- ---------------------------------------------------------------------------
alter table commandes enable row level security;
alter table lignes_commande enable row level security;
alter table suivi_commandes enable row level security;
revoke insert, update, delete, truncate on commandes, lignes_commande, suivi_commandes from anon, authenticated;

create or replace function prive.commande_visible(c_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from commandes c
    where c.id = c_id and (c.client_id = auth.uid() or c.boutique_id = prive.ma_boutique() or prive.est_admin())
  )
$$;

create policy "client, boutique ou admin lit la commande" on commandes for select to authenticated
  using (client_id = auth.uid() or boutique_id = prive.ma_boutique() or prive.est_admin());
create policy "lecture des lignes de commande" on lignes_commande for select to authenticated
  using (prive.commande_visible(commande_id));
create policy "lecture du suivi de commande" on suivi_commandes for select to authenticated
  using (prive.commande_visible(commande_id));

-- ---------------------------------------------------------------------------
-- 4. Passer une commande (client connecté).
--    lignes = [{"article_id": "...", "taille": "M", "quantite": 2}, ...]
--    Les prix sont recalculés ici (prix promo si la promo est active) ; le stock ne bouge pas.
-- ---------------------------------------------------------------------------
create or replace function public.passer_commande(boutique uuid, lignes jsonb, note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  profil profils%rowtype;
  nouvelle uuid;
  ligne jsonb;
  article_ligne articles%rowtype;
  id_article uuid;
  taille_ligne text;
  quantite_ligne integer;
  stock integer;
  prix integer;
  montant integer := 0;
  deja text[] := '{}';
  note_propre text := nullif(btrim(coalesce(note, '')), '');
begin
  if compte is null then
    raise exception 'Connectez-vous pour commander.' using errcode = '42501';
  end if;
  select * into profil from profils p where p.id = compte;
  if not found then
    raise exception 'Profil introuvable : reconnectez-vous.' using errcode = '42501';
  end if;
  if profil.bloque then
    raise exception 'Votre compte est bloqué après 5 commandes non récupérées : contactez OranPromo pour le débloquer.' using errcode = '42501';
  end if;
  if profil.nom is null or profil.telephone is null or profil.telephone !~ '^\+213[1-9][0-9]{8}$' then
    raise exception 'Renseignez votre nom et votre numéro de téléphone avant de commander.' using errcode = '23514';
  end if;
  if profil.boutique_id is not distinct from boutique then
    raise exception 'Vous ne pouvez pas commander dans votre propre boutique.' using errcode = '42501';
  end if;
  if not exists (select 1 from boutiques b where b.id = boutique and b.statut = 'validee') then
    raise exception 'Cette boutique ne prend pas de commande pour le moment.' using errcode = 'P0002';
  end if;
  if note_propre is not null and char_length(note_propre) > 300 then
    raise exception 'La note pour la boutique doit faire 300 caractères au plus.' using errcode = '23514';
  end if;
  if lignes is null or jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) not between 1 and 10 then
    raise exception 'Une commande contient de 1 à 10 lignes.' using errcode = '23514';
  end if;

  -- Une commande à la fois par client : les limites ne se contournent pas par des envois simultanés.
  perform pg_advisory_xact_lock(hashtextextended('commandes:' || compte::text, 0));
  if (select count(*) from commandes c where c.client_id = compte and c.statut in ('demandee', 'confirmee', 'prete')) >= 5 then
    raise exception 'Vous avez déjà 5 commandes en cours : attendez qu''elles soient terminées.' using errcode = '54000';
  end if;
  if (select count(*) from commandes c where c.client_id = compte and c.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de commandes en une heure : réessayez plus tard.' using errcode = '54000';
  end if;

  insert into commandes (client_id, boutique_id, client_nom, client_telephone, note)
  values (compte, boutique, profil.nom, profil.telephone, note_propre)
  returning id into nouvelle;

  for ligne in select value from jsonb_array_elements(lignes) loop
    if jsonb_typeof(ligne) <> 'object' or jsonb_typeof(ligne -> 'quantite') <> 'number'
       or jsonb_typeof(ligne -> 'taille') <> 'string' or jsonb_typeof(ligne -> 'article_id') <> 'string'
       or (ligne ->> 'article_id') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'Une ligne du panier est invalide : videz le panier et réessayez.' using errcode = '22023';
    end if;
    id_article := (ligne ->> 'article_id')::uuid;
    taille_ligne := ligne ->> 'taille';
    if (ligne ->> 'quantite') !~ '^[0-9]+$' or (ligne ->> 'quantite')::numeric not between 1 and 10 then
      raise exception 'La quantité doit être comprise entre 1 et 10.' using errcode = '23514';
    end if;
    quantite_ligne := (ligne ->> 'quantite')::integer;

    select * into article_ligne from articles a where a.id = id_article;
    if not found or article_ligne.boutique_id <> boutique or article_ligne.statut not in ('disponible', 'reserve')
       or not prive.article_visible(id_article) then
      raise exception 'Un article du panier n''est plus disponible : retirez-le et réessayez.' using errcode = 'P0002';
    end if;
    if (id_article::text || '|' || taille_ligne) = any (deja) then
      raise exception 'Le même article et la même taille apparaissent deux fois dans le panier.' using errcode = '23514';
    end if;
    deja := deja || (id_article::text || '|' || taille_ligne);

    select t.quantite into stock from tailles t where t.article_id = id_article and t.libelle = taille_ligne;
    if not found then
      raise exception 'La taille % de « % » n''existe plus : retirez-la du panier.', taille_ligne, article_ligne.titre using errcode = 'P0002';
    end if;
    if stock < quantite_ligne then
      raise exception 'Il ne reste que % pièce(s) en taille % pour « % ».', stock, taille_ligne, article_ligne.titre using errcode = '23514';
    end if;

    prix := article_ligne.prix;
    select p.prix_promo into prix from promos p where p.article_id = id_article and p.date_fin >= now();
    if not found then
      prix := article_ligne.prix;
    end if;

    insert into lignes_commande (commande_id, article_id, titre, taille, quantite, prix_unitaire)
    values (nouvelle, id_article, article_ligne.titre, taille_ligne, quantite_ligne, prix);
    montant := montant + prix * quantite_ligne;
  end loop;

  update commandes c set total = montant where c.id = nouvelle;
  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (nouvelle, 'demandee', compte, 'client', note_propre);
  return nouvelle;
end $$;

revoke execute on function public.passer_commande(uuid, jsonb, text) from public, anon;
grant execute on function public.passer_commande(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Remettre le stock d'une commande (annulation d'une commande confirmée ou prête, expiration).
--    Une ligne dont l'article ou la taille a disparu est ignorée.
-- ---------------------------------------------------------------------------
create or replace function prive.remettre_stock(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update tailles t set quantite = least(999, t.quantite + l.quantite)
  from lignes_commande l
  where l.commande_id = c_id and l.article_id = t.article_id and l.taille = t.libelle;
end $$;

revoke execute on function prive.remettre_stock(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Changer le statut d'une commande. Cette version ne gère que l'annulation par le client
--    (`demandee` ou `confirmee` → `annulee`, motif client_a_annule) ; la boutique arrive avec US-20.3.
-- ---------------------------------------------------------------------------
create or replace function public.changer_statut_commande(commande uuid, statut statut_commande, motif text default null, note text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  actuelle commandes%rowtype;
  note_propre text := nullif(btrim(coalesce(note, '')), '');
begin
  if compte is null then
    raise exception 'Connectez-vous pour modifier une commande.' using errcode = '42501';
  end if;
  if note_propre is not null and char_length(note_propre) > 300 then
    raise exception 'La note doit faire 300 caractères au plus.' using errcode = '23514';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found or actuelle.client_id <> compte then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if statut <> 'annulee' or actuelle.statut not in ('demandee', 'confirmee') then
    raise exception 'Vous pouvez annuler une commande tant qu''elle n''est pas prête.' using errcode = '23514';
  end if;
  if actuelle.statut = 'confirmee' then
    perform prive.remettre_stock(actuelle.id);
  end if;
  update commandes c set statut = 'annulee', motif_annulation = 'client_a_annule', terminee_le = now() where c.id = actuelle.id;
  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (actuelle.id, 'annulee', compte, 'client', note_propre);
end $$;

revoke execute on function public.changer_statut_commande(uuid, statut_commande, text, text) from public, anon;
grant execute on function public.changer_statut_commande(uuid, statut_commande, text, text) to authenticated;

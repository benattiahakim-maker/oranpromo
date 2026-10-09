-- US-27.1 : parrainage et bons de 300 DA dans la base (aucun écran).
-- Voir docs/architecture.md, « Parrainage (US-27) », et docs/user-stories.md, module 14 (décisions du propriétaire du 9/10).
-- Ce qui ne change pas : passer_commande, changer_statut_commande, proteger_profil, les règles de blocage, de no-show,
-- de contestation et de vérification du numéro. Le parrainage lit le numéro vérifié (US-21) et commandes.mode_remise
-- (US-26) ; le bon est posé par une fonction à part (utiliser_bon) et suit la commande par un déclencheur.
-- Seules modifications de l'existant : retrait_par_lien et prive.resume_retrait renvoient aussi « remise_bon ».
-- Interrupteur « parrainage » désactivé (absent) ; budget mensuel de départ : 30 000 DA (décision du propriétaire).

-- ---------------------------------------------------------------------------
-- 1. Colonnes ajoutées
-- ---------------------------------------------------------------------------
alter table profils
  add column code_parrainage text unique check (code_parrainage ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
  add column parrainage_exclu boolean not null default false;
comment on column profils.code_parrainage is 'US-27 : code de parrainage (6 caractères sans 0/O, 1/I/L), créé par mon_code_parrainage().';
comment on column profils.parrainage_exclu is 'US-27 : exclu du parrainage par l''admin (ne touche ni bloque ni les no-shows).';

alter table boutiques add column bons_acceptes boolean not null default true;
comment on column boutiques.bons_acceptes is 'US-27 : faux = l''admin a retiré la boutique des bons (aucun nouveau bon sur ses commandes).';

-- Le client et le commerçant ne changent jamais ces colonnes en direct (seulement par les fonctions de la base).
create or replace function prive.proteger_colonnes_parrainage() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_table_name = 'profils' then
      new.code_parrainage := old.code_parrainage;
      new.parrainage_exclu := old.parrainage_exclu;
    elsif tg_op = 'INSERT' then
      new.bons_acceptes := true;
    else
      new.bons_acceptes := old.bons_acceptes;
    end if;
  end if;
  return new;
end $$;
revoke execute on function prive.proteger_colonnes_parrainage() from public, anon, authenticated;
create trigger profil_parrainage_protege before update on profils
  for each row execute function prive.proteger_colonnes_parrainage();
create trigger boutique_bons_proteges before insert or update on boutiques
  for each row execute function prive.proteger_colonnes_parrainage();

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table parrainages (
  filleul_id uuid primary key references profils(id) on delete cascade,
  parrain_id uuid references profils(id) on delete set null, -- vide : saisie sans parrain possible (invisible pour le client)
  saisies smallint not null default 1 check (saisies between 1 and 3),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'valide', 'plafond', 'en_file', 'non_valide', 'expire', 'refuse', 'annule')),
  commande_id uuid references commandes(id) on delete set null,
  boutique_id uuid references boutiques(id) on delete set null,
  valide_le timestamptz,
  motif text check (motif is null or char_length(motif) <= 300)
);
create index parrainages_parrain_idx on parrainages (parrain_id, valide_le);
comment on table parrainages is 'US-27 : un parrainage par filleul. Aucun numéro. Lecture : admin ; écriture : fonctions.';

-- Anti-recyclage : empreinte du numéro vérifié de chaque filleul qui a eu un parrain (gardée si le compte disparaît).
create table prive.numeros_parraines (
  empreinte text primary key,
  filleul_id uuid,
  cree_le timestamptz not null default now()
);
alter table prive.numeros_parraines enable row level security;
revoke all on prive.numeros_parraines from public, anon, authenticated;

create table bons (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references profils(id) on delete cascade,
  montant integer not null default 300 check (montant > 0),
  origine text not null check (origine in ('parrainage_filleul', 'parrainage_parrain')),
  parrainage_id uuid references parrainages(filleul_id) on delete set null,
  statut text not null default 'disponible'
    check (statut in ('en_file', 'disponible', 'reserve', 'utilise', 'expire', 'annule')),
  cree_le timestamptz not null default now(), -- émission (pour un bon en file : date de sa mise en file, remplacée à l'émission)
  expire_le timestamptz,
  commande_id uuid references commandes(id) on delete set null,
  utilise_le timestamptz,
  releve_id uuid,
  constraint bons_echeance check ((statut = 'en_file') = (expire_le is null)),
  constraint bons_commande check (statut not in ('reserve', 'utilise') or commande_id is not null),
  unique (parrainage_id, origine)
);
create index bons_profil_idx on bons (profil_id, statut);
create index bons_file_idx on bons (statut, cree_le);
comment on table bons is 'US-27 : bons de 300 DA. Le client lit les siens ; écriture : fonctions seulement.';

alter table commandes
  add column bon_id uuid references bons(id) on delete set null,
  add column remise_bon integer not null default 0 check (remise_bon >= 0);
alter table commandes add constraint commandes_remise_bon_total check (remise_bon <= total or remise_bon = 0);
comment on column commandes.remise_bon is 'US-27 : bon déduit en caisse (0 ou 300). total ne change pas ; à encaisser = total − remise_bon.';

create table releves_bons (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id) on delete restrict,
  mois date not null check (extract(day from mois) = 1),
  nombre integer not null default 0 check (nombre >= 0),
  montant integer not null default 0 check (montant >= 0),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'a_payer', 'paye')),
  cree_le timestamptz not null default now(),
  cloture_le timestamptz,
  paye_le date,
  reference_paiement text,
  paye_par uuid references profils(id) on delete set null,
  unique (boutique_id, mois),
  constraint releves_paye_complet check (statut <> 'paye' or (paye_le is not null and reference_paiement is not null))
);
comment on table releves_bons is 'US-27 : relevé mensuel des bons à rembourser à une boutique (mois heure d''Alger). Payé = figé.';

create table lignes_releve (
  id uuid primary key default gen_random_uuid(),
  releve_id uuid not null references releves_bons(id) on delete restrict,
  bon_id uuid unique references bons(id) on delete set null,
  commande_id uuid references commandes(id) on delete set null,
  boutique_id uuid not null references boutiques(id) on delete restrict,
  montant integer not null check (montant > 0),
  remise_le timestamptz not null,
  mode_remise text not null check (mode_remise in ('qr', 'code')),
  numero_commande bigint not null,
  total_commande integer not null,
  client text not null, -- prénom + initiale, jamais le téléphone
  statut text not null default 'a_rembourser' check (statut in ('a_rembourser', 'de_cote', 'refuse')),
  motif text check (motif is null or char_length(motif) <= 300)
);
create index lignes_releve_releve_idx on lignes_releve (releve_id);
alter table bons add constraint bons_releve_fkey foreign key (releve_id) references releves_bons(id) on delete set null;

alter table parrainages enable row level security;
alter table bons enable row level security;
alter table releves_bons enable row level security;
alter table lignes_releve enable row level security;
revoke insert, update, delete, truncate on parrainages, bons, releves_bons, lignes_releve from public, anon, authenticated;
revoke all on parrainages, bons, releves_bons, lignes_releve from anon;
create policy "admin lit les parrainages" on parrainages for select to authenticated using (prive.est_admin());
create policy "client lit ses bons" on bons for select to authenticated using (profil_id = auth.uid() or prive.est_admin());
create policy "boutique lit ses relevés" on releves_bons for select to authenticated
  using (boutique_id = prive.ma_boutique() or prive.est_admin());
create policy "boutique lit ses lignes de relevé" on lignes_releve for select to authenticated
  using (boutique_id = prive.ma_boutique() or prive.est_admin());

-- Relevé payé : plus rien ne change (ni le relevé, ni ses lignes à rembourser).
create or replace function prive.figer_releve_paye() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'releves_bons' then
    if old.statut = 'paye' then
      raise exception 'Ce relevé est payé : il n''est plus modifiable.' using errcode = '42501';
    end if;
  elsif old.statut = 'a_rembourser' and (select r.statut from releves_bons r where r.id = old.releve_id) = 'paye' then
    raise exception 'Ce relevé est payé : il n''est plus modifiable.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function prive.figer_releve_paye() from public, anon, authenticated;
create trigger releve_paye_fige before update or delete on releves_bons
  for each row execute function prive.figer_releve_paye();
create trigger ligne_releve_payee_figee before update or delete on lignes_releve
  for each row execute function prive.figer_releve_paye();

-- Réglages : budget mensuel de départ 30 000 DA ; l'interrupteur « parrainage » reste absent (désactivé).
insert into prive.reglages (cle, valeur) values ('parrainage_budget_mois', '30000') on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Outils
-- ---------------------------------------------------------------------------
create or replace function prive.mois_alger(moment timestamptz default now()) returns date
language sql stable set search_path = '' as $$
  select date_trunc('month', moment at time zone 'Africa/Algiers')::date
$$;

create or replace function prive.parrainage_actif() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.valeur = 'on' from prive.reglages r where r.cle = 'parrainage'), false)
$$;

create or replace function prive.budget_parrainage_mois() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when r.valeur ~ '^[0-9]{1,8}$' then r.valeur::integer end
                   from prive.reglages r where r.cle = 'parrainage_budget_mois'), 0)
$$;

-- Prénom + initiale : « Samir Benali » → « Samir B. »
create or replace function prive.prenom_initiale(nom text) returns text
language sql immutable set search_path = '' as $$
  select case
    when nom is null or btrim(nom) = '' then 'Client'
    when split_part(btrim(nom), ' ', 2) = '' then split_part(btrim(nom), ' ', 1)
    else split_part(btrim(nom), ' ', 1) || ' ' || upper(left(split_part(regexp_replace(btrim(nom), ' +', ' ', 'g'), ' ', 2), 1)) || '.'
  end
$$;

create or replace function prive.empreinte_numero(numero text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(numero, 'sha256'), 'hex')
$$;

-- Parrain possible : client, numéro vérifié, non bloqué, non exclu.
create or replace function prive.peut_parrainer(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils p where p.id = p_id and p.role = 'client'
                 and p.telephone_verifie_le is not null and not p.bloque and not p.parrainage_exclu)
$$;

-- Montant des bons émis un mois donné (hors en file et annulés) : c'est ce que le budget plafonne.
create or replace function prive.bons_emis(mois date) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(b.montant), 0)::integer from bons b
  where b.statut not in ('en_file', 'annule') and prive.mois_alger(b.cree_le) = mois
$$;

create or replace function prive.budget_restant(mois date default null) returns integer
language sql stable security definer set search_path = public as $$
  select prive.budget_parrainage_mois() - prive.bons_emis(coalesce(mois, prive.mois_alger()))
$$;

do $$
declare f text;
begin
  foreach f in array array['prive.mois_alger(timestamptz)', 'prive.parrainage_actif()', 'prive.budget_parrainage_mois()',
    'prive.prenom_initiale(text)', 'prive.empreinte_numero(text)', 'prive.peut_parrainer(uuid)', 'prive.bons_emis(date)',
    'prive.budget_restant(date)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Code de parrainage et choix du parrain (client)
-- ---------------------------------------------------------------------------
create or replace function public.mon_code_parrainage() returns text
language plpgsql security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
  code text;
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  octets bytea;
begin
  if compte is null then
    raise exception 'Connecte-toi pour avoir ton lien de parrainage.' using errcode = '42501';
  end if;
  if not prive.parrainage_actif() then
    raise exception 'Le parrainage n''est pas ouvert pour le moment.' using errcode = '55000';
  end if;
  if not prive.peut_parrainer(compte) then
    raise exception 'Le parrainage est réservé aux clients avec un numéro vérifié.' using errcode = '42501';
  end if;
  select p.code_parrainage into code from profils p where p.id = compte;
  if code is not null then
    return code;
  end if;
  for essai in 1 .. 20 loop
    octets := extensions.gen_random_bytes(6);
    code := '';
    for i in 0 .. 5 loop
      code := code || substr(alphabet, (get_byte(octets, i) % 31) + 1, 1);
    end loop;
    begin
      update profils p set code_parrainage = code where p.id = compte and p.code_parrainage is null;
      select p.code_parrainage into code from profils p where p.id = compte;
      return code;
    exception when unique_violation then
      null; -- code déjà pris : on en tire un autre
    end;
  end loop;
  raise exception 'Impossible de créer ton code : réessaie.' using errcode = '55000';
end $$;
revoke execute on function public.mon_code_parrainage() from public, anon;
grant execute on function public.mon_code_parrainage() to authenticated;

-- Saisie : numéro +213XXXXXXXXX (déjà normalisé par lib/parrainage.ts) ou code de 6 caractères.
-- Réponse « enregistre » dans tous les cas : on ne révèle jamais si un numéro est inscrit.
create or replace function public.choisir_parrain(saisie text) returns text
language plpgsql security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
  moi profils%rowtype;
  existant parrainages%rowtype;
  valeur text := upper(btrim(coalesce(saisie, '')));
  par_numero boolean;
  trouve uuid;
begin
  if compte is null then
    raise exception 'Connecte-toi pour choisir ton parrain.' using errcode = '42501';
  end if;
  if not prive.parrainage_actif() then
    raise exception 'Le parrainage n''est pas ouvert pour le moment.' using errcode = '55000';
  end if;
  select * into moi from profils p where p.id = compte for update;
  if not found or moi.role <> 'client' then
    raise exception 'Le parrainage est réservé aux clients.' using errcode = '42501';
  end if;
  if moi.telephone_verifie_le is null then
    raise exception 'Vérifie ton numéro par code avant de choisir ton parrain.' using errcode = '23514';
  end if;
  select * into existant from parrainages x where x.filleul_id = compte;
  if found and existant.saisies >= 3 then
    raise exception 'Tu as déjà modifié ton parrain 2 fois : ton choix est enregistré.' using errcode = '54000';
  end if;
  if exists (select 1 from commandes c where c.client_id = compte) then
    raise exception 'Le parrain se choisit avant ta première commande.' using errcode = '23514';
  end if;
  if moi.cree_le < now() - interval '7 days' then
    raise exception 'Le parrain se choisit dans les 7 jours après ton inscription.' using errcode = '23514';
  end if;
  if found and existant.statut <> 'en_attente' then
    raise exception 'Ton parrainage est déjà traité : il ne peut plus changer.' using errcode = '23514';
  end if;
  if valeur ~ '^\+213[567][0-9]{8}$' then
    par_numero := true;
  elsif valeur ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' then
    par_numero := false;
  else
    raise exception 'Écris le numéro WhatsApp de ton parrain (05, 06 ou 07 et 8 chiffres) ou son code de 6 caractères.' using errcode = '22023';
  end if;
  if (par_numero and valeur = moi.telephone) or (not par_numero and valeur = moi.code_parrainage) then
    raise exception 'C''est ton propre numéro : choisis le numéro d''un ami.' using errcode = '23514';
  end if;
  if exists (select 1 from prive.numeros_parraines n
             where n.empreinte = prive.empreinte_numero(moi.telephone) and n.filleul_id is distinct from compte) then
    raise exception 'Ton numéro a déjà été parrainé : un numéro ne peut être parrainé qu''une fois.' using errcode = '23514';
  end if;

  -- Recherche silencieuse d'un parrain possible.
  select p.id into trouve from profils p
  where (case when par_numero then p.telephone = valeur and p.telephone_verifie_le is not null
              else p.code_parrainage = valeur end)
    and p.id <> compte
    and prive.peut_parrainer(p.id)
    and p.cree_le < moi.cree_le
    and not exists (select 1 from parrainages b where b.filleul_id = p.id and b.parrain_id = compte);

  if existant.filleul_id is null then
    insert into parrainages (filleul_id, parrain_id) values (compte, trouve);
  else
    update parrainages x set parrain_id = trouve, saisies = x.saisies + 1, modifie_le = now() where x.filleul_id = compte;
  end if;
  if trouve is not null then
    insert into prive.numeros_parraines (empreinte, filleul_id) values (prive.empreinte_numero(moi.telephone), compte)
    on conflict (empreinte) do nothing;
  end if;
  return 'enregistre';
end $$;
revoke execute on function public.choisir_parrain(text) from public, anon;
grant execute on function public.choisir_parrain(text) to authenticated;

-- Ce que le client voit dans /compte et /parrainage (jamais un numéro ; prénom + initiale des filleuls validés).
create or replace function public.mon_parrainage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
  moi profils%rowtype;
  p parrainages%rowtype;
  mois date := prive.mois_alger();
begin
  if compte is null then
    return null;
  end if;
  select * into moi from profils x where x.id = compte;
  select * into p from parrainages x where x.filleul_id = compte;
  return jsonb_build_object(
    'actif', prive.parrainage_actif(),
    'peut_parrainer', prive.peut_parrainer(compte),
    'code', moi.code_parrainage,
    'parrain_saisi', p.filleul_id is not null,
    'saisies', coalesce(p.saisies, 0),
    'peut_choisir', prive.parrainage_actif() and moi.role = 'client' and moi.telephone_verifie_le is not null
                    and moi.cree_le >= now() - interval '7 days'
                    and not exists (select 1 from commandes c where c.client_id = compte)
                    and coalesce(p.saisies, 0) < 3 and coalesce(p.statut, 'en_attente') = 'en_attente',
    'choix_jusqu_au', moi.cree_le + interval '7 days',
    'filleuls', coalesce((select jsonb_agg(jsonb_build_object('prenom', prive.prenom_initiale(f.nom), 'valide_le', x.valide_le,
                                                              'statut', x.statut) order by x.valide_le desc)
                          from parrainages x join profils f on f.id = x.filleul_id
                          join bons b on b.parrainage_id = x.filleul_id and b.origine = 'parrainage_parrain' and b.statut <> 'annule'
                          where x.parrain_id = compte), '[]'::jsonb),
    'en_attente', (select count(*) from parrainages x where x.parrain_id = compte and x.statut = 'en_attente'),
    'plafond_atteint', (select count(*) from bons b join parrainages x on x.filleul_id = b.parrainage_id
                        where b.profil_id = compte and b.origine = 'parrainage_parrain' and b.statut <> 'annule'
                          and prive.mois_alger(x.valide_le) = mois) >= 5);
end $$;
revoke execute on function public.mon_parrainage() from public, anon;
grant execute on function public.mon_parrainage() to authenticated;

create or replace function public.mes_bons() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'montant', b.montant, 'statut', b.statut, 'origine', b.origine, 'cree_le', b.cree_le,
      'expire_le', b.expire_le, 'utilise_le', b.utilise_le,
      'commande', case when b.statut in ('reserve', 'utilise') then b.commande_id end,
      'numero', case when b.statut in ('reserve', 'utilise') then c.numero end,
      'boutique', case when b.statut = 'utilise' then bo.nom end)
    order by case b.statut when 'disponible' then 0 when 'reserve' then 1 when 'en_file' then 2 else 3 end, b.expire_le nulls last, b.cree_le desc), '[]'::jsonb)
  from bons b
  left join commandes c on c.id = b.commande_id
  left join boutiques bo on bo.id = c.boutique_id
  where b.profil_id = auth.uid()
$$;
revoke execute on function public.mes_bons() from public, anon;
grant execute on function public.mes_bons() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Bons : émission (avec budget et file), validation du parrainage
-- ---------------------------------------------------------------------------
-- Émet les bons en file, dans l'ordre des validations, tant que le budget du mois le permet.
create or replace function prive.emettre_bons_en_file() returns integer
language plpgsql security definer set search_path = public as $$
declare
  x record;
  besoin integer;
  nombre integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('oranpromo:bons', 0));
  for x in select p.filleul_id, p.motif from parrainages p where p.statut = 'en_file' order by p.valide_le, p.filleul_id loop
    select coalesce(sum(b.montant), 0) into besoin from bons b where b.parrainage_id = x.filleul_id and b.statut = 'en_file';
    exit when prive.budget_restant() < besoin;
    update bons b set statut = 'disponible', cree_le = now(), expire_le = now() + interval '60 days'
    where b.parrainage_id = x.filleul_id and b.statut = 'en_file';
    update parrainages p set statut = case
        when exists (select 1 from bons b where b.parrainage_id = p.filleul_id and b.origine = 'parrainage_parrain') then 'valide'
        when p.motif = 'plafond' then 'plafond' else 'refuse' end
    where p.filleul_id = x.filleul_id;
    nombre := nombre + 1;
  end loop;
  return nombre;
end $$;
revoke execute on function prive.emettre_bons_en_file() from public, anon, authenticated;

-- Première commande récupérée du filleul (passage prete → recuperee) : validation ou non.
create or replace function prive.valider_parrainage(c commandes) returns void
language plpgsql security definer set search_path = public as $$
declare
  p parrainages%rowtype;
  filleul profils%rowtype;
  parrain profils%rowtype;
  recompense_parrain boolean := true;
  raison text;
  file boolean;
  echeance timestamptz;
begin
  select * into p from parrainages x where x.filleul_id = c.client_id and x.statut = 'en_attente' for update;
  if not found then
    return;
  end if;
  select * into filleul from profils where id = c.client_id;
  raison := case
    when exists (select 1 from commandes x where x.client_id = c.client_id and x.statut = 'recuperee' and x.id <> c.id) then 'premiere_commande_deja_recuperee'
    when p.parrain_id is null then 'sans_parrain'
    when c.mode_remise is distinct from 'qr' and c.mode_remise is distinct from 'code' then 'remise_sans_qr_code'
    when c.total < 2000 then 'moins_de_2000_da'
    when coalesce(c.terminee_le, now()) > filleul.cree_le + interval '60 days' then 'apres_60_jours'
  end;
  if raison is not null then
    update parrainages x set statut = 'non_valide', motif = raison, commande_id = c.id, boutique_id = c.boutique_id
    where x.filleul_id = p.filleul_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('oranpromo:bons', 0));
  select * into parrain from profils where id = p.parrain_id;
  raison := null;
  if parrain.bloque or parrain.parrainage_exclu or parrain.role <> 'client' then
    recompense_parrain := false;
    raison := 'parrain_bloque_ou_exclu';
  elsif (select count(*) from bons b join parrainages x on x.filleul_id = b.parrainage_id
         where b.profil_id = parrain.id and b.origine = 'parrainage_parrain' and b.statut <> 'annule'
           and prive.mois_alger(x.valide_le) = prive.mois_alger()) >= 5 then
    recompense_parrain := false;
    raison := 'plafond';
  end if;

  -- File : s'il y a déjà des bons en file (ordre des validations) ou si le budget ne suffit pas pour tous les bons.
  file := exists (select 1 from bons b where b.statut = 'en_file')
          or prive.budget_restant() < 300 * (case when recompense_parrain then 2 else 1 end);
  echeance := case when file then null else now() + interval '60 days' end;

  update parrainages x set
    statut = case when file then 'en_file' when raison = 'plafond' then 'plafond' when raison is not null then 'refuse' else 'valide' end,
    motif = raison, commande_id = c.id, boutique_id = c.boutique_id, valide_le = clock_timestamp()
  where x.filleul_id = p.filleul_id;
  insert into bons (profil_id, montant, origine, parrainage_id, statut, expire_le)
  values (p.filleul_id, 300, 'parrainage_filleul', p.filleul_id, case when file then 'en_file' else 'disponible' end, echeance);
  if recompense_parrain then
    insert into bons (profil_id, montant, origine, parrainage_id, statut, expire_le)
    values (parrain.id, 300, 'parrainage_parrain', p.filleul_id, case when file then 'en_file' else 'disponible' end, echeance);
  end if;
end $$;
revoke execute on function prive.valider_parrainage(commandes) from public, anon, authenticated;

-- Relevé en cours d'une boutique pour le mois courant (créé au besoin) et recalcul des totaux.
create or replace function prive.releve_en_cours(boutique uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r uuid;
begin
  insert into releves_bons (boutique_id, mois) values (boutique, prive.mois_alger())
  on conflict (boutique_id, mois) do nothing;
  select x.id into r from releves_bons x where x.boutique_id = boutique and x.mois = prive.mois_alger();
  return r;
end $$;
revoke execute on function prive.releve_en_cours(uuid) from public, anon, authenticated;

create or replace function prive.recalculer_releve(releve uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update releves_bons r set
    nombre = (select count(*) from lignes_releve l where l.releve_id = r.id and l.statut = 'a_rembourser'),
    montant = (select coalesce(sum(l.montant), 0) from lignes_releve l where l.releve_id = r.id and l.statut = 'a_rembourser')
  where r.id = releve and r.statut <> 'paye';
end $$;
revoke execute on function prive.recalculer_releve(uuid) from public, anon, authenticated;

-- Suit la commande : bon rendu (annulée, expirée, remise sans QR code), bon utilisé et ligne de relevé
-- (remise par QR code ou code), validation du parrainage (première commande récupérée).
create or replace function prive.bons_apres_statut() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  releve uuid;
  b bons%rowtype;
begin
  if new.statut is not distinct from old.statut then
    return new;
  end if;
  if new.bon_id is not null and new.remise_bon > 0 then
    select * into b from bons x where x.id = new.bon_id and x.commande_id = new.id and x.statut = 'reserve' for update;
    if found then
      if new.statut = 'recuperee' and new.mode_remise in ('qr', 'code') then
        releve := prive.releve_en_cours(new.boutique_id);
        update bons x set statut = 'utilise', utilise_le = coalesce(new.terminee_le, now()), releve_id = releve where x.id = b.id;
        insert into lignes_releve (releve_id, bon_id, commande_id, boutique_id, montant, remise_le, mode_remise,
                                   numero_commande, total_commande, client)
        values (releve, b.id, new.id, new.boutique_id, new.remise_bon, coalesce(new.terminee_le, now()), new.mode_remise,
                new.numero, new.total, prive.prenom_initiale(new.client_nom));
        perform prive.recalculer_releve(releve);
      elsif new.statut in ('annulee', 'expiree', 'recuperee') then
        update bons x set statut = 'disponible', commande_id = null,
          expire_le = greatest(x.expire_le, now() + interval '7 days') where x.id = b.id;
        update commandes x set remise_bon = 0 where x.id = new.id;
      end if;
    end if;
  end if;
  if old.statut = 'prete' and new.statut = 'recuperee' then
    perform prive.valider_parrainage(new);
  end if;
  return new;
end $$;
revoke execute on function prive.bons_apres_statut() from public, anon, authenticated;
create trigger commandes_bons_parrainage after update of statut on commandes
  for each row execute function prive.bons_apres_statut();

-- ---------------------------------------------------------------------------
-- 6. Utiliser un bon (client, juste après passer_commande)
-- ---------------------------------------------------------------------------
-- Résultat : « applique », ou la raison : « aucun_bon », « minimum », « boutique_exclue », « deja ».
create or replace function public.utiliser_bon(commande uuid) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  c commandes%rowtype;
  b bons%rowtype;
  ancien text;
  nouveau text;
begin
  if compte is null then
    raise exception 'Connecte-toi pour utiliser ton bon.' using errcode = '42501';
  end if;
  select * into c from commandes x where x.id = commande and x.client_id = compte for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if c.statut <> 'demandee' or c.bon_id is not null then
    return 'deja';
  end if;
  if c.total < 1000 then
    return 'minimum';
  end if;
  if not coalesce((select bo.bons_acceptes from boutiques bo where bo.id = c.boutique_id), false) then
    return 'boutique_exclue';
  end if;
  select * into b from bons x
  where x.profil_id = compte and x.statut = 'disponible' and x.expire_le > now()
  order by x.expire_le, x.cree_le limit 1 for update skip locked;
  if not found then
    return 'aucun_bon';
  end if;
  update bons x set statut = 'reserve', commande_id = c.id where x.id = b.id;
  update commandes x set bon_id = b.id, remise_bon = b.montant where x.id = c.id;

  -- Message « nouvelle commande » pas encore parti : 4e paramètre = montant à encaisser (information de commande).
  ancien := prive.montant_da(c.total);
  nouveau := prive.montant_da(c.total - b.montant) || ' à encaisser (bon parrainage −' || b.montant || ' DA)';
  update messages_whatsapp m set
    parametres = jsonb_set(m.parametres, '{3}', to_jsonb(nouveau)),
    texte = replace(m.texte, ', ' || ancien || '.', ', ' || nouveau || '.')
  where m.commande_id = c.id and m.statut = 'a_envoyer' and m.langue = 'fr'
    and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer')
    and m.parametres ->> 3 = ancien;
  return 'applique';
end $$;
revoke execute on function public.utiliser_bon(uuid) from public, anon;
grant execute on function public.utiliser_bon(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Tâche quotidienne : relevés clôturés, bons en file émis, bons et parrainages expirés
-- ---------------------------------------------------------------------------
create or replace function prive.parrainage_quotidien() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  clotures integer;
  emis integer;
  bons_expires integer;
  parrainages_expires integer;
begin
  update releves_bons r set statut = 'a_payer', cloture_le = now()
  where r.statut = 'en_cours' and r.mois < prive.mois_alger();
  get diagnostics clotures = row_count;
  emis := prive.emettre_bons_en_file();
  update bons b set statut = 'expire' where b.statut = 'disponible' and b.expire_le <= now();
  get diagnostics bons_expires = row_count;
  update parrainages p set statut = 'expire', motif = 'apres_60_jours'
  from profils f where f.id = p.filleul_id and p.statut = 'en_attente' and f.cree_le + interval '60 days' < now();
  get diagnostics parrainages_expires = row_count;
  return jsonb_build_object('releves_clotures', clotures, 'parrainages_emis', emis,
                            'bons_expires', bons_expires, 'parrainages_expires', parrainages_expires);
end $$;
revoke execute on function prive.parrainage_quotidien() from public, anon, authenticated;

-- Chaque jour à 00 h 10 heure d'Alger (23 h 10 UTC) : le 1er du mois, clôture et bons en file du nouveau budget.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise warning 'pg_cron indisponible : lancer chaque jour select prive.parrainage_quotidien() (voir la migration 20261012090000).';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('parrainage-quotidien', '10 23 * * *', 'select prive.parrainage_quotidien()');
exception when others then
  raise warning 'Tâche planifiée non créée (%) : activer pg_cron puis lancer cron.schedule (voir la migration 20261012090000).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Admin
-- ---------------------------------------------------------------------------
create or replace function prive.exiger_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not prive.est_admin() then
    raise exception 'Réservé à l''administrateur.' using errcode = '42501';
  end if;
end $$;
revoke execute on function prive.exiger_admin() from public, anon, authenticated;

create or replace function public.budget_parrainage(mois date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare
  m date := coalesce(date_trunc('month', mois)::date, prive.mois_alger());
begin
  perform prive.exiger_admin();
  return jsonb_build_object(
    'mois', m,
    'actif', prive.parrainage_actif(),
    'budget', prive.budget_parrainage_mois(),
    'emis', prive.bons_emis(m),
    'utilise', (select coalesce(sum(b.montant), 0) from bons b where b.statut = 'utilise' and prive.mois_alger(b.utilise_le) = m),
    'en_file', (select count(*) from parrainages p where p.statut = 'en_file'),
    'restant', greatest(prive.budget_restant(m), 0));
end $$;

create or replace function public.regler_budget_parrainage(montant integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform prive.exiger_admin();
  if montant is null or montant < 0 or montant > 10000000 then
    raise exception 'Budget invalide : un montant en DA entre 0 et 10 000 000.' using errcode = '22023';
  end if;
  insert into prive.reglages (cle, valeur) values ('parrainage_budget_mois', montant::text)
  on conflict (cle) do update set valeur = excluded.valeur;
  perform prive.emettre_bons_en_file();
end $$;

create or replace function prive.motif_valide(motif text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  m text := nullif(btrim(coalesce(motif, '')), '');
begin
  if m is null or char_length(m) < 3 or char_length(m) > 300 then
    raise exception 'Motif obligatoire (3 à 300 caractères).' using errcode = '23514';
  end if;
  return m;
end $$;
revoke execute on function prive.motif_valide(text) from public, anon, authenticated;

-- Annule les bons pas encore utilisés d'un parrainage (disponibles ou en file ; un bon réservé reste sur sa commande).
create or replace function public.annuler_bons_parrainage(filleul uuid, motif text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  m text;
  nombre integer;
begin
  perform prive.exiger_admin();
  m := prive.motif_valide(motif);
  if not exists (select 1 from parrainages p where p.filleul_id = filleul) then
    raise exception 'Parrainage introuvable.' using errcode = 'P0002';
  end if;
  update bons b set statut = 'annule', expire_le = coalesce(b.expire_le, now())
  where b.parrainage_id = filleul and b.statut in ('disponible', 'en_file');
  get diagnostics nombre = row_count;
  update parrainages p set statut = 'annule', motif = m where p.filleul_id = filleul;
  return nombre;
end $$;

create or replace function public.exclure_parrainage(profil uuid, exclu boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform prive.exiger_admin();
  update profils p set parrainage_exclu = coalesce(exclu, false) where p.id = profil;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.retirer_boutique_des_bons(boutique uuid, retiree boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform prive.exiger_admin();
  update boutiques b set bons_acceptes = not coalesce(retiree, false) where b.id = boutique;
  if not found then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.mettre_de_cote(ligne uuid, motif text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l lignes_releve%rowtype;
  m text;
begin
  perform prive.exiger_admin();
  m := prive.motif_valide(motif);
  select * into l from lignes_releve x where x.id = ligne for update;
  if not found then
    raise exception 'Ligne introuvable.' using errcode = 'P0002';
  end if;
  if l.statut <> 'a_rembourser' then
    raise exception 'Cette ligne n''est pas à rembourser.' using errcode = '23514';
  end if;
  update lignes_releve x set statut = 'de_cote', motif = m where x.id = l.id; -- refusé par la base si le relevé est payé
  perform prive.recalculer_releve(l.releve_id);
end $$;

-- « rembourser » : la ligne revient à rembourser, sur le relevé en cours de la boutique ; « refuser » : retirée.
create or replace function public.decider_ligne(ligne uuid, decision text, motif text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l lignes_releve%rowtype;
  m text;
  nouveau uuid;
begin
  perform prive.exiger_admin();
  m := prive.motif_valide(motif);
  select * into l from lignes_releve x where x.id = ligne for update;
  if not found then
    raise exception 'Ligne introuvable.' using errcode = 'P0002';
  end if;
  if l.statut <> 'de_cote' then
    raise exception 'Seule une ligne mise de côté attend une décision.' using errcode = '23514';
  end if;
  if decision = 'rembourser' then
    nouveau := case when (select r.statut from releves_bons r where r.id = l.releve_id) = 'en_cours'
                    then l.releve_id else prive.releve_en_cours(l.boutique_id) end;
    update lignes_releve x set statut = 'a_rembourser', motif = m, releve_id = nouveau where x.id = l.id;
    update bons b set releve_id = nouveau where b.id = l.bon_id;
    perform prive.recalculer_releve(nouveau);
  elsif decision = 'refuser' then
    update lignes_releve x set statut = 'refuse', motif = m where x.id = l.id;
  else
    raise exception 'Décision inconnue : rembourser ou refuser.' using errcode = '22023';
  end if;
  perform prive.recalculer_releve(l.releve_id);
end $$;

create or replace function public.marquer_releve_paye(releve uuid, reference text, paye_le date) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  r releves_bons%rowtype;
  ref text := nullif(btrim(coalesce(reference, '')), '');
begin
  perform prive.exiger_admin();
  select * into r from releves_bons x where x.id = releve for update;
  if not found then
    raise exception 'Relevé introuvable.' using errcode = 'P0002';
  end if;
  if r.statut <> 'a_payer' then
    raise exception 'Seul un relevé clôturé (à payer) peut être marqué comme payé.' using errcode = '23514';
  end if;
  if ref is null or char_length(ref) < 3 or char_length(ref) > 60 then
    raise exception 'Référence du virement obligatoire (3 à 60 caractères).' using errcode = '23514';
  end if;
  if paye_le is null or paye_le < r.mois or paye_le > (now() at time zone 'Africa/Algiers')::date then
    raise exception 'Date de paiement invalide.' using errcode = '22023';
  end if;
  update releves_bons x set statut = 'paye', paye_le = paye_le, reference_paiement = ref, paye_par = auth.uid()
  where x.id = r.id;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.budget_parrainage(date)', 'public.regler_budget_parrainage(integer)',
    'public.annuler_bons_parrainage(uuid, text)', 'public.exclure_parrainage(uuid, boolean)',
    'public.retirer_boutique_des_bons(uuid, boolean)', 'public.mettre_de_cote(uuid, text)',
    'public.decider_ligne(uuid, text, text)', 'public.marquer_releve_paye(uuid, text, date)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Retrait (US-26) : le résumé du scan et la page du proche donnent aussi le bon déduit
-- ---------------------------------------------------------------------------
create or replace function prive.resume_retrait(c_id uuid, etat text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when c_id is null then jsonb_build_object('etat', etat) else (
    select jsonb_build_object(
      'etat', etat, 'commande', c.id, 'numero', c.numero,
      'prenom', split_part(btrim(c.client_nom), ' ', 1),
      'total', c.total, 'remise_bon', c.remise_bon, 'expire_le', c.expire_le, 'terminee_le', c.terminee_le, 'mode_remise', c.mode_remise,
      'lignes', prive.lignes_retrait(c.id))
    from commandes c where c.id = c_id) end
$$;
revoke execute on function prive.resume_retrait(uuid, text) from public, anon, authenticated;

create or replace function public.retrait_par_lien(jeton text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r prive.retraits%rowtype;
  c commandes%rowtype;
  b boutiques%rowtype;
  etat text;
begin
  if jeton is null or jeton !~ '^[A-Za-z0-9_-]{22}$' then
    return null;
  end if;
  select * into r from prive.retraits x where x.jeton = retrait_par_lien.jeton;
  if not found then
    return null;
  end if;
  select * into c from commandes where id = r.commande_id;
  select * into b from boutiques where id = c.boutique_id;
  etat := case
    when c.statut = 'prete' and r.actif and c.expire_le > now() then 'prete'
    when c.statut = 'recuperee' then 'recuperee'
    when c.statut = 'annulee' then 'annulee'
    else 'expiree' end;
  return jsonb_build_object(
    'etat', etat, 'numero', c.numero, 'total', c.total, 'remise_bon', c.remise_bon, 'expire_le', c.expire_le, 'terminee_le', c.terminee_le,
    'boutique', jsonb_build_object('nom', b.nom, 'slug', b.slug, 'quartier', b.quartier, 'adresse', b.adresse),
    'lignes', prive.lignes_retrait(c.id),
    'code', case when etat = 'prete' then r.code end);
end $$;
revoke execute on function public.retrait_par_lien(text) from public;
grant execute on function public.retrait_par_lien(text) to anon, authenticated;

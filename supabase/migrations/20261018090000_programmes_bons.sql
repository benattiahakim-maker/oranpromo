-- US-33.1 : programmes de bons (bienvenue, campagnes) dans la base, sur le système de bons du parrainage (US-27).
-- Voir docs/architecture.md, « Bons de réduction : bienvenue et campagnes (US-33) », et docs/user-stories.md, module 19
-- (décisions du propriétaire du 10/10 à 9 h 24).
-- Ce qui ne change pas : passer_commande, changer_statut_commande, remettre_commande, blocage, no-shows, contestation,
-- vérification du numéro ; le parrainage garde son montant, son minimum (1 000 DA sur le total), son budget
-- (parrainage_budget_mois, qui ne compte plus que les bons de parrainage) et sa règle « bon toujours rendu ».
-- Nouveaux bons : preuve par QR code seulement (comme le parrainage) ; commande annulée par le client ou expirée :
-- le bon expire ; annulée par la boutique (ou l'admin) : le bon revient (+7 jours) — règle de la carte.
-- Le programme « bienvenue » est créé INACTIF avec un budget de 0 DA : le propriétaire fixe le budget et l'active.

-- ---------------------------------------------------------------------------
-- 1. Programmes
-- ---------------------------------------------------------------------------
create table public.programmes_bons (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bienvenue', 'campagne')),
  nom_fr text not null check (char_length(btrim(nom_fr)) between 2 and 40),
  nom_ar text not null check (char_length(btrim(nom_ar)) between 2 and 40),
  code text unique check (code ~ '^[A-Z0-9]{4,16}$'),
  montant integer not null check (montant > 0 and montant <= 5000),
  minimum_achat integer not null default 0 check (minimum_achat >= 0),
  univers text check (univers in ('femme', 'homme', 'enfant', 'beaute')),
  villes text[] not null default '{}',
  debut timestamptz not null default now(),
  fin timestamptz,
  validite_jours integer not null default 30 check (validite_jours between 1 and 365),
  budget integer not null default 0 check (budget >= 0),
  plafond_par_boutique integer check (plafond_par_boutique > 0),
  actif boolean not null default false,
  cree_par uuid references public.profils(id) on delete set null,
  cree_le timestamptz not null default now(),
  constraint programmes_code_campagne check ((type = 'campagne') = (code is not null)),
  constraint programmes_dates check (fin is null or fin > debut),
  constraint programmes_minimum check (minimum_achat >= montant)
);
create unique index programmes_bons_un_bienvenue on public.programmes_bons (type) where type = 'bienvenue';
comment on table public.programmes_bons is 'US-33 : programmes de bons payés par BleDeal (bienvenue, campagnes). Lecture admin ; écriture : fonctions et migrations.';
alter table public.programmes_bons enable row level security;
create policy programmes_bons_admin on public.programmes_bons for select to authenticated using (prive.est_admin());
revoke insert, update, delete, truncate on public.programmes_bons from public, anon, authenticated;
revoke all on public.programmes_bons from anon;

-- Décision du 10/10 : 300 DA dès 2 000 DA d'achat (30 jours, conception). Budget à fixer par le propriétaire.
insert into public.programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat, validite_jours, budget, actif)
values ('bienvenue', 'Bienvenue', 'مرحبا', 300, 2000, 30, 0, false);

-- ---------------------------------------------------------------------------
-- 2. Bons : programme, règles copiées à la création
-- ---------------------------------------------------------------------------
alter table public.bons
  add column programme_id uuid references public.programmes_bons(id) on delete restrict,
  add column minimum_achat integer not null default 1000 check (minimum_achat >= 0),
  add column univers text check (univers in ('femme', 'homme', 'enfant', 'beaute')),
  add column villes text[] not null default '{}';
alter table public.bons drop constraint bons_origine_check;
alter table public.bons add constraint bons_origine_check
  check (origine in ('parrainage_filleul', 'parrainage_parrain', 'bienvenue', 'campagne'));
alter table public.bons add constraint bons_programme_origine
  check ((origine like 'parrainage%') = (programme_id is null));
create index bons_programme_idx on public.bons (programme_id, statut) where programme_id is not null;
comment on column public.bons.minimum_achat is 'US-33 : achat minimum (1 000 DA sur le total pour le parrainage ; programmes : articles de l''univers du bon).';

-- Une fois par numéro vérifié et par programme (empreinte gardée si le compte disparaît).
create table prive.numeros_programmes (
  programme_id uuid not null references public.programmes_bons(id) on delete cascade,
  empreinte text not null,
  le timestamptz not null default now(),
  primary key (programme_id, empreinte)
);

-- Relevé : origine du bon (parrainage, bienvenue, campagne) et programme.
alter table public.lignes_releve
  add column origine text,
  add column programme_id uuid references public.programmes_bons(id) on delete set null;
update public.lignes_releve l set origine = b.origine from public.bons b where b.id = l.bon_id;
comment on column public.lignes_releve.origine is 'US-33 : origine du bon (parrainage_*, bienvenue, campagne) ; vide = ligne sans bon (parrainage, avant US-33).';

-- ---------------------------------------------------------------------------
-- 3. Budgets : le parrainage ne compte que ses bons ; chaque programme compte les siens
-- ---------------------------------------------------------------------------
create or replace function prive.bons_emis(mois date) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(b.montant), 0)::integer from bons b
  where b.statut not in ('en_file', 'annule') and prive.mois_alger(b.cree_le) = mois and b.origine like 'parrainage%'
$$;

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
    'utilise', (select coalesce(sum(b.montant), 0) from bons b where b.statut = 'utilise' and prive.mois_alger(b.utilise_le) = m
                  and b.origine like 'parrainage%'),
    'en_file', (select count(*) from parrainages p where p.statut = 'en_file'),
    'restant', greatest(prive.budget_restant(m), 0));
end $$;

-- Budget restant d'un programme : budget − bons donnés (sauf annulés). Un bon expiré reste compté (prudent).
create or replace function prive.budget_programme_restant(programme uuid) returns integer
language sql stable security definer set search_path = public as $$
  select p.budget - coalesce((select sum(b.montant) from bons b where b.programme_id = p.id and b.statut <> 'annule'), 0)::integer
  from programmes_bons p where p.id = programme
$$;

-- Programme ouvert maintenant (actif, dates).
create or replace function prive.programme_ouvert(p programmes_bons) returns boolean
language sql stable set search_path = public as $$
  select p.actif and p.debut <= now() and (p.fin is null or p.fin > now())
$$;

-- ---------------------------------------------------------------------------
-- 4. Donner un bon d'un programme (interne : bienvenue US-33.2, code de campagne US-33.3)
-- ---------------------------------------------------------------------------
-- Résultat : « donne », ou la raison : « ferme », « budget », « numero » (pas de numéro vérifié), « deja ».
create or replace function prive.donner_bon_programme(programme uuid, compte uuid) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  p programmes_bons%rowtype;
  numero text;
  empreinte_compte text;
begin
  perform pg_advisory_xact_lock(hashtextextended('oranpromo:programme:' || programme::text, 0));
  select * into p from programmes_bons x where x.id = programme;
  if not found or not prive.programme_ouvert(p) then
    return 'ferme';
  end if;
  select pr.telephone into numero from profils pr where pr.id = compte and pr.telephone_verifie_le is not null and pr.telephone is not null;
  if numero is null then
    return 'numero';
  end if;
  empreinte_compte := prive.empreinte_numero(numero);
  if exists (select 1 from prive.numeros_programmes n where n.programme_id = p.id and n.empreinte = empreinte_compte) then
    return 'deja';
  end if;
  if prive.budget_programme_restant(p.id) < p.montant then
    return 'budget';
  end if;
  insert into prive.numeros_programmes (programme_id, empreinte) values (p.id, empreinte_compte);
  insert into bons (profil_id, montant, origine, programme_id, minimum_achat, univers, villes, statut, expire_le)
  values (compte, p.montant, p.type, p.id, p.minimum_achat, p.univers, p.villes, 'disponible',
          least(coalesce(p.fin, 'infinity'::timestamptz), now() + make_interval(days => p.validite_jours)));
  return 'donne';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Utiliser un bon : le meilleur bon utilisable (ou celui choisi), avec la raison sinon
-- ---------------------------------------------------------------------------
-- Montant des articles d'une commande dans un univers (prix réels des lignes, recalculés par passer_commande).
-- Même règle que critereUnivers (lib/catalogue.ts) : beauté = catégories beauté ; femme / homme = catégories mode,
-- genre ou « mixte » ; enfant = catégories mode, genre « enfant ». Sans univers : total de la commande.
create or replace function prive.montant_univers(commande uuid, univers text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.prix_unitaire * l.quantite), 0)::integer
  from lignes_commande l left join articles a on a.id = l.article_id
  where l.commande_id = commande
    and (univers is null
      or (univers = 'beaute' and a.categorie::text in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel'))
      or (univers in ('femme', 'homme', 'enfant')
          and a.categorie::text in ('T-shirts et polos', 'Chemises', 'Pulls et sweats', 'Vestes et manteaux', 'Pantalons et jeans',
                              'Survêtements et ensembles', 'Robes', 'Jupes', 'Abayas, djellabas, kamis', 'Tenues traditionnelles',
                              'Hijabs et foulards', 'Chaussures', 'Sacs', 'Accessoires')
          and (a.genre::text = univers or (univers <> 'enfant' and a.genre::text = 'mixte'))))
$$;

-- « ok » ou la raison : « minimum », « univers », « ville », « boutique_exclue », « plafond_boutique ».
create or replace function prive.raison_bon(b bons, c commandes) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  bo boutiques%rowtype;
  plafond integer;
begin
  select * into bo from boutiques x where x.id = c.boutique_id;
  if b.programme_id is null then
    if c.total < b.minimum_achat then return 'minimum'; end if;  -- parrainage : inchangé (total, 1 000 DA)
  elsif prive.montant_univers(c.id, b.univers) < b.minimum_achat then
    return case when b.univers is not null and c.total >= b.minimum_achat then 'univers' else 'minimum' end;
  end if;
  if cardinality(b.villes) > 0 and not (bo.ville = any (b.villes)) then return 'ville'; end if;
  if not coalesce(bo.bons_acceptes, false) then return 'boutique_exclue'; end if;
  if b.programme_id is not null then
    select p.plafond_par_boutique into plafond from programmes_bons p where p.id = b.programme_id;
    if plafond is not null and (select count(*) from bons x join commandes y on y.id = x.commande_id
                                where x.programme_id = b.programme_id and x.statut in ('reserve', 'utilise')
                                  and y.boutique_id = c.boutique_id) >= plafond then
      return 'plafond_boutique';
    end if;
  end if;
  return 'ok';
end $$;

-- Ancienne signature remplacée : utiliser_bon(commande) reste valable (bon = le meilleur utilisable).
drop function public.utiliser_bon(uuid);
create or replace function public.utiliser_bon(commande uuid, bon uuid default null) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  c commandes%rowtype;
  b bons%rowtype;
  choisi bons%rowtype;
  premiere text;
  raison text;
  nom text;
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
  -- Sans bon disponible : mêmes réponses qu'avant US-33.
  if not exists (select 1 from bons x where x.profil_id = compte and x.statut = 'disponible' and x.expire_le > now()
                 and (bon is null or x.id = bon)) then
    if c.total < 1000 then return 'minimum'; end if;
    if not coalesce((select bo.bons_acceptes from boutiques bo where bo.id = c.boutique_id), false) then return 'boutique_exclue'; end if;
    return 'aucun_bon';
  end if;
  -- Le plus gros montant d'abord, puis le plus proche de l'échéance.
  for b in select * from bons x where x.profil_id = compte and x.statut = 'disponible' and x.expire_le > now()
             and (bon is null or x.id = bon)
           order by x.montant desc, x.expire_le, x.cree_le for update skip locked loop
    raison := prive.raison_bon(b, c);
    premiere := coalesce(premiere, raison);
    if raison = 'ok' then choisi := b; exit; end if;
  end loop;
  if choisi.id is null then
    return coalesce(premiere, 'aucun_bon');
  end if;
  update bons x set statut = 'reserve', commande_id = c.id where x.id = choisi.id;
  update commandes x set bon_id = choisi.id, remise_bon = choisi.montant where x.id = c.id;

  -- Message « nouvelle commande » pas encore parti : 4e paramètre = montant à encaisser (information de commande).
  nom := case when choisi.programme_id is null then 'parrainage'
              else (select p.nom_fr from programmes_bons p where p.id = choisi.programme_id) end;
  ancien := prive.montant_da(c.total);
  nouveau := prive.montant_da(c.total - choisi.montant) || ' à encaisser (bon ' || nom || ' −' || choisi.montant || ' DA)';
  update messages_whatsapp m set
    parametres = jsonb_set(m.parametres, '{3}', to_jsonb(nouveau)),
    texte = replace(m.texte, ', ' || ancien || '.', ', ' || nouveau || '.')
  where m.commande_id = c.id and m.statut = 'a_envoyer' and m.langue = 'fr'
    and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer')
    and m.parametres ->> 3 = ancien;
  return 'applique';
end $$;
revoke execute on function public.utiliser_bon(uuid, uuid) from public, anon;
grant execute on function public.utiliser_bon(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Suivi de la commande : règle de la carte pour les nouveaux bons
-- ---------------------------------------------------------------------------
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
      if new.statut = 'recuperee' and new.mode_remise = 'qr' then
        releve := prive.releve_en_cours(new.boutique_id);
        update bons x set statut = 'utilise', utilise_le = coalesce(new.terminee_le, now()), releve_id = releve where x.id = b.id;
        insert into lignes_releve (releve_id, bon_id, commande_id, boutique_id, montant, remise_le, mode_remise,
                                   numero_commande, total_commande, client, origine, programme_id)
        values (releve, b.id, new.id, new.boutique_id, new.remise_bon, coalesce(new.terminee_le, now()), new.mode_remise,
                new.numero, new.total, prive.prenom_initiale(new.client_nom), b.origine, b.programme_id);
        perform prive.recalculer_releve(releve);
      elsif b.programme_id is not null and (new.statut = 'expiree'
              or (new.statut = 'annulee' and new.motif_annulation is not distinct from 'client_a_annule')) then
        -- Règle de la carte (décision du 10/10) : annulée par le client ou pas venu → le bon expire.
        update bons x set statut = 'expire', expire_le = least(x.expire_le, now()) where x.id = b.id;
        update commandes x set remise_bon = 0 where x.id = new.id;
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

-- ---------------------------------------------------------------------------
-- 7. Ce que le client voit : nom du programme, minimum, univers, villes
-- ---------------------------------------------------------------------------
create or replace function public.mes_bons() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'montant', b.montant, 'statut', b.statut, 'origine', b.origine, 'cree_le', b.cree_le,
      'expire_le', b.expire_le, 'utilise_le', b.utilise_le,
      'commande', case when b.statut in ('reserve', 'utilise') then b.commande_id end,
      'numero', case when b.statut in ('reserve', 'utilise') then c.numero end,
      'boutique', case when b.statut = 'utilise' then bo.nom end,
      'minimum_achat', b.minimum_achat, 'univers', b.univers, 'villes', to_jsonb(b.villes),
      'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar)
    order by case b.statut when 'disponible' then 0 when 'reserve' then 1 when 'en_file' then 2 else 3 end, b.expire_le nulls last, b.cree_le desc), '[]'::jsonb)
  from bons b
  left join commandes c on c.id = b.commande_id
  left join boutiques bo on bo.id = c.boutique_id
  left join programmes_bons p on p.id = b.programme_id
  where b.profil_id = auth.uid()
$$;

revoke execute on function prive.budget_programme_restant(uuid), prive.programme_ouvert(programmes_bons),
  prive.donner_bon_programme(uuid, uuid), prive.montant_univers(uuid, text), prive.raison_bon(bons, commandes)
  from public, anon, authenticated;

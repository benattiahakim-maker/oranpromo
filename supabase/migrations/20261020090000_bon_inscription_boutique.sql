-- US-31.4 : bon de bienvenue pour l'inscription en boutique (affiche → /i/<slug>, rattachement US-31.3).
-- Voir docs/user-stories.md, module 17, et docs/architecture.md, « Suivre une boutique… (US-31) ».
-- Sur les programmes de bons US-33 (programmes_bons, donner_bon_programme, budget par programme, relevés par origine),
-- sans changer leurs règles : un programme de plus, de type « inscription_boutique », inactif et à budget 0
-- (le propriétaire l'active, voir plus bas).
-- Règles du bon (conception US-31 ; montants à valider par le propriétaire) :
--   * le compte rattaché à une boutique (inscriptions_boutique) reçoit ce bon À LA PLACE du bon de bienvenue, une fois
--     son numéro vérifié (au rattachement s'il l'est déjà, sinon à la vérification) ; mêmes droits que le bon de
--     bienvenue (client, aucune commande récupérée, pas filleul) ; un seul bon de bienvenue par numéro ;
--   * pas utilisable le jour même dans la boutique qui a inscrit (dès le lendemain, heure d'Alger) ; tout de suite ailleurs ;
--   * coût partagé dans la boutique d'origine : elle déduit tout le bon en caisse, BleDeal lui rembourse
--     montant − part_boutique ; ailleurs BleDeal rembourse tout ;
--   * plafond d'inscriptions récompensées par boutique et par mois (au-delà, l'inscription marche sans bon) ;
--   * minimum d'achat et retrait par QR code (règle US-33 inchangée : par code à 6 chiffres, le bon ne s'applique pas) ;
--   * pas de prime vendeur ; signaux admin (jamais bloquants) dans signaux_inscriptions().
-- Ce qui ne change pas : passer_commande, changer_statut_commande, remettre_commande, blocage, no-shows, contestation,
-- vérification du numéro, statuts, stock ; règles des bons de parrainage, de bienvenue, de campagne et d'avis.
-- Activation (propriétaire, SQL Editor, après accord écrit des boutiques sur leur part) :
--   update programmes_bons set budget = <DA>, actif = true where type = 'inscription_boutique';

-- ---------------------------------------------------------------------------
-- 1. Type de programme, origine de bon, colonnes
-- ---------------------------------------------------------------------------
alter table public.programmes_bons drop constraint programmes_bons_type_check;
alter table public.programmes_bons add constraint programmes_bons_type_check
  check (type in ('bienvenue', 'campagne', 'avis', 'inscription_boutique'));
alter table public.bons drop constraint bons_origine_check;
alter table public.bons add constraint bons_origine_check
  check (origine in ('parrainage_filleul', 'parrainage_parrain', 'bienvenue', 'campagne', 'avis', 'inscription_boutique'));

-- Part payée par la boutique d'origine (DA) et plafond d'inscriptions récompensées par boutique et par mois.
alter table public.programmes_bons
  add column part_boutique integer not null default 0,
  add column plafond_inscriptions_mois integer,
  add constraint programmes_part_boutique check (part_boutique >= 0 and part_boutique < montant),
  add constraint programmes_plafond_inscriptions check (plafond_inscriptions_mois is null or plafond_inscriptions_mois > 0);
create unique index programmes_bons_un_inscription on public.programmes_bons (type) where type = 'inscription_boutique';

-- Bon : boutique qui a inscrit le client, sa part, et l'heure à partir de laquelle le bon y est utilisable.
-- Une seule clé étrangère bons → boutiques, clé primaire technique : pas de relation ambiguë pour PostgREST.
alter table public.bons
  add column boutique_origine uuid references public.boutiques(id) on delete set null,
  add column part_boutique integer not null default 0,
  add column utilisable_des timestamptz,
  add constraint bons_part_boutique check (part_boutique >= 0 and part_boutique < montant);
create index bons_boutique_origine_idx on public.bons (boutique_origine, cree_le) where boutique_origine is not null;

-- Ligne de relevé : part de la boutique (0 sauf bon d'inscription utilisé dans la boutique d'origine).
-- À rembourser = montant − part_boutique.
alter table public.lignes_releve
  add column part_boutique integer not null default 0,
  add constraint lignes_releve_part_boutique check (part_boutique >= 0 and part_boutique < montant);

-- Conception : 500 DA dès 4 000 DA d'achat, 250 DA payés par la boutique d'origine, 20 inscriptions récompensées par
-- boutique et par mois, 30 jours. Inactif, budget 0 : rien n'est donné avant la décision du propriétaire.
insert into public.programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat, validite_jours, budget, actif,
                                    part_boutique, plafond_inscriptions_mois)
values ('inscription_boutique', 'Bienvenue en boutique', 'مرحبا في الحانوت', 500, 4000, 30, 0, false, 250, 20);

-- ---------------------------------------------------------------------------
-- 2. Budget : seulement la part de BleDeal
-- ---------------------------------------------------------------------------
-- Un bon pas encore utilisé compte pour tout son montant (il peut servir ailleurs, où BleDeal paie tout) ;
-- une fois utilisé dans la boutique d'origine, pour montant − part_boutique. Sans part (tous les autres
-- programmes), le résultat est le même qu'avant.
create or replace function prive.budget_programme_restant(programme uuid) returns integer
language sql stable security definer set search_path = public as $$
  select p.budget - coalesce((select sum(b.montant - coalesce(l.part_boutique, 0)) from bons b
                              left join lignes_releve l on l.bon_id = b.id
                              where b.programme_id = p.id and b.statut <> 'annule'), 0)::integer
  from programmes_bons p where p.id = programme
$$;

-- ---------------------------------------------------------------------------
-- 3. Donner le bon
-- ---------------------------------------------------------------------------
-- Début du jour suivant, heure d'Alger.
create or replace function prive.lendemain_alger(t timestamptz) returns timestamptz
language sql immutable set search_path = public as $$
  select (date_trunc('day', t at time zone 'Africa/Algiers') + interval '1 day') at time zone 'Africa/Algiers'
$$;

-- Bons d'inscription donnés ce mois-ci (heure d'Alger) pour une boutique (non annulés).
create or replace function prive.bons_inscription_mois(boutique uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from bons b join programmes_bons p on p.id = b.programme_id
  where p.type = 'inscription_boutique' and b.boutique_origine = boutique and b.statut <> 'annule'
    and b.cree_le >= date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'
$$;

-- Offre ouverte pour cette boutique : programme ouvert, budget suffisant, boutique qui prend les bons, plafond du mois.
create or replace function prive.offre_inscription_ouverte(boutique uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select prive.programme_ouvert(p) and prive.budget_programme_restant(p.id) >= p.montant
                     and (p.plafond_inscriptions_mois is null or prive.bons_inscription_mois(boutique) < p.plafond_inscriptions_mois)
                   from programmes_bons p where p.type = 'inscription_boutique'), false)
     and exists (select 1 from boutiques bo where bo.id = boutique and bo.statut = 'validee' and coalesce(bo.bons_acceptes, false))
$$;

-- Donne le bon d'inscription : « donne », ou la raison (« inscription », « droit », « ferme », « boutique »,
-- « plafond », « deja », « budget », « numero »). Remplace le bon de bienvenue encore disponible du compte.
create or replace function prive.donner_bon_inscription(compte uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  p programmes_bons%rowtype;
  boutique_inscrite uuid;
  numero text;
  resultat text;
  nouveau uuid;
begin
  select i.boutique_id into boutique_inscrite from inscriptions_boutique i where i.profil_id = compte;
  if boutique_inscrite is null then
    return 'inscription';
  end if;
  if not prive.droit_bon_bienvenue(compte) then
    return 'droit';
  end if;
  select * into p from programmes_bons x where x.type = 'inscription_boutique';
  if not found then
    return 'ferme';
  end if;
  -- Même verrou que donner_bon_programme (réentrant) : le plafond du mois est compté sans concurrence.
  perform pg_advisory_xact_lock(hashtextextended('oranpromo:programme:' || p.id::text, 0));
  if not prive.programme_ouvert(p) then
    return 'ferme';
  end if;
  if not exists (select 1 from boutiques bo where bo.id = boutique_inscrite and bo.statut = 'validee' and coalesce(bo.bons_acceptes, false)) then
    return 'boutique';
  end if;
  if p.plafond_inscriptions_mois is not null and prive.bons_inscription_mois(boutique_inscrite) >= p.plafond_inscriptions_mois then
    return 'plafond';
  end if;
  -- Un seul bon d'inscription par compte (même après un changement de numéro).
  if exists (select 1 from bons b where b.profil_id = compte and b.origine = 'inscription_boutique') then
    return 'deja';
  end if;
  -- Un seul bon de bienvenue par numéro : si ce numéro a déjà eu le bon de bienvenue sur un autre compte (ou l'a
  -- déjà réservé ou utilisé), pas de bon d'inscription. Le bon de bienvenue encore disponible de CE compte est remplacé.
  select pr.telephone into numero from profils pr where pr.id = compte;
  if exists (select 1 from prive.numeros_programmes n join programmes_bons q on q.id = n.programme_id
             where q.type = 'bienvenue' and n.empreinte = prive.empreinte_numero(numero))
     and not exists (select 1 from bons b where b.profil_id = compte and b.origine = 'bienvenue' and b.statut = 'disponible') then
    return 'deja';
  end if;
  resultat := prive.donner_bon_programme(p.id, compte);
  if resultat <> 'donne' then
    return resultat;
  end if;
  select b.id into nouveau from bons b where b.profil_id = compte and b.programme_id = p.id order by b.cree_le desc limit 1;
  update bons b set boutique_origine = boutique_inscrite, part_boutique = p.part_boutique, utilisable_des = prive.lendemain_alger(b.cree_le)
  where b.id = nouveau;
  update bons b set statut = 'annule'
  where b.profil_id = compte and b.origine = 'bienvenue' and b.statut = 'disponible';
  return 'donne';
end $$;

-- Au rattachement (numéro déjà vérifié) et à la vérification du numéro (compte déjà rattaché).
-- Le déclencheur du profil s'appelle z_bon_inscription : il passe après z_bon_bienvenue (ordre alphabétique).
create or replace function prive.bon_inscription_rattachement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform prive.donner_bon_inscription(new.profil_id);
  exception when others then
    raise warning 'Bon d''inscription non donné (compte %) : %', new.profil_id, sqlerrm;
  end;
  return null;
end $$;

create or replace function prive.bon_inscription_numero_verifie() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform prive.donner_bon_inscription(new.id);
  exception when others then
    raise warning 'Bon d''inscription non donné (compte %) : %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger z_bon_inscription after insert on public.inscriptions_boutique
  for each row execute function prive.bon_inscription_rattachement();
create trigger z_bon_inscription after update of telephone_verifie_le on public.profils
  for each row when (old.telephone_verifie_le is null and new.telephone_verifie_le is not null)
  execute function prive.bon_inscription_numero_verifie();

-- Filleul : pas de bon d'inscription en plus du bon de parrainage (comme le bon de bienvenue).
create or replace function prive.bon_inscription_filleul() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update bons b set statut = 'annule'
  where b.profil_id = new.filleul_id and b.origine = 'inscription_boutique' and b.statut = 'disponible';
  return null;
end $$;
create trigger z_bon_inscription_filleul after insert or update of parrain_id on public.parrainages
  for each row when (new.parrain_id is not null)
  execute function prive.bon_inscription_filleul();

-- rattacher_inscription (US-31.3) : renvoie aussi « bon » (« donne » ; « numero » si l'offre est ouverte et le
-- numéro pas encore vérifié ; sinon null). Règles du suivi et du rattachement inchangées.
create or replace function public.rattacher_inscription(slug_boutique text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
  cible uuid;
  nouvelle boolean := false;
  rattache boolean := false;
  bon text;
begin
  if compte is null then
    raise exception 'Connectez-vous pour suivre une boutique.' using errcode = '42501';
  end if;
  select b.id into cible from boutiques b where b.slug = slug_boutique and b.statut = 'validee';
  if cible is null then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;
  -- Contrôle du rôle, verrou sur le profil et plafond de 200 : dans prive.ajouter_abonnement.
  begin
    nouvelle := prive.ajouter_abonnement(compte, cible, 'inscription_boutique');
  exception when sqlstate '54000' then
    nouvelle := false; -- plafond atteint : pas de nouvel abonnement, le rattachement reste possible
  end;
  if exists (select 1 from profils p where p.id = compte and p.cree_le > now() - interval '24 hours')
     and not exists (select 1 from commandes c where c.client_id = compte) then
    insert into inscriptions_boutique (profil_id, boutique_id) values (compte, cible)
      on conflict (profil_id) do nothing;
    rattache := found;
  end if;
  if rattache then
    if exists (select 1 from bons b where b.profil_id = compte and b.origine = 'inscription_boutique' and b.statut = 'disponible') then
      bon := 'donne';
    elsif (select p.telephone_verifie_le is null from profils p where p.id = compte) and prive.offre_inscription_ouverte(cible) then
      bon := 'numero';
    end if;
  end if;
  return jsonb_build_object('suivie_nouvelle', nouvelle, 'rattache', rattache, 'bon', bon);
end $$;

-- Bandeau de la vitrine après l'affiche : montant et minimum du bon si l'offre est ouverte pour cette boutique, sinon null.
create or replace function public.offre_inscription(slug_boutique text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when prive.offre_inscription_ouverte(bo.id) then
    (select jsonb_build_object('montant', p.montant, 'minimum_achat', p.minimum_achat)
     from programmes_bons p where p.type = 'inscription_boutique') end
  from boutiques bo where bo.slug = slug_boutique and bo.statut = 'validee'
$$;
revoke execute on function public.offre_inscription(text) from public;
grant execute on function public.offre_inscription(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Utilisation : « pas_aujourdhui » dans la boutique d'origine le jour de l'inscription
-- ---------------------------------------------------------------------------
-- Copies de raison_bon (20261018090000) et raison_bon_panier (20261018110000) avec un seul contrôle de plus, en tête.
create or replace function prive.raison_bon(b bons, c commandes) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  bo boutiques%rowtype;
  plafond integer;
begin
  if b.boutique_origine = c.boutique_id and b.utilisable_des > now() then return 'pas_aujourdhui'; end if; -- US-31.4
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

create or replace function prive.raison_bon_panier(b bons, boutique uuid, lignes jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  bo boutiques%rowtype;
  total integer := prive.montant_panier(boutique, lignes, null);
  plafond integer;
begin
  if b.boutique_origine = boutique and b.utilisable_des > now() then return 'pas_aujourdhui'; end if; -- US-31.4
  select * into bo from boutiques x where x.id = boutique;
  if b.programme_id is null then
    if total < b.minimum_achat then return 'minimum'; end if;
  elsif prive.montant_panier(boutique, lignes, b.univers) < b.minimum_achat then
    return case when b.univers is not null and total >= b.minimum_achat then 'univers' else 'minimum' end;
  end if;
  if cardinality(b.villes) > 0 and not (bo.ville = any (b.villes)) then return 'ville'; end if;
  if not coalesce(bo.bons_acceptes, false) then return 'boutique_exclue'; end if;
  if b.programme_id is not null then
    select p.plafond_par_boutique into plafond from programmes_bons p where p.id = b.programme_id;
    if plafond is not null and (select count(*) from bons x join commandes y on y.id = x.commande_id
                                where x.programme_id = b.programme_id and x.statut in ('reserve', 'utilise')
                                  and y.boutique_id = boutique) >= plafond then
      return 'plafond_boutique';
    end if;
  end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Relevé : la part de la boutique d'origine n'est pas remboursée
-- ---------------------------------------------------------------------------
-- Copie de bons_apres_statut (20261018090000) : seule la ligne de relevé reçoit part_boutique.
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
                                   numero_commande, total_commande, client, origine, programme_id, part_boutique)
        values (releve, b.id, new.id, new.boutique_id, new.remise_bon, coalesce(new.terminee_le, now()), new.mode_remise,
                new.numero, new.total, prive.prenom_initiale(new.client_nom), b.origine, b.programme_id,
                case when b.boutique_origine = new.boutique_id then least(b.part_boutique, new.remise_bon - 1) else 0 end);
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

-- Montant du relevé = ce que BleDeal rembourse (sans la part de la boutique d'origine).
create or replace function prive.recalculer_releve(releve uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update releves_bons r set
    nombre = (select count(*) from lignes_releve l where l.releve_id = r.id and l.statut = 'a_rembourser'),
    montant = (select coalesce(sum(l.montant - l.part_boutique), 0) from lignes_releve l where l.releve_id = r.id and l.statut = 'a_rembourser')
  where r.id = releve and r.statut <> 'paye';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Lectures : « Mes bons », compteur de l'espace, administration
-- ---------------------------------------------------------------------------
-- Copie de mes_bons (20261018090000) avec utilisable_des et le nom de la boutique d'origine.
create or replace function public.mes_bons() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'montant', b.montant, 'statut', b.statut, 'origine', b.origine, 'cree_le', b.cree_le,
      'expire_le', b.expire_le, 'utilise_le', b.utilise_le,
      'commande', case when b.statut in ('reserve', 'utilise') then b.commande_id end,
      'numero', case when b.statut in ('reserve', 'utilise') then c.numero end,
      'boutique', case when b.statut = 'utilise' then bo.nom end,
      'minimum_achat', b.minimum_achat, 'univers', b.univers, 'villes', to_jsonb(b.villes),
      'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar,
      'utilisable_des', b.utilisable_des, 'boutique_origine', o.nom)
    order by case b.statut when 'disponible' then 0 when 'reserve' then 1 when 'en_file' then 2 else 3 end, b.expire_le nulls last, b.cree_le desc), '[]'::jsonb)
  from bons b
  left join commandes c on c.id = b.commande_id
  left join boutiques bo on bo.id = c.boutique_id
  left join programmes_bons p on p.id = b.programme_id
  left join boutiques o on o.id = b.boutique_origine
  where b.profil_id = auth.uid()
$$;

-- Compteur de l'espace (US-31.3) : en plus, les clients inscrits en boutique et, quand le programme est actif, les
-- bons d'inscription du mois avec le plafond et la part de la boutique. Toujours des nombres, jamais de liste.
create or replace function public.abonnes_boutique() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ma uuid := prive.ma_boutique();
  p programmes_bons%rowtype;
  actif boolean;
begin
  if ma is null then
    raise exception 'Réservé aux commerçants.' using errcode = '42501';
  end if;
  select * into p from programmes_bons x where x.type = 'inscription_boutique';
  actif := found and prive.programme_ouvert(p);
  return (select jsonb_build_object('total', count(*), 'sept_jours', count(*) filter (where a.cree_le > now() - interval '7 days'),
            'inscrits', (select count(*) from inscriptions_boutique i where i.boutique_id = ma),
            'bons_inscription_mois', case when actif then prive.bons_inscription_mois(ma) end,
            'plafond_inscriptions_mois', case when actif then p.plafond_inscriptions_mois end,
            'montant_bon_inscription', case when actif then p.montant end,
            'part_boutique', case when actif then p.part_boutique end)
          from abonnements_boutique a where a.boutique_id = ma);
end $$;

-- Copie de programmes_admin (20261018130000) : part de la boutique, plafond d'inscriptions, remboursé sans la part.
create or replace function public.programmes_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'type', p.type, 'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar, 'code', p.code, 'montant', p.montant,
      'minimum_achat', p.minimum_achat, 'univers', p.univers, 'villes', to_jsonb(p.villes), 'debut', p.debut, 'fin', p.fin,
      'validite_jours', p.validite_jours, 'budget', p.budget, 'plafond_par_boutique', p.plafond_par_boutique, 'actif', p.actif,
      'ouvert', prive.programme_ouvert(p),
      'part_boutique', p.part_boutique, 'plafond_inscriptions_mois', p.plafond_inscriptions_mois,
      'emis', (select count(*) from bons b where b.programme_id = p.id and b.statut <> 'annule'),
      'utilises', (select count(*) from bons b where b.programme_id = p.id and b.statut = 'utilise'),
      'rembourse', (select coalesce(sum(l.montant - l.part_boutique), 0) from lignes_releve l where l.programme_id = p.id and l.statut = 'a_rembourser'),
      'restant', prive.budget_programme_restant(p.id))
    order by p.actif desc, p.cree_le desc), '[]'::jsonb)
    from programmes_bons p);
end $$;

-- Signaux des inscriptions en boutique (90 derniers jours), par boutique ; jamais bloquants, l'admin décide :
--   inscrits : comptes rattachés ; sans_commande : rattachés depuis plus de 7 jours sans aucune commande ;
--   jamais_ailleurs : rattachés qui ont récupéré des commandes seulement dans la boutique d'origine ;
--   remises_rapides : commandes avec un bon d'inscription récupérées moins de 30 minutes après leur création ;
--   meme_minute : inscriptions faites dans une minute où la boutique en a eu au moins 3.
create or replace function public.signaux_inscriptions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  return (with ins as (
      select i.profil_id, i.boutique_id, i.cree_le from inscriptions_boutique i where i.cree_le > now() - interval '90 days'),
    minutes as (
      select i.boutique_id, date_trunc('minute', i.cree_le) as minute, count(*) as n from ins i group by 1, 2),
    par_boutique as (
      select bo.id, bo.nom, bo.slug,
        (select count(*) from ins i where i.boutique_id = bo.id) as inscrits,
        (select count(*) from ins i where i.boutique_id = bo.id and i.cree_le < now() - interval '7 days'
           and not exists (select 1 from commandes c where c.client_id = i.profil_id)) as sans_commande,
        (select count(*) from ins i where i.boutique_id = bo.id
           and exists (select 1 from commandes c where c.client_id = i.profil_id and c.statut = 'recuperee' and c.boutique_id = bo.id)
           and not exists (select 1 from commandes c where c.client_id = i.profil_id and c.statut = 'recuperee' and c.boutique_id <> bo.id)) as jamais_ailleurs,
        (select count(*) from bons b join commandes c on c.id = b.commande_id
           where b.origine = 'inscription_boutique' and b.statut = 'utilise' and c.boutique_id = bo.id
             and c.terminee_le < c.cree_le + interval '30 minutes' and c.cree_le > now() - interval '90 days') as remises_rapides,
        (select coalesce(sum(m.n), 0) from minutes m where m.boutique_id = bo.id and m.n >= 3) as meme_minute
      from boutiques bo where bo.id in (select boutique_id from ins))
    select coalesce(jsonb_agg(jsonb_build_object('boutique_id', b.id, 'boutique', b.nom, 'slug', b.slug, 'inscrits', b.inscrits,
        'sans_commande', b.sans_commande, 'jamais_ailleurs', b.jamais_ailleurs, 'remises_rapides', b.remises_rapides,
        'meme_minute', b.meme_minute) order by b.inscrits desc, b.nom), '[]'::jsonb)
    from par_boutique b);
end $$;
revoke execute on function public.signaux_inscriptions() from public, anon;
grant execute on function public.signaux_inscriptions() to authenticated;

revoke execute on function prive.lendemain_alger(timestamptz), prive.bons_inscription_mois(uuid),
  prive.donner_bon_inscription(uuid), prive.bon_inscription_rattachement(), prive.bon_inscription_numero_verifie(),
  prive.bon_inscription_filleul(),
  prive.offre_inscription_ouverte(uuid)
  from public, anon, authenticated;

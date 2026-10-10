-- Relecture n°6, point 2 : le code à 4 chiffres pouvait être deviné par la boutique (10 000 possibilités, aucune limite).
-- a) Limite d'essais par boutique : après 10 codes faux en 15 minutes, la saisie du code est refusée pendant 15 minutes
--    (retrait_boutique et remettre_commande, tous deux par prive.chercher_retrait). Le QR code (jeton de 128 bits) n'est
--    pas concerné et le compte de la boutique n'est pas bloqué. remettre_commande et retrait_boutique ne changent pas.
-- b) Le parrainage n'est validé, et le bon n'est déduit et remboursé, que sur une remise par QR code (mode_remise = 'qr').
--    Remise par code : comme « Remis sans QR code » (parrainage non_valide, motif remise_sans_qr_code ; bon rendu au client).
-- Aucune règle de blocage, de no-show, de numéro vérifié, de statut ou de stock ne change.

-- ---------------------------------------------------------------------------
-- a) Codes faux par boutique
-- ---------------------------------------------------------------------------
create table prive.essais_code_retrait (
  id bigint generated always as identity primary key,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  le timestamptz not null default now()
);
create index essais_code_retrait_boutique on prive.essais_code_retrait (boutique_id, le);
alter table prive.essais_code_retrait enable row level security;
revoke all on prive.essais_code_retrait from public, anon, authenticated;

create table prive.blocages_code_retrait (
  boutique_id uuid primary key references public.boutiques(id) on delete cascade,
  jusqu_a timestamptz not null
);
alter table prive.blocages_code_retrait enable row level security;
revoke all on prive.blocages_code_retrait from public, anon, authenticated;

-- Même fonction que 20261011110000_retrait_qr.sql ; seule la branche « code » change.
create or replace function prive.chercher_retrait(jeton text, code text, verrouiller boolean)
returns table (commande_id uuid, etat text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  ma uuid := prive.ma_boutique();
  trouve uuid;
  c commandes%rowtype;
begin
  if auth.uid() is null or ma is null then
    raise exception 'Connectez-vous à votre espace boutique.' using errcode = '42501';
  end if;
  if (jeton is null) = (code is null) then
    raise exception 'Donnez le QR code ou le code à 4 chiffres.' using errcode = '22023';
  end if;
  if jeton is not null then
    if jeton ~ '^[A-Za-z0-9_-]{22}$' then
      select r.commande_id into trouve from prive.retraits r where r.jeton = jeton and r.boutique_id = ma;
    end if;
  else
    -- Un essai à la fois par boutique : 10 essais en parallèle ne passent pas tous avant le blocage.
    perform pg_advisory_xact_lock(hashtextextended('bledeal:code_retrait:' || ma::text, 0));
    if exists (select 1 from prive.blocages_code_retrait b where b.boutique_id = ma and b.jusqu_a > now()) then
      raise exception 'Trop de codes faux : la saisie du code est bloquée 15 minutes. Scannez le QR code du client.'
        using errcode = '54000';
    end if;
    if code ~ '^[0-9]{4}$' then
      select r.commande_id into trouve from prive.retraits r where r.boutique_id = ma and r.code = code and r.actif;
    end if;
    if trouve is null then
      delete from prive.essais_code_retrait e where e.boutique_id = ma and e.le < now() - interval '15 minutes';
      insert into prive.essais_code_retrait (boutique_id) values (ma);
      if (select count(*) from prive.essais_code_retrait e where e.boutique_id = ma) >= 10 then
        insert into prive.blocages_code_retrait (boutique_id, jusqu_a) values (ma, now() + interval '15 minutes')
        on conflict (boutique_id) do update set jusqu_a = excluded.jusqu_a;
        delete from prive.essais_code_retrait e where e.boutique_id = ma;
      end if;
    end if;
  end if;
  if trouve is null then
    return query select null::uuid, 'invalide'::text;
    return;
  end if;
  if verrouiller then
    select * into c from commandes x where x.id = trouve for update;
  else
    select * into c from commandes x where x.id = trouve;
  end if;
  if c.boutique_id is distinct from ma then
    return query select null::uuid, 'invalide'::text;
    return;
  end if;
  return query select c.id, case
    when c.statut = 'prete' and c.expire_le > now() then 'ok'
    when c.statut = 'recuperee' then 'deja_remise'
    when c.statut = 'annulee' then 'annulee'
    else 'expiree' end;
end $$;
revoke execute on function prive.chercher_retrait(text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- b) Parrainage et bons : QR code seulement
-- ---------------------------------------------------------------------------
-- Même fonction que 20261012090000_parrainage.sql ; seule la condition du mode de remise change.
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
    when c.mode_remise is distinct from 'qr' then 'remise_sans_qr_code'
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

-- Même fonction que 20261012090000_parrainage.sql ; seule la condition du mode de remise change.
-- Suit la commande : bon rendu (annulée, expirée, remise sans QR code ou par code), bon utilisé et ligne de relevé
-- (remise par QR code), validation du parrainage (première commande récupérée).
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

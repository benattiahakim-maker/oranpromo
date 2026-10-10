-- US-32.5 : petit bon pour chaque avis (après US-33). docs/user-stories.md, module 18 ; docs/architecture.md,
-- « Avis clients sur les boutiques (US-32) », Récompense. Décisions du propriétaire (10/10 à 9 h 24) : bon « avis » de
-- 150 DA dès 1 500 DA d'achat, 30 jours, quelle que soit la note ; au plus 2 bons « avis » par mois et par numéro
-- vérifié ; budget mensuel séparé (0 = arrêt) ; numéro vérifié obligatoire ; pas de bon si l'avis porte sur la boutique
-- à laquelle le client a été rattaché le jour même (US-31) ; masquer un avis ne reprend pas le bon.
--
-- Écart voulu avec US-33 : prive.donner_bon_programme donne UN bon par numéro et par programme (prive.numeros_programmes).
-- Ici chaque avis donne un bon : fonction d'attribution à part, prive.donner_bon_avis, avec sa propre trace
-- (prive.bons_avis : un bon par avis, plafond par numéro et par mois). Budget du programme « avis » = budget DU MOIS
-- (heure d'Alger), compté sur les bons d'origine « avis » de ce programme (sauf annulés).
-- Le bon s'utilise comme tous les bons de programme : utiliser_bon, raison_bon, remise par QR code seulement, relevé.
-- Ce qui ne change pas : donner_bon_programme, numeros_programmes, utiliser_bon, raison_bon, passer_commande,
-- changer_statut_commande, relevés, blocage, no-shows, vérification du numéro, règles de l'avis lui-même.

-- ---------------------------------------------------------------------------
-- 1. Programme « avis » (un seul) : créé par le propriétaire avec le budget du mois (valeurs décidées le 10/10 ici).
-- ---------------------------------------------------------------------------
-- Pas de programme créé par la migration : tant que le propriétaire n'a pas fixé le budget, aucun bon, aucune mention.
-- Éditeur SQL Supabase : select prive.regler_bon_avis(<budget du mois en DA>);  (0 = arrêt ; « Arrêter » de /admin/bons aussi).
create unique index programmes_bons_un_avis on public.programmes_bons (type) where type = 'avis';

create or replace function prive.regler_bon_avis(budget integer) returns public.programmes_bons
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  p public.programmes_bons%rowtype;
begin
  if budget is null or budget < 0 then raise exception 'Budget du mois en DA, 0 pour arrêter.' using errcode = '22023'; end if;
  insert into public.programmes_bons (type, nom_fr, nom_ar, montant, minimum_achat, validite_jours, budget, actif)
  values ('avis', 'Avis', 'راي', 150, 1500, 30, budget, budget > 0)
  on conflict (type) where type = 'avis' do update set budget = excluded.budget, actif = excluded.actif
  returning * into p;
  return p;
end $$;
revoke execute on function prive.regler_bon_avis(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trace : un bon par avis ; empreinte du numéro gardée (plafond par mois même si le compte disparaît)
-- ---------------------------------------------------------------------------
create table prive.bons_avis (
  avis_id uuid primary key,
  bon_id uuid references public.bons(id) on delete set null,
  empreinte text not null,
  le timestamptz not null default now()
);
create index bons_avis_empreinte_idx on prive.bons_avis (empreinte, le);
revoke all on prive.bons_avis from public, anon, authenticated;

-- Budget du mois restant du programme « avis » : budget − bons « avis » du mois (sauf annulés). Un bon expiré reste compté.
create or replace function prive.budget_avis_restant(p public.programmes_bons) returns integer
language sql stable security definer set search_path = '' as $$
  select p.budget - coalesce((select sum(b.montant) from public.bons b
    where b.programme_id = p.id and b.origine = 'avis' and b.statut <> 'annule'
      and prive.mois_alger(b.cree_le) = prive.mois_alger()), 0)::integer
$$;

-- ---------------------------------------------------------------------------
-- 3. Attribution : un bon par avis (interne, appelée par donner_avis)
-- ---------------------------------------------------------------------------
-- Résultat : le montant du bon donné, ou null (programme fermé, budget du mois épuisé, pas de numéro vérifié,
-- plafond de 2 par mois atteint, client rattaché à cette boutique le jour même, avis déjà récompensé).
create or replace function prive.donner_bon_avis(avis uuid) returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  a public.avis%rowtype;
  p public.programmes_bons%rowtype;
  numero text;
  empreinte_compte text;
  nouveau uuid;
begin
  select * into p from public.programmes_bons x where x.type = 'avis';
  if not found then return null; end if;
  -- Même verrou que donner_bon_programme : budget et plafond comptés sans course.
  perform pg_advisory_xact_lock(hashtextextended('oranpromo:programme:' || p.id::text, 0));
  select * into p from public.programmes_bons x where x.id = p.id;
  if not prive.programme_ouvert(p) then return null; end if;
  select * into a from public.avis x where x.id = avis;
  if not found or a.client_id is null then return null; end if;
  if exists (select 1 from prive.bons_avis t where t.avis_id = a.id) then return null; end if;
  select pr.telephone into numero from public.profils pr
  where pr.id = a.client_id and pr.telephone_verifie_le is not null and pr.telephone is not null;
  if numero is null then return null; end if;
  empreinte_compte := prive.empreinte_numero(numero);
  if (select count(*) from prive.bons_avis t where t.empreinte = empreinte_compte and prive.mois_alger(t.le) = prive.mois_alger()) >= 2 then
    return null;
  end if;
  -- US-31 : rattaché à cette boutique le jour même (jour de la commande ou de l'avis, heure d'Alger) : pas de bon.
  if exists (select 1 from public.inscriptions_boutique i join public.commandes c on c.id = a.commande_id
             where i.profil_id = a.client_id and i.boutique_id = a.boutique_id
               and (i.cree_le at time zone 'Africa/Algiers')::date in ((c.cree_le at time zone 'Africa/Algiers')::date,
                                                                       (a.cree_le at time zone 'Africa/Algiers')::date)) then
    return null;
  end if;
  if prive.budget_avis_restant(p) < p.montant then return null; end if;
  insert into public.bons (profil_id, montant, origine, programme_id, minimum_achat, univers, villes, statut, expire_le)
  values (a.client_id, p.montant, 'avis', p.id, p.minimum_achat, p.univers, p.villes, 'disponible',
          least(coalesce(p.fin, 'infinity'::timestamptz), now() + make_interval(days => p.validite_jours)))
  returning id into nouveau;
  insert into prive.bons_avis (avis_id, bon_id, empreinte) values (a.id, nouveau, empreinte_compte);
  return p.montant;
end $$;
revoke execute on function prive.budget_avis_restant(public.programmes_bons), prive.donner_bon_avis(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. donner_avis : mêmes contrôles qu'en US-32.1 (inchangés) ; renvoie aussi le montant du bon (ou null)
-- ---------------------------------------------------------------------------
create or replace function public.donner_avis(commande uuid, note integer, criteres text[] default '{}',
  commentaire text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  c public.commandes%rowtype;
  liste text[] := coalesce(criteres, '{}');
  texte text := nullif(btrim(coalesce(commentaire, '')), '');
  nouvel uuid;
  bon integer;
begin
  if compte is null then
    raise exception 'Connectez-vous pour donner votre avis.' using errcode = '42501';
  end if;
  select * into c from public.commandes x where x.id = commande and x.client_id = compte for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if c.statut <> 'recuperee' or c.mode_remise is distinct from 'qr' then
    raise exception 'Un avis est possible seulement sur une commande récupérée avec votre QR code.' using errcode = '22023';
  end if;
  if c.terminee_le is null or c.terminee_le < now() - interval '14 days' then
    raise exception 'Le délai de 14 jours pour donner votre avis est dépassé.' using errcode = '22023';
  end if;
  if exists (select 1 from public.avis a where a.commande_id = c.id) then
    raise exception 'Vous avez déjà donné votre avis sur cette commande.' using errcode = '23505';
  end if;
  if exists (select 1 from public.profils p where p.id = compte and p.boutique_id = c.boutique_id) then
    raise exception 'Vous ne pouvez pas donner un avis sur votre propre boutique.' using errcode = '42501';
  end if;
  if note is null or note not between 1 and 5 then
    raise exception 'Choisissez une note de 1 à 5 étoiles.' using errcode = '22023';
  end if;
  if not (liste <@ array['accueil', 'article_conforme', 'rapidite']::text[])
     or cardinality(liste) <> (select count(distinct x) from unnest(liste) x) then
    raise exception 'Critère inconnu.' using errcode = '22023';
  end if;
  if texte is not null and char_length(texte) > 300 then
    raise exception 'Le commentaire doit contenir 300 caractères au plus.' using errcode = '22023';
  end if;
  if prive.contenu_interdit(texte) then
    raise exception 'Votre commentaire ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.' using errcode = '22023';
  end if;
  insert into public.avis (commande_id, boutique_id, client_id, note, criteres, commentaire)
  values (c.id, c.boutique_id, compte, note,
          array(select x from unnest(array['accueil', 'article_conforme', 'rapidite']) x where x = any (liste)), texte)
  returning id into nouvel;
  -- US-32.5 : petit bon « avis », quelle que soit la note. Une erreur imprévue n'empêche jamais l'avis (bloc à part).
  begin
    bon := prive.donner_bon_avis(nouvel);
  exception when others then
    raise warning 'bon avis : %', sqlerrm;
    bon := null;
  end;
  return jsonb_build_object('avis', nouvel, 'bon', bon);
end $$;
revoke execute on function public.donner_avis(uuid, integer, text[], text) from public, anon;
grant execute on function public.donner_avis(uuid, integer, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Mention publique (texte n° 11) : récompense active = programme ouvert et budget du mois suffisant
-- ---------------------------------------------------------------------------
create or replace function public.recompense_avis() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('montant', p.montant, 'minimum', p.minimum_achat)
  from public.programmes_bons p
  where p.type = 'avis' and prive.programme_ouvert(p) and prive.budget_avis_restant(p) >= p.montant
$$;
revoke execute on function public.recompense_avis() from public;
grant execute on function public.recompense_avis() to anon, authenticated;

-- US-33.5 : administration des programmes de bons (/admin/bons) : créer une campagne, l'arrêter, chiffres, signaux.
-- Historique des prix (signal de prix gonflés avant une campagne). Les signaux ne font rien tout seuls : l'admin
-- décide avec « Mettre de côté » / « Refuser » (US-27.5, inchangés).
-- Prépare US-32.5 (BleDeal Dev) : le type de programme et l'origine de bon « avis » sont acceptés ; rien d'autre
-- ne change pour eux (pas de programme « avis » créé ici).
-- Ce qui ne change pas : utiliser_bon, raison_bon, donner_bon_programme, passer_commande, changer_statut_commande,
-- bons après statut, relevés, blocage, no-shows, numéro.

-- ---------------------------------------------------------------------------
-- 1. Origine « avis » (US-32.5 se branchera dessus : programme de type « avis », bons d'origine « avis »)
-- ---------------------------------------------------------------------------
alter table public.programmes_bons drop constraint programmes_bons_type_check;
alter table public.programmes_bons add constraint programmes_bons_type_check check (type in ('bienvenue', 'campagne', 'avis'));
alter table public.bons drop constraint bons_origine_check;
alter table public.bons add constraint bons_origine_check
  check (origine in ('parrainage_filleul', 'parrainage_parrain', 'bienvenue', 'campagne', 'avis'));

-- ---------------------------------------------------------------------------
-- 2. Historique des prix (lecture admin seulement, par les fonctions ci-dessous)
-- ---------------------------------------------------------------------------
create table prive.historique_prix (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  ancien_prix integer,
  nouveau_prix integer not null,
  promo boolean not null default false,
  le timestamptz not null default now()
);
create index historique_prix_article_idx on prive.historique_prix (article_id, le);

create or replace function prive.noter_prix() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'articles' then
    if new.prix is distinct from old.prix then
      insert into prive.historique_prix (article_id, ancien_prix, nouveau_prix) values (new.id, old.prix, new.prix);
    end if;
  elsif tg_op = 'INSERT' or new.prix_promo is distinct from old.prix_promo then
    insert into prive.historique_prix (article_id, ancien_prix, nouveau_prix, promo)
    values (new.article_id, case when tg_op = 'UPDATE' then old.prix_promo end, new.prix_promo, true);
  end if;
  return null;
exception when others then
  raise warning 'historique des prix : %', sqlerrm;  -- jamais d'échec de la modification d'un article à cause du signal
  return null;
end $$;
create trigger z_historique_prix after update of prix on public.articles for each row execute function prive.noter_prix();
create trigger z_historique_prix_promo after insert or update of prix_promo on public.promos for each row execute function prive.noter_prix();
revoke execute on function prive.noter_prix() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Créer une campagne, arrêter un programme (admin)
-- ---------------------------------------------------------------------------
create or replace function public.creer_campagne(nom_fr text, nom_ar text, code text, montant integer, minimum_achat integer,
  univers text, villes text[], debut timestamptz, fin timestamptz, validite_jours integer, budget integer, plafond_par_boutique integer)
returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  saisi text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g'));
  liste text[] := coalesce(villes, '{}');
  nouveau uuid;
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  if fin is null then
    raise exception 'Indiquez la date de fin de la campagne.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(liste) v where not exists (select 1 from public.villes x where x.code = v)) then
    raise exception 'Ville inconnue.' using errcode = '22023';
  end if;
  if exists (select 1 from programmes_bons p where p.code = saisi) then
    raise exception 'Ce code existe déjà.' using errcode = '23505';
  end if;
  insert into programmes_bons (type, nom_fr, nom_ar, code, montant, minimum_achat, univers, villes, debut, fin, validite_jours,
                               budget, plafond_par_boutique, actif, cree_par)
  values ('campagne', btrim(nom_fr), btrim(nom_ar), saisi, montant, minimum_achat, nullif(univers, ''), liste,
          coalesce(debut, now()), fin, coalesce(validite_jours, 30), coalesce(budget, 0), plafond_par_boutique, true, auth.uid())
  returning id into nouveau;
  return nouveau;
end $$;
revoke execute on function public.creer_campagne(text, text, text, integer, integer, text, text[], timestamptz, timestamptz, integer, integer, integer) from public, anon;
grant execute on function public.creer_campagne(text, text, text, integer, integer, text, text[], timestamptz, timestamptz, integer, integer, integer) to authenticated;

-- Arrêter : plus aucun nouveau bon ; les bons déjà donnés restent valables jusqu'à leur échéance.
create or replace function public.arreter_programme(programme uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  update programmes_bons p set actif = false where p.id = programme and p.actif;
  return found;
end $$;
revoke execute on function public.arreter_programme(uuid) from public, anon;
grant execute on function public.arreter_programme(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Chiffres et signaux (admin)
-- ---------------------------------------------------------------------------
-- Par programme : émis (bons non annulés), utilisés, à rembourser ou remboursé (lignes de relevé), budget restant.
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
      'emis', (select count(*) from bons b where b.programme_id = p.id and b.statut <> 'annule'),
      'utilises', (select count(*) from bons b where b.programme_id = p.id and b.statut = 'utilise'),
      'rembourse', (select coalesce(sum(l.montant), 0) from lignes_releve l where l.programme_id = p.id and l.statut = 'a_rembourser'),
      'restant', prive.budget_programme_restant(p.id))
    order by p.actif desc, p.cree_le desc), '[]'::jsonb)
    from programmes_bons p);
end $$;
revoke execute on function public.programmes_admin() from public, anon;
grant execute on function public.programmes_admin() to authenticated;

-- Signaux d'un programme, par boutique où ses bons ont servi (jamais automatiques) :
--   prix : articles dont le prix a augmenté de plus de 20 % dans les 14 jours avant le début (ou pendant la campagne) ;
--   nouveaux : articles créés dans les 14 jours avant le début ;
--   plafond : plafond atteint, avec le nombre de jours depuis le début ;
--   comptes_recents : bons utilisés par des comptes créés moins de 7 jours avant la commande ;
--   remises_rapides : commandes avec un bon du programme récupérées moins de 30 minutes après leur création.
create or replace function public.signaux_bons(programme uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p programmes_bons%rowtype;
begin
  if not prive.est_admin() then
    raise exception 'Réservé à l''administration.' using errcode = '42501';
  end if;
  select * into p from programmes_bons x where x.id = programme;
  if not found then
    return '[]'::jsonb;
  end if;
  return (with servis as (
      select c.boutique_id, c.id as commande, c.cree_le, c.terminee_le, c.statut, c.client_id, b.statut as statut_bon
      from bons b join commandes c on c.id = b.commande_id
      where b.programme_id = p.id and b.statut in ('reserve', 'utilise')),
    boutiques_servies as (select distinct boutique_id from servis),
    par_boutique as (
      select bo.id, bo.nom, bo.slug,
        (select count(distinct h.article_id) from prive.historique_prix h join articles a on a.id = h.article_id
          where a.boutique_id = bo.id and not h.promo and h.ancien_prix > 0 and h.nouveau_prix > h.ancien_prix * 1.2
            and h.le >= p.debut - interval '14 days' and h.le < coalesce(p.fin, now())) as prix,
        (select max(h.le) from prive.historique_prix h join articles a on a.id = h.article_id
          where a.boutique_id = bo.id and not h.promo and h.ancien_prix > 0 and h.nouveau_prix > h.ancien_prix * 1.2
            and h.le >= p.debut - interval '14 days' and h.le < coalesce(p.fin, now())) as prix_le,
        (select count(*) from articles a where a.boutique_id = bo.id and a.cree_le >= p.debut - interval '14 days' and a.cree_le < p.debut) as nouveaux,
        (select count(*) from servis s where s.boutique_id = bo.id) as servis,
        (select s.cree_le from servis s where s.boutique_id = bo.id order by s.cree_le offset greatest(coalesce(p.plafond_par_boutique, 0) - 1, 0) limit 1) as plafond_le,
        (select count(*) from servis s join profils pr on pr.id = s.client_id
          where s.boutique_id = bo.id and pr.cree_le > s.cree_le - interval '7 days') as comptes_recents,
        (select count(*) from servis s where s.boutique_id = bo.id and s.statut = 'recuperee'
          and s.terminee_le < s.cree_le + interval '30 minutes') as remises_rapides
      from boutiques bo where bo.id in (select boutique_id from boutiques_servies))
    select coalesce(jsonb_agg(jsonb_build_object(
        'boutique_id', b.id, 'boutique', b.nom, 'slug', b.slug, 'servis', b.servis,
        'prix', b.prix, 'prix_le', b.prix_le, 'nouveaux', b.nouveaux,
        'plafond', case when p.plafond_par_boutique is not null and b.servis >= p.plafond_par_boutique then p.plafond_par_boutique end,
        'plafond_jours', case when p.plafond_par_boutique is not null and b.servis >= p.plafond_par_boutique
                              then greatest(ceil(extract(epoch from b.plafond_le - p.debut) / 86400), 1)::integer end,
        'comptes_recents', b.comptes_recents, 'remises_rapides', b.remises_rapides)
      order by b.nom), '[]'::jsonb)
    from par_boutique b
    where b.prix > 0 or b.nouveaux > 0 or b.comptes_recents > 0 or b.remises_rapides > 0
       or (p.plafond_par_boutique is not null and b.servis >= p.plafond_par_boutique));
end $$;
revoke execute on function public.signaux_bons(uuid) from public, anon;
grant execute on function public.signaux_bons(uuid) to authenticated;

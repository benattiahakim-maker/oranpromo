-- US-32.4 : réponse publique de la boutique, avis dans l'espace, signalement et modération des avis.
-- docs/user-stories.md, module 18 ; docs/architecture.md, « Avis clients sur les boutiques (US-32) ».
-- Décision du propriétaire (10/10, 9 h 24) : pas de modification d'un avis ni d'une réponse. La boutique ne supprime
-- jamais un avis. Signalement : même limite par visiteur que signaler_article (US-17). Modération : US-18, chaque
-- décision dans decisions. signaler_article, la modération des articles, blocage, no-shows, numéro, statuts : inchangés.

-- ---------------------------------------------------------------------------
-- 1. Réponse masquée par la modération (la réponse reste en base, elle n'est plus lue par le public).
-- ---------------------------------------------------------------------------
alter table public.avis add column reponse_masquee boolean not null default false;

-- Lecture publique : réponse masquée = pas de réponse (même signature qu'en US-32.1).
create or replace function public.avis_boutique(boutique uuid, limite integer default 5, decalage integer default 0)
returns table (id uuid, auteur text, note smallint, criteres text[], commentaire text, mois date, reponse text)
language sql stable security definer set search_path = '' as $$
  select a.id, prive.prenom_initiale(p.nom), a.note, a.criteres, a.commentaire,
         date_trunc('month', a.cree_le at time zone 'Africa/Algiers')::date,
         case when a.reponse_masquee then null else a.reponse end
  from public.avis a
  left join public.profils p on p.id = a.client_id
  where a.boutique_id = boutique and a.statut = 'publie' and prive.avis_lisibles(boutique)
  order by a.cree_le desc, a.id
  limit least(greatest(coalesce(limite, 5), 1), 50) offset greatest(coalesce(decalage, 0), 0)
$$;
revoke execute on function public.avis_boutique(uuid, integer, integer) from public;
grant execute on function public.avis_boutique(uuid, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Réponse de la boutique : une seule, non modifiable, même filtre que les avis.
-- ---------------------------------------------------------------------------
create or replace function prive.boutique_du_commercant() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.boutique_id from public.profils p where p.id = auth.uid() and p.role = 'commercant'
$$;
revoke execute on function prive.boutique_du_commercant() from public, anon, authenticated;

create or replace function public.repondre_avis(avis uuid, texte text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  boutique uuid := prive.boutique_du_commercant();
  a public.avis%rowtype;
  reponse text := nullif(btrim(coalesce(texte, '')), '');
begin
  if boutique is null then
    raise exception 'Réservé à la boutique.' using errcode = '42501';
  end if;
  select * into a from public.avis x where x.id = avis and x.boutique_id = boutique for update;
  if not found or a.statut <> 'publie' then
    raise exception 'Avis introuvable.' using errcode = 'P0002';
  end if;
  if a.reponse is not null then
    raise exception 'Vous avez déjà répondu à cet avis.' using errcode = '23505';
  end if;
  if reponse is null then
    raise exception 'Écrivez votre réponse.' using errcode = '22023';
  end if;
  if char_length(reponse) > 300 then
    raise exception 'La réponse doit contenir 300 caractères au plus.' using errcode = '22023';
  end if;
  if prive.contenu_interdit(reponse) then
    raise exception 'Votre réponse ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.' using errcode = '22023';
  end if;
  update public.avis x set reponse = reponse, reponse_le = now() where x.id = a.id;
end $$;
revoke execute on function public.repondre_avis(uuid, text) from public, anon;
grant execute on function public.repondre_avis(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Avis dans l'espace commerçant (/espace/avis) : avis publiés de sa boutique, sans réponse d'abord.
-- ---------------------------------------------------------------------------
create or replace function public.avis_ma_boutique(limite integer default 50, decalage integer default 0)
returns table (id uuid, auteur text, note smallint, criteres text[], commentaire text, cree_le timestamptz,
               reponse text, reponse_le timestamptz, reponse_masquee boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, prive.prenom_initiale(p.nom), a.note, a.criteres, a.commentaire, a.cree_le, a.reponse, a.reponse_le, a.reponse_masquee
  from public.avis a
  left join public.profils p on p.id = a.client_id
  where a.boutique_id = prive.boutique_du_commercant() and a.statut = 'publie'
  order by (a.reponse is null) desc, a.cree_le desc, a.id
  limit least(greatest(coalesce(limite, 50), 1), 100) offset greatest(coalesce(decalage, 0), 0)
$$;
revoke execute on function public.avis_ma_boutique(integer, integer) from public, anon;
grant execute on function public.avis_ma_boutique(integer, integer) to authenticated;

-- « ★ 4,6 · 18 avis · 2 sans réponse » (moyenne vide sous le seuil, comme pour le public).
create or replace function public.resume_ma_boutique()
returns table (nombre integer, moyenne numeric, sans_reponse integer)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer,
         case when count(*) >= prive.seuil_avis() then round(avg(a.note), 1) end,
         (count(*) filter (where a.reponse is null))::integer
  from public.avis a
  where a.boutique_id = prive.boutique_du_commercant() and a.statut = 'publie'
$$;
revoke execute on function public.resume_ma_boutique() from public, anon;
grant execute on function public.resume_ma_boutique() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Signalements d'avis (client, visiteur ou boutique) : écrits seulement par signaler_avis().
-- ---------------------------------------------------------------------------
create table public.signalements_avis (
  id uuid primary key default gen_random_uuid(),
  avis_id uuid not null references public.avis (id) on delete cascade,
  motif text not null check (motif in ('faux_avis', 'insulte', 'informations_personnelles', 'autre')),
  commentaire text check (commentaire is null or char_length(commentaire) between 1 and 1000),
  statut public.statut_signalement not null default 'ouvert',
  cree_le timestamptz not null default now()
);
create index signalements_avis_avis_idx on public.signalements_avis (avis_id, cree_le);
create index signalements_avis_ouverts_idx on public.signalements_avis (statut, cree_le);
comment on table public.signalements_avis is 'US-32.4 : signalements d''avis. Écriture : signaler_avis() ; lecture : admin ; traitement : moderer_avis().';
alter table public.signalements_avis enable row level security;
revoke all on public.signalements_avis from anon, authenticated;
grant select on public.signalements_avis to authenticated;
create policy "admin lit les signalements d'avis" on public.signalements_avis for select to authenticated using ((select prive.est_admin()));

create or replace function public.signaler_avis(jeton text, visiteur text, avis uuid, motif text, commentaire text default null)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  cle text;
  texte text := nullif(btrim(coalesce(commentaire, '')), '');
begin
  perform prive.verifier_jeton_visiteurs(jeton);
  cle := prive.cle_visiteur(visiteur);
  if motif is null or motif not in ('faux_avis', 'insulte', 'informations_personnelles', 'autre') then
    raise exception 'Choisissez un motif.' using errcode = '22023';
  end if;
  if texte is not null and char_length(texte) > 1000 then
    raise exception 'Le commentaire doit contenir 1000 caractères au plus.' using errcode = '22023';
  end if;
  if avis is null or not exists (select 1 from public.avis a where a.id = avis and a.statut = 'publie' and prive.avis_lisibles(a.boutique_id)) then
    raise exception 'Cet avis n''est plus en ligne.' using errcode = '22023';
  end if;
  delete from prive.actions_visiteurs a where a.date < now() - interval '1 day';
  if exists (select 1 from prive.actions_visiteurs a where a.visiteur = cle and a.action = 'signalement_avis'
             and a.cible = avis::text and a.date > now() - interval '1 day') then
    raise exception 'Vous avez déjà signalé cet avis, merci. Il sera examiné rapidement.' using errcode = '54000';
  end if;
  -- Même limite que signaler_article : 5 signalements par heure et par visiteur (articles et avis ensemble).
  if (select count(*) from prive.actions_visiteurs a where a.visiteur = cle and a.action in ('signalement', 'signalement_avis')
      and a.date > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de signalements envoyés : réessayez dans une heure.' using errcode = '54000';
  end if;
  if (select count(*) from public.signalements_avis s where s.avis_id = avis and s.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Cet avis a déjà été signalé plusieurs fois, merci. Il sera examiné rapidement.' using errcode = '54000';
  end if;
  if (select count(*) from public.signalements_avis s where s.cree_le > now() - interval '1 hour') >= 200 then
    raise exception 'Trop de signalements en ce moment, réessayez plus tard.' using errcode = '54000';
  end if;
  insert into public.signalements_avis (avis_id, motif, commentaire) values (avis, motif, texte);
  insert into prive.actions_visiteurs (visiteur, action, cible) values (cle, 'signalement_avis', avis::text);
end $$;
revoke execute on function public.signaler_avis(text, text, uuid, text, text) from public;
grant execute on function public.signaler_avis(text, text, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Décisions : une décision vise un signalement d'article OU un signalement d'avis.
-- ---------------------------------------------------------------------------
alter table public.decisions alter column signalement_id drop not null;
alter table public.decisions add column signalement_avis_id uuid references public.signalements_avis (id) on delete cascade;
alter table public.decisions add constraint decisions_une_cible check (num_nonnulls(signalement_id, signalement_avis_id) = 1);
create index decisions_signalement_avis_idx on public.decisions (signalement_avis_id);

-- Modération d'un avis (admin), en une transaction : effet, décisions, signalements clos. Seuls les signalements vus
-- par l'admin sont traités (jamais ceux arrivés après).
create or replace function public.moderer_avis(avis uuid, action text, signalements uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  admin uuid := auth.uid();
  a public.avis%rowtype;
  selection uuid[] := array(select distinct x from unnest(coalesce(signalements, '{}')) x where x is not null);
begin
  if admin is null or not prive.est_admin() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  if action is null or action not in ('masquer_avis', 'masquer_reponse', 'classer_signalement_avis') then
    raise exception 'Choisissez une action valide.' using errcode = '22023';
  end if;
  if cardinality(selection) = 0 then
    raise exception 'Aucun signalement à traiter.' using errcode = '22023';
  end if;
  select * into a from public.avis x where x.id = avis for update;
  if not found then
    raise exception 'Cet avis est introuvable. Actualisez la page.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.signalements_avis s where s.id = any (selection) and s.avis_id = a.id and s.statut = 'ouvert') <> cardinality(selection) then
    raise exception 'Ces signalements ont changé. Actualisez la page avant de continuer.' using errcode = '22023';
  end if;
  if action = 'masquer_avis' then
    update public.avis x set statut = 'masque' where x.id = a.id;
  elsif action = 'masquer_reponse' then
    if a.reponse is null then
      raise exception 'Cet avis n''a pas de réponse.' using errcode = '22023';
    end if;
    update public.avis x set reponse_masquee = true where x.id = a.id;
  end if;
  insert into public.decisions (signalement_avis_id, action, auteur_id) select s, action, admin from unnest(selection) s;
  update public.signalements_avis s set statut = case when action = 'classer_signalement_avis' then 'rejete' else 'traite' end::public.statut_signalement
  where s.id = any (selection);
end $$;
revoke execute on function public.moderer_avis(uuid, text, uuid[]) from public, anon;
grant execute on function public.moderer_avis(uuid, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Signal de fraude (admin, jamais automatique ni bloquant) : avis 5 étoiles des 7 derniers jours venant de comptes
--    créés moins de 7 jours avant l'avis, par boutique, à partir de 3 (seuil d'affichage des notes).
-- ---------------------------------------------------------------------------
create or replace function public.signaux_avis()
returns table (boutique_id uuid, boutique text, cinq_etoiles_comptes_recents integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_admin() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  return query
  select b.id, b.nom, count(*)::integer
  from public.avis a
  join public.boutiques b on b.id = a.boutique_id
  join public.profils p on p.id = a.client_id
  where a.statut = 'publie' and a.note = 5 and a.cree_le > now() - interval '7 days'
    and p.cree_le > a.cree_le - interval '7 days'
  group by b.id, b.nom
  having count(*) >= 3
  order by count(*) desc, b.nom;
end $$;
revoke execute on function public.signaux_avis() from public, anon;
grant execute on function public.signaux_avis() to authenticated;

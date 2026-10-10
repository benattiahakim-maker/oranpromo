-- US-32.1 : avis clients sur les boutiques (base, aucun écran). docs/user-stories.md, module 18 ; docs/architecture.md,
-- « Avis clients sur les boutiques (US-32) ». Décisions du propriétaire (10/10, 9 h 24) : avis seulement après un retrait
-- par QR code, dans les 14 jours ; moyenne affichée à partir de 3 avis ; pas de modification d'un avis.
-- Blocage, no-shows, contestation, vérification du numéro, statuts, passer_commande, changer_statut_commande et
-- remettre_commande : inchangés (aucune fonction existante n'est modifiée). Un avis ne change jamais une commande.

-- ---------------------------------------------------------------------------
-- 1. Table des avis : un avis par commande. Écriture par donner_avis() seulement ; lecture publique par fonctions.
-- ---------------------------------------------------------------------------
create table public.avis (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null unique references public.commandes (id) on delete cascade,
  boutique_id uuid not null references public.boutiques (id) on delete cascade,
  client_id uuid not null references public.profils (id) on delete cascade,
  note smallint not null check (note between 1 and 5),
  criteres text[] not null default '{}'
    check (criteres <@ array['accueil', 'article_conforme', 'rapidite']::text[] and cardinality(criteres) <= 3),
  commentaire text check (commentaire is null or char_length(commentaire) between 1 and 300),
  statut text not null default 'publie' check (statut in ('publie', 'masque')),
  cree_le timestamptz not null default now(),
  reponse text check (reponse is null or char_length(reponse) between 1 and 300),
  reponse_le timestamptz,
  constraint avis_reponse_datee check ((reponse is null) = (reponse_le is null))
);
create index avis_boutique_idx on public.avis (boutique_id, statut, cree_le desc);
create index avis_client_idx on public.avis (client_id);
comment on table public.avis is 'US-32 : un avis par commande récupérée par QR code. Le client lit les siens, l''admin tout ; écriture : fonctions seulement ; lecture publique : avis_boutique(), resume_avis().';

alter table public.avis enable row level security;
revoke all on public.avis from anon, authenticated;
grant select on public.avis to authenticated;
create policy "client lit ses avis" on public.avis for select to authenticated using (client_id = (select auth.uid()));
create policy "admin lit les avis" on public.avis for select to authenticated using ((select prive.est_admin()));

-- ---------------------------------------------------------------------------
-- 2. Filtre de contenu : lien, numéro de téléphone (8 chiffres ou plus), mot interdit.
-- ---------------------------------------------------------------------------
-- Mots en minuscules, sans accents. Liste de départ courte (français, darja en lettres latines et en arabe) ;
-- tenue par l'admin dans l'éditeur SQL : insert into prive.mots_interdits (mot) values ('…');
create table prive.mots_interdits (
  mot text primary key check (mot = lower(mot) and mot !~ '\s' and char_length(mot) between 2 and 40)
);
revoke all on prive.mots_interdits from public, anon, authenticated;
insert into prive.mots_interdits (mot) values
  ('connard'), ('connards'), ('connasse'), ('salope'), ('salopes'), ('pute'), ('putes'), ('encule'), ('encules'),
  ('enculer'), ('batard'), ('batards'), ('fdp'), ('ntm'), ('nique'), ('niquer'), ('pd'),
  ('zebi'), ('zabi'), ('kahba'), ('qahba'), ('9ahba'), ('zamel'), ('nik'), ('nikmok'), ('mnayek'),
  ('قحبة'), ('زبي'), ('زامل'), ('نيك'), ('نيكمك');

-- Texte comparé : minuscules, sans accents français, chiffres arabes (٠-٩) ramenés à 0-9.
create or replace function prive.texte_normalise(texte text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(texte, '')),
    'àâäáãçéèêëíìîïñóòôöõúùûüÿœ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    'aaaaaceeeeiiiinooooouuuuyœ01234567890123456789')
$$;
revoke execute on function prive.texte_normalise(text) from public, anon, authenticated;

create or replace function prive.contenu_interdit(texte text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  t text := prive.texte_normalise(texte);
begin
  if btrim(t) = '' then return false; end if;
  -- Lien : http(s)://, www., ou un nom de domaine courant (« boutique.com », « site.dz »).
  if t ~ '(https?:|www\.|[a-z0-9-]\s*\.\s*(com|net|org|fr|dz|io|me|ly|info|biz|co|app|link|xyz|shop|store)([^a-z0-9]|$))' then
    return true;
  end if;
  -- Numéro : 8 chiffres ou plus, espaces, points, tirets et parenthèses ignorés.
  if regexp_replace(t, '[\s.()+-]', '', 'g') ~ '[0-9]{8,}' then
    return true;
  end if;
  -- Mot interdit : comparaison mot à mot (séparateurs : espaces, ponctuation latine et arabe).
  return exists (
    select 1 from regexp_split_to_table(t, '[\s[:punct:]،؛؟«»…’]+') as m(mot)
    join prive.mots_interdits i on i.mot = m.mot
  );
end $$;
revoke execute on function prive.contenu_interdit(text) from public, anon, authenticated;

-- Seuil d'affichage de la moyenne (décision du propriétaire : 3 avis publiés ; réglable dans prive.reglages).
create or replace function prive.seuil_avis() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when r.valeur ~ '^[0-9]{1,3}$' then r.valeur::integer end
                   from prive.reglages r where r.cle = 'avis_seuil'), 3)
$$;
revoke execute on function prive.seuil_avis() from public, anon, authenticated;

-- Avis lisibles par le public : boutique validée, ville ouverte.
create or replace function prive.avis_lisibles(boutique uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.boutiques b join public.villes v on v.code = b.ville
                 where b.id = boutique and b.statut = 'validee' and v.ouverte)
$$;
revoke execute on function prive.avis_lisibles(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Donner un avis
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
  return jsonb_build_object('avis', nouvel);
end $$;
revoke execute on function public.donner_avis(uuid, integer, text[], text) from public, anon;
grant execute on function public.donner_avis(uuid, integer, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lectures publiques : jamais le numéro, l'identifiant du client ni la commande ; mois seulement.
-- ---------------------------------------------------------------------------
create or replace function public.avis_boutique(boutique uuid, limite integer default 5, decalage integer default 0)
returns table (id uuid, auteur text, note smallint, criteres text[], commentaire text, mois date, reponse text)
language sql stable security definer set search_path = '' as $$
  select a.id, prive.prenom_initiale(p.nom), a.note, a.criteres, a.commentaire,
         date_trunc('month', a.cree_le at time zone 'Africa/Algiers')::date, a.reponse
  from public.avis a
  left join public.profils p on p.id = a.client_id
  where a.boutique_id = boutique and a.statut = 'publie' and prive.avis_lisibles(boutique)
  order by a.cree_le desc, a.id
  limit least(greatest(coalesce(limite, 5), 1), 50) offset greatest(coalesce(decalage, 0), 0)
$$;
revoke execute on function public.avis_boutique(uuid, integer, integer) from public;
grant execute on function public.avis_boutique(uuid, integer, integer) to anon, authenticated;

-- Une requête pour toutes les boutiques d'une page (vitrine, fiche, catalogue, carte). moyenne vide sous le seuil.
create or replace function public.resume_avis(boutiques uuid[])
returns table (boutique_id uuid, nombre integer, moyenne numeric, criteres jsonb)
language sql stable security definer set search_path = '' as $$
  with ids as (
    select distinct x as id from unnest(coalesce(boutiques, '{}')) x
    where cardinality(coalesce(boutiques, '{}')) <= 500 and prive.avis_lisibles(x)
  ), publies as (
    select a.boutique_id, a.note, a.criteres from public.avis a join ids on ids.id = a.boutique_id where a.statut = 'publie'
  )
  select ids.id,
         count(p.note)::integer,
         case when count(p.note) >= prive.seuil_avis() then round(avg(p.note), 1) end,
         jsonb_build_object(
           'accueil', count(*) filter (where 'accueil' = any (p.criteres)),
           'article_conforme', count(*) filter (where 'article_conforme' = any (p.criteres)),
           'rapidite', count(*) filter (where 'rapidite' = any (p.criteres)))
  from ids left join publies p on p.boutique_id = ids.id
  group by ids.id
$$;
revoke execute on function public.resume_avis(uuid[]) from public;
grant execute on function public.resume_avis(uuid[]) to anon, authenticated;

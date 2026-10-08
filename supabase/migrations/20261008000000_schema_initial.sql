-- OranPromo : schéma initial
-- Tables, règles de sécurité (RLS) et stockage des photos.
-- Règle d'or : un commerçant ne voit et ne modifie QUE sa boutique. Le public ne voit
-- que les boutiques validées et les articles visibles (non masqués, confirmés < 21 jours).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type statut_boutique as enum ('en_attente', 'validee', 'suspendue');
create type role_utilisateur as enum ('commercant', 'ambassadeur', 'admin');
create type statut_article as enum ('disponible', 'reserve', 'vendu', 'masque');
create type genre_article as enum ('homme', 'femme', 'enfant', 'mixte');
create type type_evenement as enum ('vue_article', 'vue_boutique', 'clic_reserver', 'partage');
create type statut_signalement as enum ('ouvert', 'traite', 'rejete');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table boutiques (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  quartier text not null,
  adresse text,
  latitude double precision,
  longitude double precision,
  horaires text,
  whatsapp text not null,
  instagram text,
  facebook text,
  statut statut_boutique not null default 'en_attente',
  cree_le timestamptz not null default now()
);

-- Un profil par compte Supabase Auth (connexion par SMS).
create table profils (
  id uuid primary key references auth.users (id) on delete cascade,
  telephone text,
  role role_utilisateur not null default 'commercant',
  boutique_id uuid references boutiques (id) on delete set null,
  cree_le timestamptz not null default now()
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques (id) on delete cascade,
  titre text not null check (char_length(titre) between 2 and 120),
  description text,
  description_ar text,
  categorie text not null,
  genre genre_article not null default 'mixte',
  couleur text,
  prix integer not null check (prix > 0), -- en dinars, entier
  statut statut_article not null default 'disponible',
  propose_par_ia boolean not null default false,
  derniere_confirmation timestamptz not null default now(),
  cree_le timestamptz not null default now()
);
create index articles_boutique_idx on articles (boutique_id);
create index articles_public_idx on articles (statut, derniere_confirmation);

create table photos (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles (id) on delete cascade,
  adresse text not null,
  adresse_vignette text,
  ordre smallint not null default 0
);
create index photos_article_idx on photos (article_id);

create table tailles (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles (id) on delete cascade,
  libelle text not null,
  disponible boolean not null default true,
  unique (article_id, libelle)
);

-- Au plus une promo par article.
create table promos (
  article_id uuid primary key references articles (id) on delete cascade,
  prix_promo integer not null check (prix_promo > 0),
  badge text,
  date_fin timestamptz not null
);

-- Statistiques (vues, clics sur Réserver). Écriture publique, lecture par le commerçant.
create table evenements (
  id bigint generated always as identity primary key,
  type type_evenement not null,
  boutique_id uuid not null references boutiques (id) on delete cascade,
  article_id uuid references articles (id) on delete cascade,
  taille text,
  date timestamptz not null default now()
);
create index evenements_boutique_idx on evenements (boutique_id, date);

create table signalements (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles (id) on delete cascade,
  motif text not null,
  commentaire text check (char_length(commentaire) <= 1000),
  statut statut_signalement not null default 'ouvert',
  cree_le timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  signalement_id uuid not null references signalements (id) on delete cascade,
  action text not null,
  auteur_id uuid not null references profils (id),
  date timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires (security definer : lisent profils sans boucle RLS)
-- ---------------------------------------------------------------------------
create or replace function public.ma_boutique() returns uuid
language sql stable security definer set search_path = public as $$
  select boutique_id from profils where id = auth.uid()
$$;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils where id = auth.uid() and role = 'admin')
$$;

-- Un article est visible du public si : boutique validée, pas masqué/vendu,
-- confirmé il y a moins de 21 jours.
create or replace function public.article_visible(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from articles a join boutiques b on b.id = a.boutique_id
    where a.id = a_id
      and b.statut = 'validee'
      and a.statut in ('disponible', 'reserve')
      and a.derniere_confirmation > now() - interval '21 days'
  )
$$;

create or replace function public.article_de_ma_boutique(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from articles where id = a_id and boutique_id = public.ma_boutique())
$$;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id, telephone) values (new.id, new.phone);
  return new;
end $$;

create trigger a_l_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- Une nouvelle boutique est toujours "en attente" ; seul un admin change le statut.
create or replace function public.proteger_statut_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.est_admin() or auth.uid() is null then
    return new; -- admin ou service (clé secrète)
  end if;
  if tg_op = 'INSERT' then
    new.statut := 'en_attente';
  else
    new.statut := old.statut;
  end if;
  return new;
end $$;

create trigger statut_boutique_protege before insert or update on boutiques
  for each row execute function public.proteger_statut_boutique();

-- Après création d'une boutique, on la rattache au commerçant qui l'a créée.
create or replace function public.rattacher_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    update profils set boutique_id = new.id where id = auth.uid() and boutique_id is null;
  end if;
  return new;
end $$;

create trigger boutique_rattachee after insert on boutiques
  for each row execute function public.rattacher_boutique();

-- Un utilisateur ne peut pas changer son propre rôle ni sa boutique.
create or replace function public.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() and auth.uid() is not null then
    new.role := old.role;
    new.boutique_id := old.boutique_id;
  end if;
  return new;
end $$;

create trigger profil_protege before update on profils
  for each row execute function public.proteger_profil();

-- ---------------------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- ---------------------------------------------------------------------------
alter table boutiques enable row level security;
alter table profils enable row level security;
alter table articles enable row level security;
alter table photos enable row level security;
alter table tailles enable row level security;
alter table promos enable row level security;
alter table evenements enable row level security;
alter table signalements enable row level security;
alter table decisions enable row level security;

-- Boutiques
create policy "public voit les boutiques validées" on boutiques for select
  using (statut = 'validee' or id = public.ma_boutique() or public.est_admin());
create policy "commerçant crée sa boutique" on boutiques for insert to authenticated
  with check (public.ma_boutique() is null);
create policy "commerçant modifie sa boutique" on boutiques for update to authenticated
  using (id = public.ma_boutique() or public.est_admin())
  with check (id = public.ma_boutique() or public.est_admin());
create policy "admin supprime une boutique" on boutiques for delete to authenticated
  using (public.est_admin());

-- Profils
create policy "chacun voit son profil" on profils for select to authenticated
  using (id = auth.uid() or public.est_admin());
create policy "chacun modifie son profil" on profils for update to authenticated
  using (id = auth.uid() or public.est_admin());

-- Articles
create policy "public voit les articles visibles" on articles for select
  using (public.article_visible(id) or boutique_id = public.ma_boutique() or public.est_admin());
create policy "commerçant gère ses articles" on articles for all to authenticated
  using (boutique_id = public.ma_boutique() or public.est_admin())
  with check (boutique_id = public.ma_boutique() or public.est_admin());

-- Photos, tailles, promos : suivent la visibilité de l'article
create policy "lecture photos" on photos for select
  using (public.article_visible(article_id) or public.article_de_ma_boutique(article_id) or public.est_admin());
create policy "commerçant gère ses photos" on photos for all to authenticated
  using (public.article_de_ma_boutique(article_id) or public.est_admin())
  with check (public.article_de_ma_boutique(article_id) or public.est_admin());

create policy "lecture tailles" on tailles for select
  using (public.article_visible(article_id) or public.article_de_ma_boutique(article_id) or public.est_admin());
create policy "commerçant gère ses tailles" on tailles for all to authenticated
  using (public.article_de_ma_boutique(article_id) or public.est_admin())
  with check (public.article_de_ma_boutique(article_id) or public.est_admin());

create policy "lecture promos" on promos for select
  using (public.article_visible(article_id) or public.article_de_ma_boutique(article_id) or public.est_admin());
create policy "commerçant gère ses promos" on promos for all to authenticated
  using (public.article_de_ma_boutique(article_id) or public.est_admin())
  with check (public.article_de_ma_boutique(article_id) or public.est_admin());

-- Événements : tout visiteur peut en enregistrer, le commerçant lit les siens
create policy "visiteur enregistre un événement" on evenements for insert
  with check (true);
create policy "commerçant lit ses statistiques" on evenements for select to authenticated
  using (boutique_id = public.ma_boutique() or public.est_admin());

-- Signalements : tout visiteur peut signaler, seul l'admin lit et traite
create policy "visiteur signale" on signalements for insert
  with check (statut = 'ouvert');
create policy "admin lit les signalements" on signalements for select to authenticated
  using (public.est_admin());
create policy "admin traite les signalements" on signalements for update to authenticated
  using (public.est_admin());

-- Décisions de modération : admin uniquement
create policy "admin gère les décisions" on decisions for all to authenticated
  using (public.est_admin()) with check (public.est_admin() and auteur_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stockage des photos
-- Chemin imposé : photos/<boutique_id>/<article_id>/<fichier>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "commerçant ajoute ses photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.ma_boutique()::text);
create policy "commerçant modifie ses photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.ma_boutique()::text);
create policy "commerçant supprime ses photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.ma_boutique()::text);

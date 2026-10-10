-- US-34.2 et US-34.3 : versions des textes juridiques et acceptations datées (preuve : loi 18-05, art. 33).
-- Client : conditions d'utilisation + confidentialité (à l'inscription, puis avant une commande si une version
-- importante n'est pas acceptée). Commerçant : conditions commerçants + confidentialité (à l'entrée de l'espace).
-- Les textes sont dans le code (lib/juridique) ; la base garde les versions en vigueur et qui a accepté quoi, quand.
-- passer_commande n'est pas modifiée (le contrôle est dans l'action serveur du panier) ; aucune règle de blocage,
-- de no-show ou de numéro vérifié ne change.

create table public.versions_documents (
  document text not null check (document in ('conditions', 'conditions_commercants', 'confidentialite')),
  version date not null,
  importante boolean not null default true,
  en_vigueur_le timestamptz not null default now(),
  primary key (document, version)
);
comment on table public.versions_documents is 'US-34 : versions datées des textes juridiques (importante = nouvelle acceptation demandée).';
alter table public.versions_documents enable row level security;
create policy versions_documents_lecture on public.versions_documents for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.versions_documents from anon, authenticated;

-- Versions publiées le 10/10/2026 (version provisoire, en cours de relecture juridique) : mêmes dates que VERSIONS
-- dans lib/juridique/index.ts.
insert into public.versions_documents (document, version, importante) values
  ('conditions', '2026-10-10', true),
  ('conditions_commercants', '2026-10-10', true),
  ('confidentialite', '2026-10-10', true);

create table public.acceptations (
  profil_id uuid not null references public.profils(id) on delete cascade,
  document text not null,
  version date not null,
  accepte_le timestamptz not null default now(),
  contexte text not null check (contexte in ('inscription', 'commande', 'espace')),
  primary key (profil_id, document, version),
  foreign key (document, version) references public.versions_documents(document, version)
);
comment on table public.acceptations is 'US-34 : qui a accepté quelle version de quel texte, quand et où. Écrite par accepter_documents() seulement ; jamais modifiée.';
alter table public.acceptations enable row level security;
create policy acceptations_lecture on public.acceptations for select to authenticated
  using (profil_id = auth.uid() or prive.est_admin());
revoke insert, update, delete, truncate on public.acceptations from anon, authenticated;

-- Une acceptation ne se modifie jamais (la date fait foi) ; elle disparaît seulement avec le compte.
create or replace function prive.acceptation_figee() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'Une acceptation ne se modifie pas.' using errcode = '42501';
end $$;
create trigger acceptations_figees before update on public.acceptations
  for each row execute function prive.acceptation_figee();

-- Textes à accepter selon le rôle.
create or replace function prive.documents_requis(r public.role_utilisateur) returns text[]
language sql immutable set search_path = public as $$
  select case r::text
    when 'client' then array['conditions', 'confidentialite']
    when 'commercant' then array['conditions_commercants', 'confidentialite']
    else array[]::text[] end
$$;

-- Dernière version en vigueur, et dernière version importante en vigueur, d'un texte.
create or replace function prive.version_en_vigueur(doc text) returns date
language sql stable security definer set search_path = public as $$
  select max(v.version) from versions_documents v where v.document = doc and v.en_vigueur_le <= now()
$$;
create or replace function prive.version_importante(doc text) returns date
language sql stable security definer set search_path = public as $$
  select max(v.version) from versions_documents v where v.document = doc and v.importante and v.en_vigueur_le <= now()
$$;
revoke execute on function prive.acceptation_figee(), prive.documents_requis(public.role_utilisateur),
  prive.version_en_vigueur(text), prive.version_importante(text) from public, anon, authenticated;

-- Textes que le compte connecté doit (re)accepter : dernière version importante pas encore acceptée.
-- Renvoie la version à accepter (la dernière en vigueur). Vide pour un visiteur, un admin ou un ambassadeur.
create or replace function public.documents_a_accepter()
returns table (document text, version date)
language sql stable security definer set search_path = public as $$
  select d, prive.version_en_vigueur(d)
  from profils p cross join lateral unnest(prive.documents_requis(p.role)) d
  where p.id = auth.uid()
    and prive.version_importante(d) is not null
    and not exists (select 1 from acceptations a where a.profil_id = p.id and a.document = d
                    and a.version >= prive.version_importante(d))
  order by d
$$;
revoke execute on function public.documents_a_accepter() from public, anon;
grant execute on function public.documents_a_accepter() to authenticated;

-- Accepter des textes : seulement ceux du rôle du compte, et seulement leur dernière version en vigueur
-- (le navigateur ne peut pas accepter une ancienne version). Une acceptation déjà enregistrée ne change pas.
create or replace function public.accepter_documents(documents text[], versions date[], contexte text)
returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  role_compte public.role_utilisateur;
  i integer;
begin
  if compte is null then
    raise exception 'Connectez-vous pour accepter les conditions.' using errcode = '42501';
  end if;
  if contexte is null or contexte not in ('inscription', 'commande', 'espace') then
    raise exception 'Contexte d''acceptation invalide.' using errcode = '22023';
  end if;
  if documents is null or versions is null or cardinality(documents) not between 1 and 3
     or cardinality(documents) <> cardinality(versions) then
    raise exception 'Textes à accepter invalides.' using errcode = '22023';
  end if;
  select p.role into role_compte from profils p where p.id = compte;
  for i in 1 .. cardinality(documents) loop
    if not (documents[i] = any (prive.documents_requis(role_compte))) then
      raise exception 'Ce texte ne concerne pas votre compte.' using errcode = '42501';
    end if;
    if versions[i] is distinct from prive.version_en_vigueur(documents[i]) then
      raise exception 'Les conditions ont changé : rechargez la page.' using errcode = '22023';
    end if;
  end loop;
  insert into acceptations (profil_id, document, version, contexte)
  select compte, d.document, d.version, contexte
  from unnest(documents, versions) as d(document, version)
  on conflict (profil_id, document, version) do nothing;
end $$;
revoke execute on function public.accepter_documents(text[], date[], text) from public, anon;
grant execute on function public.accepter_documents(text[], date[], text) to authenticated;

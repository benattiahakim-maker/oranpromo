-- US-31.1 : suivre une boutique (abonnements), base seulement.
-- Décisions du propriétaire (10/10, valeurs par défaut) : nombre d'abonnés visible seulement par la boutique dans
-- /espace (jamais public) ; pas d'alerte WhatsApp pour l'instant (US-31.5, après les conditions US-34) : les colonnes
-- d'alerte et de consentement ne sont donc PAS créées ici, elles viendront avec US-31.5.
-- Rien ne change pour le blocage, les no-shows, la contestation, la vérification du numéro, les commandes.
-- La boutique ne sait jamais QUI la suit : elle ne lit pas la table, seulement un nombre (abonnes_boutique()).

create table abonnements_boutique (
  profil_id uuid not null references profils(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  cree_le timestamptz not null default now(),
  source text not null default 'vitrine' check (source in ('vitrine', 'inscription_boutique')),
  primary key (profil_id, boutique_id)
);
create index abonnements_boutique_boutique_idx on abonnements_boutique (boutique_id, cree_le);

alter table abonnements_boutique enable row level security;
-- Écriture : par les fonctions seulement. Lecture : le client ses lignes, l'admin tout ; ni la boutique ni le public.
revoke all on abonnements_boutique from public, anon;
revoke insert, update, delete, truncate on abonnements_boutique from authenticated;
grant select on abonnements_boutique to authenticated;
create policy "client lit ses abonnements" on abonnements_boutique for select to authenticated
  using (profil_id = auth.uid() or prive.est_admin());

-- Ajout commun (vitrine aujourd'hui, inscription en boutique en US-31.3). Renvoie vrai si l'abonnement est nouveau.
create or replace function prive.ajouter_abonnement(compte uuid, boutique uuid, origine text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  role_compte role_utilisateur;
begin
  -- Verrou sur le profil : deux appels en même temps ne dépassent pas le plafond de 200.
  select p.role into role_compte from profils p where p.id = compte for update;
  if not found or role_compte <> 'client' then
    raise exception 'Seuls les clients peuvent suivre une boutique.' using errcode = '42501';
  end if;
  if not exists (select 1 from boutiques b where b.id = boutique and b.statut = 'validee') then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from abonnements_boutique a where a.profil_id = compte and a.boutique_id = boutique) then
    return false;
  end if;
  if (select count(*) from abonnements_boutique a where a.profil_id = compte) >= 200 then
    raise exception 'Vous suivez déjà 200 boutiques : ne suivez plus l''une d''elles avant d''en ajouter une.' using errcode = '54000';
  end if;
  insert into abonnements_boutique (profil_id, boutique_id, source) values (compte, boutique, origine);
  return true;
end $$;
revoke execute on function prive.ajouter_abonnement(uuid, uuid, text) from public, anon, authenticated;

-- Client connecté : suivre une boutique validée (même dans une ville fermée : on y vient par son lien).
-- Un compte bloqué peut suivre (il ne peut toujours pas commander : rien ne change pour le blocage).
create or replace function public.suivre_boutique(boutique uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour suivre une boutique.' using errcode = '42501';
  end if;
  return prive.ajouter_abonnement(auth.uid(), boutique, 'vitrine');
end $$;
revoke execute on function public.suivre_boutique(uuid) from public, anon;
grant execute on function public.suivre_boutique(uuid) to authenticated;

-- Ne plus suivre : marche aussi pour une boutique suspendue entre-temps. Renvoie vrai si une ligne a été retirée.
create or replace function public.ne_plus_suivre(boutique uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour gérer vos boutiques.' using errcode = '42501';
  end if;
  delete from abonnements_boutique a where a.profil_id = auth.uid() and a.boutique_id = boutique;
  return found;
end $$;
revoke execute on function public.ne_plus_suivre(uuid) from public, anon;
grant execute on function public.ne_plus_suivre(uuid) to authenticated;

-- Compteur de l'espace : la boutique du commerçant connecté, un nombre et les nouveaux des 7 derniers jours.
-- Jamais de liste, jamais de nom ni de numéro.
create or replace function public.abonnes_boutique() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ma uuid := prive.ma_boutique();
begin
  if ma is null then
    raise exception 'Réservé aux commerçants.' using errcode = '42501';
  end if;
  return (select jsonb_build_object('total', count(*), 'sept_jours', count(*) filter (where a.cree_le > now() - interval '7 days'))
          from abonnements_boutique a where a.boutique_id = ma);
end $$;
revoke execute on function public.abonnes_boutique() from public, anon;
grant execute on function public.abonnes_boutique() to authenticated;

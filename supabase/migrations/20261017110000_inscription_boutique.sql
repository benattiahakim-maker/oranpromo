-- US-31.3 : inscription en boutique (affiche → /i/<slug>). Le client qui scanne l'affiche puis se connecte suit la
-- boutique (décision du propriétaire du 10/10) ; un compte NOUVEAU est aussi rattaché à la boutique.
-- Pas de bon d'inscription pour l'instant (US-31.4, après les bons US-33) : ce rattachement est le point d'accroche que
-- le programme de bons « inscription_boutique » lira plus tard. Aucune table de bons n'est touchée ici.
-- Écart avec la conception (colonnes profils.inscrit_par_boutique / inscrit_en_boutique_le) : une table à part, pour ne
-- pas ajouter une 2e clé étrangère profils → boutiques (les lectures « profils → boutiques(…) » deviendraient ambiguës
-- pour PostgREST, voir 20261017100000) et ne pas toucher au déclencheur de protection de profils.
-- Rien ne change pour le blocage, les no-shows, la contestation, la vérification du numéro, les commandes.

create table inscriptions_boutique (
  profil_id uuid primary key references profils(id) on delete cascade, -- un seul rattachement par compte, définitif
  boutique_id uuid not null references boutiques(id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index inscriptions_boutique_boutique_idx on inscriptions_boutique (boutique_id, cree_le);

alter table inscriptions_boutique enable row level security;
-- Écriture : par la fonction seulement. Lecture : le client sa ligne, l'admin tout ; ni la boutique ni le public.
revoke all on inscriptions_boutique from public, anon;
revoke insert, update, delete, truncate on inscriptions_boutique from authenticated;
grant select on inscriptions_boutique to authenticated;
create policy "client lit son inscription" on inscriptions_boutique for select to authenticated
  using (profil_id = auth.uid() or prive.est_admin());

-- Appelée par le site après la connexion, quand le cookie de l'affiche désigne cette boutique.
-- 1. suit la boutique (source « inscription_boutique » si l'abonnement est nouveau) ;
-- 2. rattache le compte s'il a été créé il y a moins de 24 h, n'a passé aucune commande et n'est pas déjà rattaché.
-- Renvoie { suivie_nouvelle, rattache } (rattache = vrai seulement si le rattachement vient d'être fait).
create or replace function public.rattacher_inscription(slug_boutique text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  compte uuid := auth.uid();
  cible uuid;
  nouvelle boolean := false;
  rattache boolean := false;
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
  return jsonb_build_object('suivie_nouvelle', nouvelle, 'rattache', rattache);
end $$;
revoke execute on function public.rattacher_inscription(text) from public, anon;
grant execute on function public.rattacher_inscription(text) to authenticated;

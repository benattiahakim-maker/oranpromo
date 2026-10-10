-- US-33.2 : bon de bienvenue (décision du propriétaire du 10/10 : 300 DA dès 2 000 DA d'achat, 30 jours,
-- pas en plus d'un bon de parrainage). Programme « bienvenue » créé par 20261018090000_programmes_bons.sql
-- (inactif, budget 0 DA : rien n'est donné tant que le propriétaire ne l'a pas activé).
-- Ce qui ne change pas : la vérification du numéro (prive.synchroniser_numero_verifie), le blocage, les no-shows,
-- le choix du parrain (choisir_parrain) et toutes les fonctions des commandes. Deux déclencheurs AFTER à part :
--  * numéro vérifié (telephone_verifie_le passe de vide à rempli) → bon de bienvenue si le compte y a droit ;
--  * parrain trouvé (parrainages.parrain_id rempli) → le bon de bienvenue encore disponible du filleul est annulé.
-- Une erreur dans le bon de bienvenue n'empêche jamais la vérification du numéro (avertissement seulement).

-- Le compte a-t-il droit au bon de bienvenue ? Client, sans commande récupérée, pas filleul du parrainage
-- (ni par son compte, ni par son numéro). Le programme (actif, dates, budget, une fois par numéro) est vérifié
-- par prive.donner_bon_programme.
create or replace function prive.droit_bon_bienvenue(compte uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils p where p.id = compte and p.role = 'client' and p.telephone_verifie_le is not null)
    and not exists (select 1 from commandes c where c.client_id = compte and c.statut = 'recuperee')
    and not exists (select 1 from parrainages x where x.filleul_id = compte and x.parrain_id is not null)
    and not exists (select 1 from prive.numeros_parraines n join profils p on p.id = compte
                    where n.empreinte = prive.empreinte_numero(p.telephone))
$$;

-- Donne le bon de bienvenue : « donne », ou la raison (« droit », « ferme », « budget », « numero », « deja »).
create or replace function prive.donner_bon_bienvenue(compte uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  programme uuid;
begin
  if not prive.droit_bon_bienvenue(compte) then
    return 'droit';
  end if;
  select p.id into programme from programmes_bons p where p.type = 'bienvenue';
  if programme is null then
    return 'ferme';
  end if;
  return prive.donner_bon_programme(programme, compte);
end $$;

create or replace function prive.bon_bienvenue_numero_verifie() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform prive.donner_bon_bienvenue(new.id);
  exception when others then
    raise warning 'Bon de bienvenue non donné (compte %) : %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger z_bon_bienvenue after update of telephone_verifie_le on public.profils
  for each row when (old.telephone_verifie_le is null and new.telephone_verifie_le is not null)
  execute function prive.bon_bienvenue_numero_verifie();

-- Filleul : pas de bon de bienvenue en plus du bon de parrainage (le parrain se choisit avant la 1re commande,
-- le bon de bienvenue est donc encore disponible). Un bon déjà réservé ou utilisé n'est pas touché.
create or replace function prive.bon_bienvenue_filleul() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update bons b set statut = 'annule'
  where b.profil_id = new.filleul_id and b.origine = 'bienvenue' and b.statut = 'disponible';
  return null;
end $$;

create trigger z_bon_bienvenue_filleul after insert or update of parrain_id on public.parrainages
  for each row when (new.parrain_id is not null)
  execute function prive.bon_bienvenue_filleul();

revoke execute on function prive.droit_bon_bienvenue(uuid), prive.donner_bon_bienvenue(uuid),
  prive.bon_bienvenue_numero_verifie(), prive.bon_bienvenue_filleul()
  from public, anon, authenticated;

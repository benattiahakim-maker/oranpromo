-- US-33.3 : bons de campagne avec code (décision du propriétaire du 10/10 : 500 DA, plafond 30 par boutique,
-- QR code obligatoire). Les campagnes sont créées par l'admin (US-33.5) dans programmes_bons (type « campagne »).
-- Nouveau : ajouter_code_bon (code tapé dans /compte, 5 codes faux par heure au plus), campagnes_ouvertes
-- (bandeau de l'accueil d'une ville et page des conditions), bons_panier (raison de chaque bon AVANT la commande,
-- calculée par la base sur les prix réels, comme passer_commande). utiliser_bon, raison_bon, passer_commande,
-- blocage, no-shows et numéro ne changent pas.

-- ---------------------------------------------------------------------------
-- 1. Code tapé par le client
-- ---------------------------------------------------------------------------
create table prive.essais_code_bon (
  profil_id uuid not null references public.profils(id) on delete cascade,
  le timestamptz not null default now()
);
create index essais_code_bon_idx on prive.essais_code_bon (profil_id, le);

-- Réponse : {"etat": "ajoute" | "inconnu" | "deja" | "trop" | "numero", et pour « ajoute » : nom_fr, nom_ar, montant, minimum_achat}.
-- « inconnu » : code absent, campagne fermée (dates, inactive) ou budget épuisé (« n'existe pas ou n'est plus valable »).
create or replace function public.ajouter_code_bon(code text) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  saisi text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g'));
  p programmes_bons%rowtype;
  resultat text;
begin
  if compte is null then
    raise exception 'Connecte-toi pour ajouter un code.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oranpromo:code_bon:' || compte::text, 0));
  if (select count(*) from prive.essais_code_bon e where e.profil_id = compte and e.le > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('etat', 'trop');
  end if;
  select * into p from programmes_bons x where x.type = 'campagne' and x.code = saisi;
  if not found then
    insert into prive.essais_code_bon (profil_id) values (compte);
    return jsonb_build_object('etat', 'inconnu');
  end if;
  resultat := prive.donner_bon_programme(p.id, compte);
  if resultat = 'donne' then
    return jsonb_build_object('etat', 'ajoute', 'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar, 'montant', p.montant, 'minimum_achat', p.minimum_achat);
  elsif resultat in ('deja', 'numero') then
    return jsonb_build_object('etat', resultat);
  end if;
  insert into prive.essais_code_bon (profil_id) values (compte);  -- fermée ou budget épuisé : compte comme un code faux
  return jsonb_build_object('etat', 'inconnu');
end $$;
revoke execute on function public.ajouter_code_bon(text) from public, anon;
grant execute on function public.ajouter_code_bon(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Campagnes ouvertes (bandeau de l'accueil, page des conditions) : rien d'autre que ce qui est affiché
-- ---------------------------------------------------------------------------
-- Ouvertes = actives, dans leurs dates, avec du budget pour au moins un bon ; ville = code de la ville (vide : toutes).
create or replace function public.campagnes_ouvertes(ville text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'nom_fr', p.nom_fr, 'nom_ar', p.nom_ar, 'code', p.code, 'montant', p.montant, 'minimum_achat', p.minimum_achat,
      'univers', p.univers, 'villes', to_jsonb(p.villes), 'debut', p.debut, 'fin', p.fin)
    order by p.fin nulls last, p.cree_le), '[]'::jsonb)
  from programmes_bons p
  where p.type = 'campagne' and prive.programme_ouvert(p)
    and prive.budget_programme_restant(p.id) >= p.montant
    and (ville is null or cardinality(p.villes) = 0 or ville = any (p.villes))
$$;
grant execute on function public.campagnes_ouvertes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Raisons au panier, avant la commande (mêmes règles que prive.raison_bon, sur les prix réels)
-- ---------------------------------------------------------------------------
-- Montant des lignes d'un panier dans un univers ; prix = promotion en cours sinon prix (comme passer_commande).
create or replace function prive.montant_panier(boutique uuid, lignes jsonb, univers text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce((select pr.prix_promo from promos pr where pr.article_id = a.id and pr.date_fin >= now()), a.prix)
                      * greatest(coalesce((l ->> 'quantite')::integer, 1), 1)), 0)::integer
  from jsonb_array_elements(case when jsonb_typeof(lignes) = 'array' then lignes else '[]'::jsonb end) l
  join articles a on a.id = (l ->> 'article_id')::uuid and a.boutique_id = boutique
  where univers is null
     or (univers = 'beaute' and a.categorie::text in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel'))
     or (univers in ('femme', 'homme', 'enfant')
         and a.categorie::text in ('T-shirts et polos', 'Chemises', 'Pulls et sweats', 'Vestes et manteaux', 'Pantalons et jeans',
                             'Survêtements et ensembles', 'Robes', 'Jupes', 'Abayas, djellabas, kamis', 'Tenues traditionnelles',
                             'Hijabs et foulards', 'Chaussures', 'Sacs', 'Accessoires')
         and (a.genre::text = univers or (univers <> 'enfant' and a.genre::text = 'mixte')))
$$;

-- « ok » ou la raison (mêmes réponses et même ordre que prive.raison_bon).
create or replace function prive.raison_bon_panier(b bons, boutique uuid, lignes jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  bo boutiques%rowtype;
  total integer := prive.montant_panier(boutique, lignes, null);
  plafond integer;
begin
  select * into bo from boutiques x where x.id = boutique;
  if b.programme_id is null then
    if total < b.minimum_achat then return 'minimum'; end if;
  elsif prive.montant_panier(boutique, lignes, b.univers) < b.minimum_achat then
    return case when b.univers is not null and total >= b.minimum_achat then 'univers' else 'minimum' end;
  end if;
  if cardinality(b.villes) > 0 and not (bo.ville = any (b.villes)) then return 'ville'; end if;
  if not coalesce(bo.bons_acceptes, false) then return 'boutique_exclue'; end if;
  if b.programme_id is not null then
    select p.plafond_par_boutique into plafond from programmes_bons p where p.id = b.programme_id;
    if plafond is not null and (select count(*) from bons x join commandes y on y.id = x.commande_id
                                where x.programme_id = b.programme_id and x.statut in ('reserve', 'utilise')
                                  and y.boutique_id = boutique) >= plafond then
      return 'plafond_boutique';
    end if;
  end if;
  return 'ok';
end $$;

-- Pour chaque bon disponible du compte : {"id", "raison"} (« ok » ou la raison), le plus gros d'abord (comme utiliser_bon).
create or replace function public.bons_panier(boutique uuid, lignes jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'raison', prive.raison_bon_panier(b, boutique, lignes))
    order by b.montant desc, b.expire_le, b.cree_le), '[]'::jsonb)
  from bons b
  where b.profil_id = auth.uid() and b.statut = 'disponible' and b.expire_le > now()
$$;
revoke execute on function public.bons_panier(uuid, jsonb) from public, anon;
grant execute on function public.bons_panier(uuid, jsonb) to authenticated;

revoke execute on function prive.montant_panier(uuid, jsonb, text), prive.raison_bon_panier(bons, uuid, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Page /campagne/<code> (conditions) : « campagne » ne peut jamais devenir le code d'une ville
-- ---------------------------------------------------------------------------
-- Contrainte à part (comme villes_code_libre_juridique) ; même liste que CODES_RESERVES (lib/ville.ts).
alter table public.villes add constraint villes_code_libre_campagne check (code <> 'campagne');

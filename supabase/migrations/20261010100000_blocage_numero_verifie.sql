-- US-21.3 : blocage par numéro, seulement sur les numéros vérifiés par code ; un numéro vérifié = un seul compte.
-- Conception : docs/architecture.md, section « Connexion des clients par téléphone (US-21) ».

-- ---------------------------------------------------------------------------
-- Un numéro vérifié n'appartient qu'à un compte.
-- Les anciens numéros saisis à la main (doublons possibles, numéro d'une autre personne) ne sont ni supprimés ni
-- rendus uniques : ils restent non vérifiés et ne comptent jamais pour un autre compte. Avant l'index, on retire
-- par sécurité toute vérification qui ne correspond pas au numéro confirmé dans Supabase Auth (auth.users.phone
-- est unique) : aucun doublon vérifié ne peut rester.
-- ---------------------------------------------------------------------------
update public.profils p set telephone_verifie_le = null
where p.telephone_verifie_le is not null
  and not exists (select 1 from auth.users u where u.id = p.id and u.phone_confirmed_at is not null and '+' || u.phone = p.telephone);

create unique index profils_telephone_verifie_unique on public.profils (telephone) where telephone_verifie_le is not null;

-- ---------------------------------------------------------------------------
-- Nombre de no-shows : ceux du compte, plus ceux des commandes passées avec ce numéro vérifié, seulement si le
-- compte visé a lui-même vérifié ce numéro. Un numéro saisi à la main ne fait jamais compter les no-shows d'un
-- autre compte (on ne peut pas faire bloquer quelqu'un d'autre).
-- ---------------------------------------------------------------------------
create or replace function prive.no_shows_actifs(client_cible uuid, telephone_cible text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from commandes c
  where c.no_show_le is not null and c.no_show_annule_le is null
    and (c.contestee_le is null or c.contestation_validee_le is not null)
    and (c.client_id = client_cible
         or (prive.blocage_par_numero() and telephone_cible is not null and c.telephone_verifie
             and c.client_telephone = telephone_cible
             and exists (select 1 from profils p where p.id = client_cible and p.telephone = telephone_cible
                         and p.telephone_verifie_le is not null)))
$$;

create or replace function prive.blocage_par_numero() returns boolean
language sql stable security definer set search_path = '' as $$
  -- US-21.3 : activé ('on'). Il ne joue que sur les numéros vérifiés par code (prive.no_shows_actifs).
  -- Pour le couper : update prive.reglages set valeur = 'off' where cle = 'blocage_par_numero';
  select coalesce((select r.valeur = 'on' from prive.reglages r where r.cle = 'blocage_par_numero'), false)
$$;

insert into prive.reglages (cle, valeur) values ('blocage_par_numero', 'on')
on conflict (cle) do update set valeur = excluded.valeur;

-- ---------------------------------------------------------------------------
-- Commande : plus de refus parce qu'un « autre compte du numéro » est bloqué (un numéro vérifié = un compte).
-- ---------------------------------------------------------------------------
create or replace function public.passer_commande(boutique uuid, lignes jsonb, note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  profil profils%rowtype;
  nouvelle uuid;
  ligne jsonb;
  article_ligne articles%rowtype;
  id_article uuid;
  taille_ligne text;
  quantite_ligne integer;
  stock integer;
  prix integer;
  montant integer := 0;
  deja text[] := '{}';
  note_propre text := nullif(btrim(coalesce(note, '')), '');
begin
  if compte is null then
    raise exception 'Connectez-vous pour commander.' using errcode = '42501';
  end if;
  select * into profil from profils p where p.id = compte;
  if not found then
    raise exception 'Profil introuvable : reconnectez-vous.' using errcode = '42501';
  end if;
  -- US-21 : en mode téléphone, seul un numéro vérifié par code permet de commander.
  if prive.connexion_par_telephone() and profil.telephone_verifie_le is null then
    raise exception 'Vérifiez votre numéro de téléphone par code avant de commander.' using errcode = '23514';
  end if;
  if profil.nom is null or profil.telephone is null or profil.telephone !~ '^\+213[1-9][0-9]{8}$' then
    raise exception 'Renseignez votre nom et votre numéro de téléphone avant de commander.' using errcode = '23514';
  end if;
  if not prive.nom_valide(profil.nom) then
    raise exception 'Corrigez votre nom dans votre compte : lettres, espaces, apostrophe et tiret seulement.' using errcode = '23514';
  end if;
  -- Compte bloqué, ou 5 no-shows : ceux du compte, plus ceux des commandes passées avec ce numéro vérifié
  -- quand le compte a vérifié ce numéro (US-21.3, prive.no_shows_actifs). Un numéro saisi à la main par un
  -- autre compte ne bloque jamais personne.
  if profil.bloque
     or prive.no_shows_actifs(compte, profil.telephone) >= 5 then
    if profil.bloque and profil.no_shows < 5 then -- blocage décidé par l'admin
      raise exception 'Votre compte est bloqué : contactez OranPromo pour le débloquer.' using errcode = '42501';
    end if;
    raise exception 'Votre compte est bloqué après 5 commandes non récupérées : contactez OranPromo pour le débloquer.' using errcode = '42501';
  end if;
  if profil.boutique_id is not distinct from boutique then
    raise exception 'Vous ne pouvez pas commander dans votre propre boutique.' using errcode = '42501';
  end if;
  if not exists (select 1 from boutiques b where b.id = boutique and b.statut = 'validee') then
    raise exception 'Cette boutique ne prend pas de commande pour le moment.' using errcode = 'P0002';
  end if;
  if note_propre is not null and char_length(note_propre) > 300 then
    raise exception 'La note pour la boutique doit faire 300 caractères au plus.' using errcode = '23514';
  end if;
  if jsonb_typeof(lignes) is distinct from 'array' or jsonb_array_length(lignes) not between 1 and 10 then
    raise exception 'Une commande contient de 1 à 10 lignes.' using errcode = '23514';
  end if;

  -- Une commande à la fois par client : les limites ne se contournent pas par des envois simultanés.
  perform pg_advisory_xact_lock(hashtextextended('commandes:' || compte::text, 0));
  if (select count(*) from commandes c where c.client_id = compte and c.statut in ('demandee', 'confirmee', 'prete')) >= 5 then
    raise exception 'Vous avez déjà 5 commandes en cours : attendez qu''elles soient terminées.' using errcode = '54000';
  end if;
  if (select count(*) from commandes c where c.client_id = compte and c.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de commandes en une heure : réessayez plus tard.' using errcode = '54000';
  end if;

  insert into commandes (client_id, boutique_id, client_nom, client_telephone, telephone_verifie, note)
  values (compte, boutique, profil.nom, profil.telephone, profil.telephone_verifie_le is not null, note_propre)
  returning id into nouvelle;

  for ligne in select value from jsonb_array_elements(lignes) loop
    if jsonb_typeof(ligne) is distinct from 'object'
       or jsonb_typeof(ligne -> 'article_id') is distinct from 'string'
       or jsonb_typeof(ligne -> 'taille') is distinct from 'string'
       or jsonb_typeof(ligne -> 'quantite') is distinct from 'number' then
      raise exception 'Une ligne du panier est incomplète (article, taille ou quantité manquant) : videz le panier et réessayez.' using errcode = '22023';
    end if;
    if (ligne ->> 'article_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'Une ligne du panier est invalide : videz le panier et réessayez.' using errcode = '22023';
    end if;
    id_article := (ligne ->> 'article_id')::uuid;
    taille_ligne := ligne ->> 'taille';
    if (ligne ->> 'quantite') !~ '^[0-9]+$' or (ligne ->> 'quantite')::numeric not between 1 and 10 then
      raise exception 'La quantité doit être comprise entre 1 et 10.' using errcode = '23514';
    end if;
    quantite_ligne := (ligne ->> 'quantite')::integer;

    select * into article_ligne from articles a where a.id = id_article;
    if not found or article_ligne.boutique_id is distinct from boutique or article_ligne.statut not in ('disponible', 'reserve')
       or not prive.article_visible(id_article) then
      raise exception 'Un article du panier n''est plus disponible : retirez-le et réessayez.' using errcode = 'P0002';
    end if;
    if (id_article::text || '|' || taille_ligne) = any (deja) then
      raise exception 'Le même article et la même taille apparaissent deux fois dans le panier.' using errcode = '23514';
    end if;
    deja := deja || (id_article::text || '|' || taille_ligne);

    select t.quantite into stock from tailles t where t.article_id = id_article and t.libelle = taille_ligne;
    if not found then
      raise exception 'La taille % de « % » n''existe plus : retirez-la du panier.', taille_ligne, article_ligne.titre using errcode = 'P0002';
    end if;
    if stock < quantite_ligne then
      raise exception 'Il ne reste que % pièce(s) en taille % pour « % ».', stock, taille_ligne, article_ligne.titre using errcode = '23514';
    end if;

    prix := article_ligne.prix;
    select p.prix_promo into prix from promos p where p.article_id = id_article and p.date_fin >= now();
    if not found then
      prix := article_ligne.prix;
    end if;

    insert into lignes_commande (commande_id, article_id, titre, taille, quantite, prix_unitaire)
    values (nouvelle, id_article, article_ligne.titre, taille_ligne, quantite_ligne, prix);
    montant := montant + prix * quantite_ligne;
  end loop;

  update commandes c set total = montant where c.id = nouvelle;
  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (nouvelle, 'demandee', compte, 'client', note_propre);
  return nouvelle;
end $$;

-- ---------------------------------------------------------------------------
-- Déblocage : annule aussi les no-shows des commandes passées avec le numéro vérifié du compte.
-- ---------------------------------------------------------------------------
create or replace function public.debloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  numero_client text;
  numero_verifie boolean;
  annulee record;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select p.telephone, p.telephone_verifie_le is not null into numero_client, numero_verifie from profils p where p.id = client;
  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  update profils p set bloque_par_admin = false where p.id = client and p.bloque_par_admin;
  for annulee in
    update commandes c set no_show_annule_le = now()
    where c.no_show_le is not null and c.no_show_annule_le is null
      and (c.client_id = client
           or (prive.blocage_par_numero() and numero_verifie and c.telephone_verifie and c.client_telephone = numero_client))
    returning c.client_id, c.client_telephone
  loop
    perform prive.recalculer_no_shows(annulee.client_id, annulee.client_telephone);
  end loop;
  perform prive.recalculer_no_shows(client, numero_client);
  update profils p set no_shows = 0, bloque = false, bloque_le = null where p.id = client and (p.no_shows <> 0 or p.bloque);
end $$;

-- ---------------------------------------------------------------------------
-- « Numéro partagé par plusieurs comptes » : plus utile (un numéro vérifié = un compte).
-- ---------------------------------------------------------------------------
drop function public.numeros_partages();

-- Compteurs à jour pour les comptes au numéro vérifié.
select prive.recalculer_no_shows(p.id, p.telephone) from public.profils p where p.telephone_verifie_le is not null;

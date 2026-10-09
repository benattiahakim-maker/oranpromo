-- US-25.4 : messages d'erreur de la base avec « contenance » pour les produits de beauté (catégories Parfums,
-- Maquillage, Soins visage et corps, Cheveux, Hammam et traditionnel) et « taille » pour la mode.
-- Accord du propriétaire du 9/10 (limite connue de la PR #62).
--
-- Seuls les messages changent. Les deux fonctions sont reprises À L'IDENTIQUE de leur définition en production
-- au 9/10 (pg_get_functiondef, même empreinte md5 que la base de test), sauf :
--   - public.passer_commande : 3 messages (ligne en double, taille disparue, stock insuffisant) choisissent le mot
--     d'après article_ligne.categorie, déjà lue ; aucune autre règle (connexion, numéro vérifié, blocage, no-shows,
--     limites, prix) ne change ;
--   - prive.retirer_stock : le message « Stock insuffisant » choisit le mot d'après la catégorie de l'article
--     (sous-requête dans le select du manque) ; verrous, contrôle et mise à jour du stock inchangés.
-- create or replace garde le propriétaire et les droits (execute) actuels.
-- Le panier traduit les nouveaux messages en arabe (« الحجم ») : lib/textes/messages.ts.

CREATE OR REPLACE FUNCTION public.passer_commande(boutique uuid, lignes jsonb, note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      raise exception 'Le même article et la même % apparaissent deux fois dans le panier.', case when article_ligne.categorie in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel') then 'contenance' else 'taille' end using errcode = '23514';
    end if;
    deja := deja || (id_article::text || '|' || taille_ligne);

    select t.quantite into stock from tailles t where t.article_id = id_article and t.libelle = taille_ligne;
    if not found then
      raise exception '% % de « % » n''existe plus : retirez-la du panier.', case when article_ligne.categorie in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel') then 'La contenance' else 'La taille' end, taille_ligne, article_ligne.titre using errcode = 'P0002';
    end if;
    if stock < quantite_ligne then
      raise exception 'Il ne reste que % pièce(s) en % % pour « % ».', stock, case when article_ligne.categorie in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel') then 'contenance' else 'taille' end, taille_ligne, article_ligne.titre using errcode = '23514';
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
end $function$;

CREATE OR REPLACE FUNCTION prive.retirer_stock(c_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  manque record;
begin
  perform 1 from tailles t join lignes_commande l on l.article_id = t.article_id and l.taille = t.libelle
  where l.commande_id = c_id order by t.id for update of t;
  select l.titre, l.taille, l.quantite, t.quantite as stock,
    case when (select a.categorie from articles a where a.id = l.article_id) in ('Parfums', 'Maquillage', 'Soins visage et corps', 'Cheveux', 'Hammam et traditionnel') then 'contenance' else 'taille' end as mot
  into manque
  from lignes_commande l join tailles t on t.article_id = l.article_id and t.libelle = l.taille
  where l.commande_id = c_id and t.quantite < l.quantite
  order by l.titre, l.taille limit 1;
  if found then
    raise exception 'Stock insuffisant pour « % » en % % : il reste % pièce(s), la commande en demande %. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».',
      manque.titre, manque.mot, manque.taille, manque.stock, manque.quantite using errcode = '23514';
  end if;
  update tailles t set quantite = t.quantite - l.quantite
  from lignes_commande l
  where l.commande_id = c_id and l.article_id = t.article_id and l.taille = t.libelle;
end $function$;

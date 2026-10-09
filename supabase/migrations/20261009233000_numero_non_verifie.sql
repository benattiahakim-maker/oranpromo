-- US-20 : relecture n°2 de Claude.
-- Point 1 : le numéro de téléphone du client n'est PAS vérifié (pas encore de SMS). N'importe qui peut mettre le
--   numéro d'une autre personne sur son compte : compter les no-shows « par numéro » permettait de faire bloquer
--   une victime avec 5 no-shows. Tant que le numéro n'est pas vérifié :
--     - les no-shows et le blocage automatique ne concernent que le compte qui a passé les commandes ;
--     - un autre compte avec un numéro qui a des no-shows n'est pas bloqué : il est signalé à l'admin dans
--       /admin/clients (« numéro partagé par plusieurs comptes », public.numeros_partages()) qui décide
--       (public.bloquer_client / public.debloquer_client) ;
--     - /compte n'affiche plus que les no-shows du compte (profils.no_shows recalculé ici).
--   Le blocage par numéro reste dans le code, désactivé : réglage prive.reglages « blocage_par_numero » = 'on'
--   (fonction prive.blocage_par_numero()). À activer seulement quand le numéro sera vérifié par SMS
--   (carte Trello V2 « Vérification du numéro par SMS »).
-- Point 2 : au plus 20 nouvelles commandes par boutique et par heure, tous clients confondus (coût WhatsApp et
--   tranquillité de la boutique) : déclencheur commandes_limite_boutique.
-- Rien n'est modifié dans les anciennes migrations : les fonctions concernées sont remplacées ici.

-- ===========================================================================
-- Point 1 : blocage par numéro, désactivé tant que le numéro n'est pas vérifié par SMS.
-- ===========================================================================
create or replace function prive.blocage_par_numero() returns boolean
language sql stable security definer set search_path = '' as $$
  -- V2 SMS : passer à 'on' (insert into prive.reglages values ('blocage_par_numero', 'on')) seulement quand
  -- chaque numéro est vérifié par un code SMS. D'ici là : 'off' (ou absent).
  select coalesce((select r.valeur = 'on' from prive.reglages r where r.cle = 'blocage_par_numero'), false)
$$;
revoke execute on function prive.blocage_par_numero() from public, anon, authenticated;

-- No-shows actifs d'un client : ceux de son compte ; ceux de son numéro seulement si le blocage par numéro est activé.
create or replace function prive.no_shows_actifs(client_cible uuid, telephone_cible text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from commandes c
  where c.no_show_le is not null and c.no_show_annule_le is null
    and (c.client_id = client_cible
         or (prive.blocage_par_numero() and telephone_cible is not null and c.client_telephone = telephone_cible))
$$;
revoke execute on function prive.no_shows_actifs(uuid, text) from public, anon, authenticated;

-- Recalcul : bloqué automatiquement au 5e no-show du compte. Un blocage décidé par l'admin (compte bloqué avec
-- moins de 5 no-shows, public.bloquer_client) n'est pas levé par le recalcul : seul debloquer_client le lève.
create or replace function prive.recalculer_no_shows(client_cible uuid, telephone_cible text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  total integer;
  bloquer boolean;
  avant text := coalesce(current_setting('oranpromo.traitement_systeme', true), '');
begin
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for p in
    select pr.id, pr.telephone, pr.no_shows, pr.bloque from profils pr
    where pr.id = client_cible or (telephone_cible is not null and pr.telephone = telephone_cible)
    order by pr.id for update
  loop
    total := prive.no_shows_actifs(p.id, p.telephone);
    bloquer := total >= 5 or (p.bloque and p.no_shows < 5);
    update profils pr set
      no_shows = total,
      bloque = bloquer,
      bloque_le = case when bloquer then coalesce(pr.bloque_le, now()) end
    where pr.id = p.id and (pr.no_shows is distinct from total or pr.bloque is distinct from bloquer);
  end loop;
  perform set_config('oranpromo.traitement_systeme', avant, true);
end $$;
revoke execute on function prive.recalculer_no_shows(uuid, text) from public, anon, authenticated;

-- Le message « compte bloqué après 5 commandes non récupérées » ne part que pour un blocage automatique :
-- un blocage décidé par l'admin sur un numéro non vérifié n'envoie rien à ce numéro.
create or replace function prive.message_compte_bloque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.no_shows < 5 then
    return new;
  end if;
  perform prive.ajouter_message_whatsapp(new.telephone, 'oranpromo_compte_bloque',
    'Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo.',
    array[case when prive.nom_valide(new.nom) then new.nom else 'cher client' end], null);
  return new;
end $$;

-- Remise à niveau des comptes existants : chaque compte ne garde que ses propres no-shows ; un compte bloqué
-- seulement à cause des no-shows d'un autre compte avec le même numéro est débloqué.
do $$
declare
  p record;
  total integer;
begin
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for p in select pr.id, pr.telephone from profils pr where pr.no_shows > 0 or pr.bloque order by pr.id for update loop
    total := prive.no_shows_actifs(p.id, p.telephone);
    update profils pr set no_shows = total, bloque = total >= 5,
      bloque_le = case when total >= 5 then coalesce(pr.bloque_le, now()) end
    where pr.id = p.id;
  end loop;
  perform set_config('oranpromo.traitement_systeme', '', true);
end $$;

-- Déblocage par l'admin : no-shows de ce compte annulés (et ceux de son numéro si le blocage par numéro est activé).
create or replace function public.debloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  numero_client text;
  annulee record;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select p.telephone into numero_client from profils p where p.id = client;
  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  for annulee in
    update commandes c set no_show_annule_le = now()
    where c.no_show_le is not null and c.no_show_annule_le is null
      and (c.client_id = client
           or (prive.blocage_par_numero() and numero_client is not null and c.client_telephone = numero_client))
    returning c.client_id, c.client_telephone
  loop
    perform prive.recalculer_no_shows(annulee.client_id, annulee.client_telephone);
  end loop;
  perform prive.recalculer_no_shows(client, numero_client);
  -- Blocage décidé par l'admin ou ancien compteur : remis à 0 aussi.
  update profils p set no_shows = 0, bloque = false, bloque_le = null where p.id = client and (p.no_shows <> 0 or p.bloque);
end $$;
revoke execute on function public.debloquer_client(uuid) from public, anon;
grant execute on function public.debloquer_client(uuid) to authenticated;

-- Blocage décidé par l'admin (par exemple après examen d'un numéro partagé par plusieurs comptes).
create or replace function public.bloquer_client(client uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from profils p where p.id = client) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  update profils p set bloque = true, bloque_le = now() where p.id = client and not p.bloque;
end $$;
revoke execute on function public.bloquer_client(uuid) from public, anon;
grant execute on function public.bloquer_client(uuid) to authenticated;

-- Numéros partagés par plusieurs comptes (admin) : numéros avec des no-shows actifs utilisés par au moins deux
-- comptes (numéro actuel du profil, ou numéro d'une commande déclarée « client pas venu »). Une ligne par compte.
create or replace function public.numeros_partages() returns table (
  telephone text, client_id uuid, nom text, telephone_actuel text, no_shows integer, bloque boolean, no_shows_numero integer
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  return query
  with numeros as (
    select c.client_telephone as tel, count(*)::integer as total
    from commandes c
    where c.no_show_le is not null and c.no_show_annule_le is null and c.client_telephone is not null
    group by c.client_telephone
  ), comptes as (
    select n.tel, p.id as compte from numeros n join profils p on p.telephone = n.tel
    union
    select c.client_telephone, c.client_id from commandes c join numeros n on n.tel = c.client_telephone
    where c.no_show_le is not null and c.no_show_annule_le is null and c.client_id is not null
  ), partages as (
    select co.tel from comptes co group by co.tel having count(distinct co.compte) >= 2
  )
  select s.tel, p.id, p.nom, p.telephone, p.no_shows, p.bloque, n.total
  from partages s
  join numeros n on n.tel = s.tel
  join comptes co on co.tel = s.tel
  join profils p on p.id = co.compte
  order by n.total desc, s.tel, p.no_shows desc, p.id
  limit 500;
end $$;
revoke execute on function public.numeros_partages() from public, anon;
grant execute on function public.numeros_partages() to authenticated;

-- ===========================================================================
-- Point 2 : au plus 20 nouvelles commandes par boutique et par heure (tous clients confondus).
-- Chaque commande naît « demandee » : on compte les commandes créées dans l'heure, quel que soit leur statut
-- actuel (une commande vite annulée a déjà coûté un message WhatsApp à la boutique).
-- Verrou par boutique : deux commandes simultanées ne dépassent pas la limite.
-- ===========================================================================
create or replace function prive.limiter_commandes_boutique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('commandes-boutique:' || new.boutique_id::text, 0));
  if (select count(*) from commandes c where c.boutique_id = new.boutique_id and c.cree_le > now() - interval '1 hour') >= 20 then
    raise exception 'Cette boutique a reçu trop de commandes dans la dernière heure : réessayez un peu plus tard.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function prive.limiter_commandes_boutique() from public, anon, authenticated;

drop trigger if exists commandes_limite_boutique on commandes;
create trigger commandes_limite_boutique before insert on commandes
  for each row execute function prive.limiter_commandes_boutique();

-- ===========================================================================
-- Point 1 (suite) : passer une commande. Seul le blocage du compte (ou ses 5 no-shows) refuse la commande.
-- La limite de 20 commandes par heure et par boutique est appliquée par le déclencheur ci-dessus.
-- ===========================================================================
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
  if profil.nom is null or profil.telephone is null or profil.telephone !~ '^\+213[1-9][0-9]{8}$' then
    raise exception 'Renseignez votre nom et votre numéro de téléphone avant de commander.' using errcode = '23514';
  end if;
  if not prive.nom_valide(profil.nom) then
    raise exception 'Corrigez votre nom dans votre compte : lettres, espaces, apostrophe et tiret seulement.' using errcode = '23514';
  end if;
  -- Compte bloqué, ou 5 no-shows sur ce compte. Les autres comptes avec le même numéro ne comptent que si le
  -- blocage par numéro est activé (numéro vérifié par SMS, V2) : sinon l'admin voit le numéro partagé et décide.
  if profil.bloque
     or prive.no_shows_actifs(compte, profil.telephone) >= 5
     or (prive.blocage_par_numero() and exists (select 1 from profils o where o.telephone = profil.telephone and o.bloque)) then
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

  insert into commandes (client_id, boutique_id, client_nom, client_telephone, note)
  values (compte, boutique, profil.nom, profil.telephone, note_propre)
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
revoke execute on function public.passer_commande(uuid, jsonb, text) from public, anon;
grant execute on function public.passer_commande(uuid, jsonb, text) to authenticated;

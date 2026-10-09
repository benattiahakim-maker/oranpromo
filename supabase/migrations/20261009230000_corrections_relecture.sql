-- US-20 : corrections de la relecture des commandes (points 1 à 10) et no-shows déclarés par la boutique
-- (point 11, décision du propriétaire : option C).
-- Rien n'est modifié dans les anciennes migrations : les fonctions concernées sont remplacées ici.

-- ===========================================================================
-- Point 10 : search_path fixe sur les deux fonctions signalées par l'audit Supabase.
-- ===========================================================================
alter function prive.numero_whatsapp(text) set search_path = '';
alter function prive.montant_da(integer) set search_path = '';

-- ===========================================================================
-- Point 4 : nom du client limité aux lettres (latines avec accents, arabes), espaces, apostrophe, tiret.
-- Pas de chiffres, de « :// », de retour à la ligne ; 2 à 60 caractères, au moins 2 lettres.
-- Même règle dans lib/clients.ts (validerProfilClient).
-- ===========================================================================
create or replace function prive.nom_valide(nom text) returns boolean
language sql immutable set search_path = '' as $$
  select nom is not null
    and char_length(nom) between 2 and 60
    and nom = btrim(nom)
    and position('  ' in nom) = 0
    and nom ~ '^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F\u0621-\u063A\u0641-\u0652\u0671-\u06D3'' \u2019-]+$'
    and char_length(regexp_replace(nom, '[ ''\u2019-]', '', 'g')) >= 2
$$;

-- Toute écriture (client, admin, service) : la base refuse un nom qui ne respecte pas la règle.
alter table profils add constraint profils_nom_valide check (nom is null or prive.nom_valide(nom));

-- Le client modifie son nom et son téléphone ; jamais son rôle, sa boutique, ses no-shows ni son blocage.
-- Un compte bloqué ne change plus de numéro (point 3 : le blocage suit le numéro).
create or replace function prive.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nom is distinct from old.nom and new.nom is not null then
    new.nom := regexp_replace(btrim(new.nom), ' {2,}', ' ', 'g');
    if not prive.nom_valide(new.nom) then
      raise exception 'Nom invalide : lettres, espaces, apostrophe et tiret seulement (2 à 60 caractères, sans chiffres).' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is null or prive.est_admin() or current_setting('oranpromo.traitement_systeme', true) = 'on' then
    return new; -- service, admin ou traitement système
  end if;
  new.role := old.role;
  new.boutique_id := old.boutique_id;
  new.no_shows := old.no_shows;
  new.bloque := old.bloque;
  new.bloque_le := old.bloque_le;
  if new.telephone is distinct from old.telephone then
    if old.bloque then
      raise exception 'Votre compte est bloqué : vous ne pouvez pas changer de numéro. Contactez OranPromo.' using errcode = '42501';
    end if;
    if new.telephone is not null and new.telephone !~ '^\+213[1-9][0-9]{8}$' then
      raise exception 'Numéro de téléphone invalide : format attendu +213XXXXXXXXX.' using errcode = '23514';
    end if;
    -- Les no-shows suivent le numéro : le compteur du compte est recalculé avec son nouveau numéro.
    new.no_shows := prive.no_shows_actifs(new.id, new.telephone);
    new.bloque := new.no_shows >= 5;
    new.bloque_le := case when new.bloque then now() end;
  end if;
  return new;
end $$;

-- ===========================================================================
-- Point 2 : statut de l'article selon le stock, calculé par instruction (et non par ligne).
-- Quand plusieurs tailles d'un article remontent dans la même instruction (remettre_stock), le
-- déclencheur par ligne ne voyait jamais un stock « avant » à 0 : l'article restait « Vendu ».
-- Ici on compare, par article, la somme après l'instruction et la somme avant (après − variation).
-- ===========================================================================
drop trigger if exists article_statut_selon_stock on tailles;
drop function if exists prive.statut_article_selon_stock();

create or replace function prive.statut_articles_apres_variation(ids uuid[], variations integer[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  total integer;
  avant integer;
begin
  for i in 1 .. coalesce(array_length(ids, 1), 0) loop
    select coalesce(sum(t.quantite), 0) into total from tailles t where t.article_id = ids[i];
    avant := total - variations[i];
    if total = 0 and exists (select 1 from tailles t where t.article_id = ids[i]) then
      update articles set statut = 'vendu' where id = ids[i] and statut in ('disponible', 'reserve');
    elsif total > 0 and avant = 0 then
      update articles set statut = 'disponible' where id = ids[i] and statut = 'vendu';
    end if;
  end loop;
end $$;
revoke execute on function prive.statut_articles_apres_variation(uuid[], integer[]) from public, anon, authenticated;

create or replace function prive.statut_articles_apres_insertion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.statut_articles_apres_variation(array_agg(v.article_id order by v.article_id), array_agg(v.variation order by v.article_id))
  from (select n.article_id, sum(n.quantite)::integer as variation from nouvelles n group by n.article_id) v;
  return null;
end $$;

create or replace function prive.statut_articles_apres_modification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.statut_articles_apres_variation(array_agg(v.article_id order by v.article_id), array_agg(v.variation order by v.article_id))
  from (
    select x.article_id, sum(x.quantite)::integer as variation from (
      select n.article_id, n.quantite from nouvelles n
      union all
      select a.article_id, -a.quantite from anciennes a
    ) x group by x.article_id
  ) v;
  return null;
end $$;

create or replace function prive.statut_articles_apres_suppression() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.statut_articles_apres_variation(array_agg(v.article_id order by v.article_id), array_agg(v.variation order by v.article_id))
  from (select a.article_id, -sum(a.quantite)::integer as variation from anciennes a group by a.article_id) v;
  return null;
end $$;

revoke execute on function prive.statut_articles_apres_insertion() from public, anon, authenticated;
revoke execute on function prive.statut_articles_apres_modification() from public, anon, authenticated;
revoke execute on function prive.statut_articles_apres_suppression() from public, anon, authenticated;

create trigger articles_statut_stock_insertion after insert on tailles
  referencing new table as nouvelles for each statement execute function prive.statut_articles_apres_insertion();
create trigger articles_statut_stock_modification after update on tailles
  referencing old table as anciennes new table as nouvelles for each statement execute function prive.statut_articles_apres_modification();
create trigger articles_statut_stock_suppression after delete on tailles
  referencing old table as anciennes for each statement execute function prive.statut_articles_apres_suppression();

-- ===========================================================================
-- Points 1 et 9 : stock à la confirmation et à la remise en stock.
-- Les tailles sont verrouillées dans un ordre fixe (id) : deux confirmations simultanées ne
-- s'interbloquent pas. La confirmation est refusée si une ligne dépasse le stock (plus de greatest(0, …),
-- qui retirait moins que commandé alors que l'annulation remettait tout).
-- ===========================================================================
create or replace function prive.retirer_stock(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  manque record;
begin
  perform 1 from tailles t join lignes_commande l on l.article_id = t.article_id and l.taille = t.libelle
  where l.commande_id = c_id order by t.id for update of t;
  select l.titre, l.taille, l.quantite, t.quantite as stock into manque
  from lignes_commande l join tailles t on t.article_id = l.article_id and t.libelle = l.taille
  where l.commande_id = c_id and t.quantite < l.quantite
  order by l.titre, l.taille limit 1;
  if found then
    raise exception 'Stock insuffisant pour « % » en taille % : il reste % pièce(s), la commande en demande %. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».',
      manque.titre, manque.taille, manque.stock, manque.quantite using errcode = '23514';
  end if;
  update tailles t set quantite = t.quantite - l.quantite
  from lignes_commande l
  where l.commande_id = c_id and l.article_id = t.article_id and l.taille = t.libelle;
end $$;
revoke execute on function prive.retirer_stock(uuid) from public, anon, authenticated;

create or replace function prive.remettre_stock(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from tailles t join lignes_commande l on l.article_id = t.article_id and l.taille = t.libelle
  where l.commande_id = c_id order by t.id for update of t;
  update tailles t set quantite = least(999, t.quantite + l.quantite)
  from lignes_commande l
  where l.commande_id = c_id and l.article_id = t.article_id and l.taille = t.libelle;
end $$;
revoke execute on function prive.remettre_stock(uuid) from public, anon, authenticated;

-- ===========================================================================
-- Point 11 (option C) et point 3 : no-shows déclarés par la boutique, comptés par numéro.
-- Une commande expirée ne compte plus automatiquement. La boutique déclare « Client pas venu »
-- (une fois par commande) ; l'admin peut annuler une déclaration.
-- Nombre de no-shows d'un client = commandes avec un no-show déclaré et non annulé, passées par ce compte
-- OU avec son numéro (client_telephone, copié à la commande) : un nouveau compte avec le même numéro hérite
-- des no-shows. profils.no_shows / bloque en sont la copie (recalculée), lue par l'écran et l'admin.
-- ===========================================================================
alter table commandes
  add column no_show_le timestamptz,
  add column no_show_annule_le timestamptz,
  add constraint commandes_no_show_coherent check (no_show_annule_le is null or no_show_le is not null);
create index commandes_no_shows_client_idx on commandes (client_id) where no_show_le is not null and no_show_annule_le is null;
create index commandes_no_shows_telephone_idx on commandes (client_telephone) where no_show_le is not null and no_show_annule_le is null;
create index profils_telephone_idx on profils (telephone) where telephone is not null;

create or replace function prive.no_shows_actifs(client_cible uuid, telephone_cible text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from commandes c
  where c.no_show_le is not null and c.no_show_annule_le is null
    and (c.client_id = client_cible or (telephone_cible is not null and c.client_telephone = telephone_cible))
$$;
revoke execute on function prive.no_shows_actifs(uuid, text) from public, anon, authenticated;

-- Recalcule no_shows / bloque du client et de tous les comptes qui ont ce numéro (bloqué au 5e).
create or replace function prive.recalculer_no_shows(client_cible uuid, telephone_cible text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  total integer;
  avant text := coalesce(current_setting('oranpromo.traitement_systeme', true), '');
begin
  -- Traitement système le temps du recalcul seulement (prive.proteger_profil laisse passer no_shows et bloque).
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for p in
    select pr.id, pr.telephone from profils pr
    where pr.id = client_cible or (telephone_cible is not null and pr.telephone = telephone_cible)
    order by pr.id for update
  loop
    total := prive.no_shows_actifs(p.id, p.telephone);
    update profils pr set
      no_shows = total,
      bloque = total >= 5,
      bloque_le = case when total >= 5 then coalesce(pr.bloque_le, now()) end
    where pr.id = p.id and (pr.no_shows is distinct from total or pr.bloque is distinct from (total >= 5));
  end loop;
  perform set_config('oranpromo.traitement_systeme', avant, true);
end $$;
revoke execute on function prive.recalculer_no_shows(uuid, text) from public, anon, authenticated;

-- Expiration d'une commande prête non récupérée : stock remis, statut « expiree », aucun no-show.
create or replace function prive.expirer_commande(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform prive.remettre_stock(c_id);
  update commandes c set statut = 'expiree', terminee_le = now() where c.id = c_id;
  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (c_id, 'expiree', null, 'systeme', 'Non récupérée dans les 24 heures.');
end $$;
revoke execute on function prive.expirer_commande(uuid) from public, anon, authenticated;

create or replace function prive.expirer_commandes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  expiree record;
  nombre integer := 0;
begin
  for expiree in
    select c.id from commandes c
    where c.statut = 'prete' and c.expire_le <= now()
    order by c.expire_le
    for update skip locked
  loop
    perform prive.expirer_commande(expiree.id);
    nombre := nombre + 1;
  end loop;
  return nombre;
end $$;
revoke execute on function prive.expirer_commandes() from public, anon, authenticated;

-- « Client pas venu » : boutique de la commande seulement, une fois par commande, sur une commande expirée
-- (ou prête depuis plus de 24 h : elle est alors expirée tout de suite, la tâche planifiée ne repassera pas).
create or replace function public.declarer_no_show(commande uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  actuelle commandes%rowtype;
  boutique_nom text;
  total integer;
begin
  if compte is null then
    raise exception 'Connectez-vous pour modifier une commande.' using errcode = '42501';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found or actuelle.boutique_id is distinct from prive.ma_boutique() then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if actuelle.no_show_le is not null then
    raise exception 'Vous avez déjà signalé que ce client n''est pas venu.' using errcode = '23514';
  end if;
  if actuelle.statut = 'prete' and actuelle.expire_le <= now() then
    perform prive.expirer_commande(actuelle.id);
  elsif actuelle.statut is distinct from 'expiree' then
    raise exception '« Client pas venu » est possible seulement quand la commande prête n''a pas été récupérée dans les 24 heures.' using errcode = '23514';
  end if;

  update commandes c set no_show_le = now() where c.id = actuelle.id;
  perform prive.recalculer_no_shows(actuelle.client_id, actuelle.client_telephone);
  total := prive.no_shows_actifs(actuelle.client_id, actuelle.client_telephone);
  -- Au 5e, le message de blocage part à la place (déclencheur sur profils.bloque).
  if total < 5 then
    select b.nom into boutique_nom from boutiques b where b.id = actuelle.boutique_id;
    perform prive.ajouter_message_whatsapp(actuelle.client_telephone, 'oranpromo_no_show',
      'Bonjour {{1}}, {{2}} nous signale que vous n''êtes pas venu(e) chercher votre commande n° {{3}}. C''est votre {{4}}e commande non récupérée : encore {{5}} et votre compte OranPromo sera bloqué. Merci de ne commander que ce que vous viendrez chercher.',
      array[case when prive.nom_valide(actuelle.client_nom) then actuelle.client_nom else 'cher client' end,
            boutique_nom, actuelle.numero::text, total::text, (5 - total)::text], actuelle.id);
  end if;
end $$;
revoke execute on function public.declarer_no_show(uuid) from public, anon;
grant execute on function public.declarer_no_show(uuid) to authenticated;

-- L'admin annule un no-show déclaré (erreur de la boutique, client de bonne foi) : le compteur baisse,
-- et le compte est débloqué s'il repasse sous 5.
create or replace function public.annuler_no_show(commande uuid) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  actuelle commandes%rowtype;
begin
  if not prive.est_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found or actuelle.no_show_le is null or actuelle.no_show_annule_le is not null then
    raise exception 'Aucun no-show à annuler sur cette commande.' using errcode = 'P0002';
  end if;
  update commandes c set no_show_annule_le = now() where c.id = actuelle.id;
  perform prive.recalculer_no_shows(actuelle.client_id, actuelle.client_telephone);
end $$;
revoke execute on function public.annuler_no_show(uuid) from public, anon;
grant execute on function public.annuler_no_show(uuid) to authenticated;

-- Déblocage par l'admin : tous les no-shows comptés pour ce client (compte ou numéro) sont annulés.
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
      and (c.client_id = client or (numero_client is not null and c.client_telephone = numero_client))
    returning c.client_id, c.client_telephone
  loop
    perform prive.recalculer_no_shows(annulee.client_id, annulee.client_telephone);
  end loop;
  perform prive.recalculer_no_shows(client, numero_client);
  -- Ancien compteur sans commande déclarée (avant cette migration) : remis à 0 aussi.
  update profils p set no_shows = 0, bloque = false, bloque_le = null where p.id = client and (p.no_shows <> 0 or p.bloque);
end $$;
revoke execute on function public.debloquer_client(uuid) from public, anon;
grant execute on function public.debloquer_client(uuid) to authenticated;

-- ===========================================================================
-- Points 3, 4 et 8 : passer une commande.
--  - refus si le compte est bloqué, si un autre compte avec le même numéro est bloqué, ou si le numéro
--    cumule 5 no-shows ;
--  - refus si le nom ne respecte pas la règle du point 4 ;
--  - contrôles des lignes avec « is distinct from » : une clé manquante est refusée avec un message clair.
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
  if profil.bloque
     or exists (select 1 from profils o where o.telephone = profil.telephone and o.bloque)
     or prive.no_shows_actifs(compte, profil.telephone) >= 5 then
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

-- Point 8 (suite) : un statut manquant est refusé clairement (avant : « statut <> 'annulee' » valait null).
create or replace function public.changer_statut_commande(commande uuid, statut statut_commande, motif text default null, note text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  actuelle commandes%rowtype;
  auteur_role text;
  note_propre text := nullif(btrim(coalesce(note, '')), '');
begin
  if compte is null then
    raise exception 'Connectez-vous pour modifier une commande.' using errcode = '42501';
  end if;
  if commande is null or statut is null then
    raise exception 'Demande incomplète : commande ou statut manquant.' using errcode = '22023';
  end if;
  if note_propre is not null and char_length(note_propre) > 300 then
    raise exception 'La note doit faire 300 caractères au plus.' using errcode = '23514';
  end if;
  select * into actuelle from commandes c where c.id = commande for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
  if prive.est_admin() then
    auteur_role := 'admin';
  elsif actuelle.boutique_id is not distinct from prive.ma_boutique() then
    auteur_role := 'boutique';
  elsif actuelle.client_id = compte then
    auteur_role := 'client';
  else
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;

  if auteur_role = 'client' then
    if statut is distinct from 'annulee' or actuelle.statut not in ('demandee', 'confirmee') then
      raise exception 'Vous pouvez annuler une commande tant qu''elle n''est pas prête.' using errcode = '23514';
    end if;
    if actuelle.statut = 'confirmee' then
      perform prive.remettre_stock(actuelle.id);
    end if;
    update commandes c set statut = 'annulee', motif_annulation = 'client_a_annule', terminee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut = 'demandee' and statut = 'confirmee' then
    perform prive.retirer_stock(actuelle.id); -- refus « Stock insuffisant pour … » (point 1)
    update commandes c set statut = 'confirmee', confirmee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut = 'confirmee' and statut = 'prete' then
    update commandes c set statut = 'prete', prete_le = now(), expire_le = now() + interval '24 hours' where c.id = actuelle.id;

  elsif actuelle.statut = 'prete' and statut = 'recuperee' then
    update commandes c set statut = 'recuperee', terminee_le = now() where c.id = actuelle.id;

  elsif actuelle.statut in ('demandee', 'confirmee', 'prete') and statut = 'annulee' then
    if motif is null or motif not in ('plus_en_stock', 'boutique_indisponible', 'autre') then
      raise exception 'Choisissez le motif de l''annulation.' using errcode = '23514';
    end if;
    if actuelle.statut in ('confirmee', 'prete') then
      perform prive.remettre_stock(actuelle.id);
    end if;
    update commandes c set statut = 'annulee', motif_annulation = motif, terminee_le = now() where c.id = actuelle.id;

  else
    raise exception 'Changement de statut impossible : la commande est déjà « % ».',
      case actuelle.statut when 'demandee' then 'demandée' when 'confirmee' then 'confirmée' when 'prete' then 'prête'
        when 'recuperee' then 'récupérée' when 'annulee' then 'annulée' else 'expirée' end
      using errcode = '23514';
  end if;

  insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
  values (actuelle.id, statut, compte, auteur_role, note_propre);
end $$;
revoke execute on function public.changer_statut_commande(uuid, statut_commande, text, text) from public, anon;
grant execute on function public.changer_statut_commande(uuid, statut_commande, text, text) to authenticated;

-- ===========================================================================
-- Messages WhatsApp
--  - point 4 : un nom qui ne respecte pas la règle n'entre jamais dans un message (« cher client ») ;
--  - point 11 : le message d'expiration ne compte plus de no-show ; nouveau modèle oranpromo_no_show.
-- ===========================================================================
alter table messages_whatsapp drop constraint if exists messages_whatsapp_modele_check;
alter table messages_whatsapp add constraint messages_whatsapp_modele_check check (modele in (
  'oranpromo_nouvelle_commande', 'oranpromo_commande_prete', 'oranpromo_commande_expiree', 'oranpromo_no_show', 'oranpromo_compte_bloque'));

create or replace function prive.messages_suivi_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  articles integer;
  nom_client text;
begin
  select co.id, co.numero, co.client_nom, co.client_telephone, co.total, co.expire_le,
         b.nom as boutique_nom, b.whatsapp as boutique_whatsapp
  into c
  from commandes co join boutiques b on b.id = co.boutique_id
  where co.id = new.commande_id;
  if not found then
    return new;
  end if;
  nom_client := case when prive.nom_valide(c.client_nom) then c.client_nom else 'cher client' end;

  if new.statut = 'demandee' then
    select coalesce(sum(quantite), 0) into articles from lignes_commande where commande_id = c.id;
    perform prive.ajouter_message_whatsapp(c.boutique_whatsapp, 'oranpromo_nouvelle_commande',
      'Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace OranPromo, rubrique Commandes.',
      array[c.numero::text, nom_client, articles::text, prive.montant_da(c.total)], c.id);
  elsif new.statut = 'prete' then
    perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_prete',
      'Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu''au {{4}}.',
      array[nom_client, c.numero::text, c.boutique_nom,
            coalesce(to_char(c.expire_le at time zone 'Africa/Algiers', 'DD/MM à HH24"h"MI'), 'dans les 24 heures')], c.id);
  elsif new.statut = 'expiree' then
    perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_expiree',
      'Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n''a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher.',
      array[nom_client, c.numero::text, c.boutique_nom], c.id);
  end if;
  return new;
end $$;

create or replace function prive.message_compte_bloque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.ajouter_message_whatsapp(new.telephone, 'oranpromo_compte_bloque',
    'Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo.',
    array[case when prive.nom_valide(new.nom) then new.nom else 'cher client' end], null);
  return new;
end $$;

-- Juste après une action : messages de cette commande (nouvelle commande, prête, client pas venu).
create or replace function public.messages_whatsapp_commande(commande uuid) returns table (
  id uuid, reservation uuid, destinataire text, modele text, parametres jsonb, texte text
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not prive.commande_visible(commande) then
    raise exception 'Commande introuvable.' using errcode = '42501';
  end if;
  return query select * from prive.reserver_messages_whatsapp(array(
    select m.id from messages_whatsapp m
    where m.commande_id = commande and m.statut = 'a_envoyer'
      and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_commande_prete', 'oranpromo_no_show')
      and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
      and m.cree_le > now() - interval '1 hour'
    order by m.cree_le
    for update skip locked
  ));
end $$;
revoke execute on function public.messages_whatsapp_commande(uuid) from public, anon;
grant execute on function public.messages_whatsapp_commande(uuid) to authenticated;

-- ===========================================================================
-- Point 5 : le résultat d'un envoi est réservé au serveur (jeton de la tâche d'envoi, comme
-- messages_whatsapp_en_attente). Avant, un participant pouvait marquer « envoyé » un message non parti.
-- ===========================================================================
create or replace function prive.verifier_jeton_notifications(jeton text) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  attendu text;
begin
  select valeur into attendu from prive.reglages where cle = 'jeton_notifications';
  if attendu is null or jeton is null or length(jeton) < 16
     or encode(sha256(convert_to(jeton, 'UTF8')), 'hex') <> attendu then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
end $$;
revoke execute on function prive.verifier_jeton_notifications(text) from public, anon, authenticated;

drop function if exists public.resultat_message_whatsapp(uuid, uuid, boolean, text, text, boolean);

create or replace function public.resultat_message_whatsapp(jeton text, message uuid, reservation uuid, succes boolean,
  identifiant text default null, erreur text default null, definitif boolean default false) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  perform prive.verifier_jeton_notifications(jeton);
  update messages_whatsapp m set
    statut = case when succes then 'envoye'::statut_message_whatsapp
                  when definitif or m.tentatives + 1 >= 5 then 'echec'::statut_message_whatsapp
                  else 'a_envoyer'::statut_message_whatsapp end,
    tentatives = least(m.tentatives + 1, 5),
    envoye_le = case when succes then now() else null end,
    identifiant_fournisseur = case when succes then left(identifiant, 200) else m.identifiant_fournisseur end,
    erreur = case when succes then null else left(coalesce(erreur, 'Erreur inconnue.'), 500) end,
    reserve_jusqu_a = case when succes then null else now() + interval '2 minutes' end,
    reservation = null
  where m.id = message and m.reservation = reservation and m.statut = 'a_envoyer';
end $$;
revoke execute on function public.resultat_message_whatsapp(text, uuid, uuid, boolean, text, text, boolean) from public;
grant execute on function public.resultat_message_whatsapp(text, uuid, uuid, boolean, text, text, boolean) to anon, authenticated;

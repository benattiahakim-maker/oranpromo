-- US-21.1 : numéro de téléphone du client vérifié par code (Supabase Auth, fournisseur Twilio Verify).
-- Conception : docs/architecture.md, section « Connexion des clients par téléphone (US-21) ».
-- Mode e-mail (par défaut, réglage connexion_client absent) : rien ne change pour le client.

-- ---------------------------------------------------------------------------
-- Format : mobile algérien uniquement (+213 puis 5, 6 ou 7, puis 8 chiffres). Même règle que lib/telephone.ts.
-- ---------------------------------------------------------------------------
create or replace function prive.telephone_client_valide(numero text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(numero ~ '^\+213[567][0-9]{8}$', false)
$$;

-- Mode de connexion des clients, choisi par le propriétaire avec CONNEXION_CLIENT (voir docs/architecture.md) :
-- insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;
create or replace function prive.connexion_par_telephone() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.valeur = 'telephone' from prive.reglages r where r.cle = 'connexion_client'), false)
$$;

revoke execute on function prive.telephone_client_valide(text) from public, anon, authenticated;
revoke execute on function prive.connexion_par_telephone() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------
-- Date de vérification du numéro par code ; vide = numéro saisi à la main (non fiable). Écrite seulement par la base.
alter table public.profils add column telephone_verifie_le timestamptz;
-- Le numéro de la commande était-il vérifié au moment de la commande ? (blocage par numéro, US-21.3)
alter table public.commandes add column telephone_verifie boolean not null default false;

-- ---------------------------------------------------------------------------
-- Comptes Supabase Auth (auth.users.phone est rangé sans « + »)
-- ---------------------------------------------------------------------------
-- Le numéro du compte n'est plus recopié à la création : il arrive, vérifié, par z_numero_verifie.
create or replace function prive.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id) values (new.id);
  return new;
end $$;

-- Refus des numéros non algériens. À la création d'un compte par numéro, l'erreur arrive avant l'envoi du code :
-- aucun SMS n'est payé vers un numéro étranger.
create or replace function prive.refuser_numero_etranger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.phone, '') <> '' and (tg_op = 'INSERT' or new.phone is distinct from old.phone)
     and not prive.telephone_client_valide('+' || new.phone) then
    raise exception 'Numéro refusé : seuls les mobiles algériens (05, 06 ou 07) sont acceptés.' using errcode = '23514';
  end if;
  if coalesce(new.phone_change, '') <> '' and (tg_op = 'INSERT' or new.phone_change is distinct from old.phone_change)
     and not prive.telephone_client_valide('+' || new.phone_change) then
    raise exception 'Numéro refusé : seuls les mobiles algériens (05, 06 ou 07) sont acceptés.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger numero_client_algerien before insert or update of phone, phone_change on auth.users
  for each row execute function prive.refuser_numero_etranger();

-- Numéro confirmé par Supabase (code reçu) → numéro vérifié du profil. Le nom commence par « z » : il passe
-- après a_l_inscription (création du profil). Tout autre profil qui portait ce numéro vérifié le perd :
-- un numéro vérifié n'appartient qu'à un compte (auth.users.phone est unique).
create or replace function prive.synchroniser_numero_verifie() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  numero text;
  ancien text;
  avant text := coalesce(current_setting('oranpromo.traitement_systeme', true), '');
begin
  if tg_op = 'UPDATE' and new.phone is not distinct from old.phone
     and new.phone_confirmed_at is not distinct from old.phone_confirmed_at then
    return null;
  end if;
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  select p.telephone into ancien from profils p where p.id = new.id;
  if coalesce(new.phone, '') = '' or new.phone_confirmed_at is null then
    update profils p set telephone_verifie_le = null where p.id = new.id and p.telephone_verifie_le is not null;
  else
    numero := '+' || new.phone;
    if prive.telephone_client_valide(numero) then
      update profils p set telephone_verifie_le = null
      where p.telephone = numero and p.id <> new.id and p.telephone_verifie_le is not null;
      update profils p set telephone = numero, telephone_verifie_le = now() where p.id = new.id;
      perform prive.recalculer_no_shows(new.id, numero);
      if ancien is not null and ancien <> numero then
        perform prive.recalculer_no_shows(null, ancien);
      end if;
    end if;
  end if;
  perform set_config('oranpromo.traitement_systeme', avant, true);
  return null;
end $$;

create trigger z_numero_verifie after insert or update of phone, phone_confirmed_at on auth.users
  for each row execute function prive.synchroniser_numero_verifie();

revoke execute on function prive.refuser_numero_etranger() from public, anon, authenticated;
revoke execute on function prive.synchroniser_numero_verifie() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profil : la date de vérification n'est pas modifiable par le client ; un numéro vérifié ne change que par code.
-- ---------------------------------------------------------------------------
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
  new.bloque_par_admin := old.bloque_par_admin;
  new.telephone_verifie_le := old.telephone_verifie_le; -- écrite seulement par la base (z_numero_verifie)
  if new.telephone is distinct from old.telephone then
    if old.telephone_verifie_le is not null then
      raise exception 'Votre numéro est vérifié : pour en changer, vérifiez le nouveau numéro par code.' using errcode = '42501';
    end if;
    if old.bloque then
      raise exception 'Votre compte est bloqué : vous ne pouvez pas changer de numéro. Contactez OranPromo.' using errcode = '42501';
    end if;
    if new.telephone is not null and new.telephone !~ '^\+213[1-9][0-9]{8}$' then
      raise exception 'Numéro de téléphone invalide : format attendu +213XXXXXXXXX.' using errcode = '23514';
    end if;
    new.no_shows := prive.no_shows_actifs(new.id, new.telephone);
    new.bloque := old.bloque_par_admin or new.no_shows >= 5;
    new.bloque_le := case when new.bloque then coalesce(old.bloque_le, now()) end;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Commande : en mode téléphone, numéro vérifié obligatoire ; la commande garde si le numéro était vérifié.
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
-- Limites d'envoi des codes : 1 par minute et 5 par heure pour un même numéro.
-- Appelées par le serveur seulement (jeton = CRON_SECRET, empreinte dans prive.reglages) : personne ne peut
-- épuiser depuis le navigateur le quota d'un autre numéro. Le serveur contrôle avant l'envoi et n'enregistre
-- qu'un envoi accepté par Supabase (un captcha raté ne consomme pas le quota).
-- ---------------------------------------------------------------------------
create table prive.envois_codes (
  id bigint generated always as identity primary key,
  telephone text not null,
  envoye_le timestamptz not null default now()
);
create index envois_codes_telephone on prive.envois_codes (telephone, envoye_le desc);
revoke all on prive.envois_codes from public, anon, authenticated;

create or replace function public.controler_envoi_code(jeton text, numero text) returns void
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
begin
  perform prive.verifier_jeton_notifications(jeton);
  if not prive.telephone_client_valide(numero) then
    raise exception 'Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres.' using errcode = '22023';
  end if;
  if exists (select 1 from prive.envois_codes e where e.telephone = numero and e.envoye_le > now() - interval '1 minute') then
    raise exception 'Attendez une minute avant de demander un nouveau code.' using errcode = '54000';
  end if;
  if (select count(*) from prive.envois_codes e where e.telephone = numero and e.envoye_le > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de codes demandés pour ce numéro : réessayez dans une heure.' using errcode = '54000';
  end if;
end $$;

create or replace function public.enregistrer_envoi_code(jeton text, numero text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  perform prive.verifier_jeton_notifications(jeton);
  if not prive.telephone_client_valide(numero) then
    raise exception 'Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres.' using errcode = '22023';
  end if;
  delete from prive.envois_codes e where e.envoye_le < now() - interval '1 day';
  insert into prive.envois_codes (telephone) values (numero);
end $$;

revoke execute on function public.controler_envoi_code(text, text) from public;
revoke execute on function public.enregistrer_envoi_code(text, text) from public;
grant execute on function public.controler_envoi_code(text, text) to anon, authenticated;
grant execute on function public.enregistrer_envoi_code(text, text) to anon, authenticated;

-- US-20.6 : confirmer une commande depuis le message WhatsApp « nouvelle commande » (bouton lien « Confirmer »).
-- Le lien (commande + expiration + signature HMAC avec CONFIRMATION_SECRET) est fabriqué et vérifié par le serveur ;
-- il n'est stocké nulle part. La base exige le secret du serveur (empreinte SHA-256 dans prive.reglages,
-- clé 'jeton_confirmation') : personne ne peut confirmer une commande avec la seule clé publique.
--   insert into prive.reglages (cle, valeur)
--   values ('jeton_confirmation', encode(sha256(convert_to('<CONFIRMATION_SECRET>', 'UTF8')), 'hex'))
--   on conflict (cle) do update set valeur = excluded.valeur;
-- Interrupteur du nouveau modèle (après l'approbation de Meta) :
--   insert into prive.reglages (cle, valeur) values ('bouton_confirmer', 'on')
--   on conflict (cle) do update set valeur = excluded.valeur;
-- Voir docs/architecture.md, « Confirmer depuis WhatsApp (US-20.6) ».

-- ---------------------------------------------------------------------------
-- 1. Nouveau modèle WhatsApp
-- ---------------------------------------------------------------------------
alter table messages_whatsapp drop constraint if exists messages_whatsapp_modele_check;
alter table messages_whatsapp add constraint messages_whatsapp_modele_check check (modele in (
  'oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete',
  'oranpromo_commande_expiree', 'oranpromo_no_show', 'oranpromo_compte_bloque'));

-- Avec l'interrupteur 'bouton_confirmer' = 'on' : le message « nouvelle commande » utilise le modèle avec bouton.
-- Ses 4 premiers paramètres sont ceux du texte ; le 5e est l'identifiant de la commande, que le serveur remplace
-- par le lien signé au moment de l'envoi (paramètre du bouton, jamais affiché ni stocké).
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
    if coalesce((select valeur from prive.reglages where cle = 'bouton_confirmer'), '') = 'on' then
      perform prive.ajouter_message_whatsapp(c.boutique_whatsapp, 'oranpromo_nouvelle_commande_confirmer',
        'Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Touchez Confirmer, ou confirmez-la dans votre espace OranPromo, rubrique Commandes.',
        array[c.numero::text, nom_client, articles::text, prive.montant_da(c.total), c.id::text], c.id);
    else
      perform prive.ajouter_message_whatsapp(c.boutique_whatsapp, 'oranpromo_nouvelle_commande',
        'Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace OranPromo, rubrique Commandes.',
        array[c.numero::text, nom_client, articles::text, prive.montant_da(c.total)], c.id);
    end if;
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

-- Envoi juste après la commande : le nouveau modèle part aussi tout de suite.
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
      and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete', 'oranpromo_no_show')
      and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
      and m.cree_le > now() - interval '1 hour'
    order by m.cree_le
    for update skip locked
  ));
end $$;
revoke execute on function public.messages_whatsapp_commande(uuid) from public, anon;
grant execute on function public.messages_whatsapp_commande(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Confirmation : une seule règle pour le bouton du site et le lien WhatsApp
-- ---------------------------------------------------------------------------
-- La commande doit être verrouillée (for update) et « demandée ». Refus « Stock insuffisant pour … ».
create or replace function prive.confirmer_commande(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform prive.retirer_stock(c_id);
  update commandes c set statut = 'confirmee', confirmee_le = now() where c.id = c_id;
end $$;
revoke execute on function prive.confirmer_commande(uuid) from public, anon, authenticated;

-- Même fonction qu'avant (20261009230000_corrections_relecture), seule la confirmation passe par prive.confirmer_commande.
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
    perform prive.confirmer_commande(actuelle.id); -- refus « Stock insuffisant pour … »

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

-- ---------------------------------------------------------------------------
-- 3. Lien WhatsApp (sans connexion) : secret du serveur obligatoire
-- ---------------------------------------------------------------------------
create or replace function prive.verifier_jeton_confirmation(jeton text) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  attendu text;
begin
  select valeur into attendu from prive.reglages where cle = 'jeton_confirmation';
  if attendu is null or jeton is null or length(jeton) < 16
     or encode(sha256(convert_to(jeton, 'UTF8')), 'hex') <> attendu then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
end $$;
revoke execute on function prive.verifier_jeton_confirmation(text) from public, anon, authenticated;

-- Page du lien : ce que la boutique doit voir pour décider (jamais le téléphone du client). null si inconnue.
create or replace function public.commande_a_confirmer(jeton text, commande uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare
  resultat jsonb;
begin
  perform prive.verifier_jeton_confirmation(jeton);
  select jsonb_build_object(
    'numero', c.numero,
    'boutique', b.nom,
    'client', case when prive.nom_valide(c.client_nom) then c.client_nom else 'Client' end,
    'statut', c.statut,
    'total', c.total,
    'note', c.note,
    'cree_le', c.cree_le,
    'lignes', coalesce((select jsonb_agg(jsonb_build_object('titre', l.titre, 'taille', l.taille, 'quantite', l.quantite,
                                                            'prix_unitaire', l.prix_unitaire) order by l.titre, l.taille)
                        from lignes_commande l where l.commande_id = c.id), '[]'::jsonb))
  into resultat
  from commandes c join boutiques b on b.id = c.boutique_id
  where c.id = commande;
  return resultat;
end $$;
revoke execute on function public.commande_a_confirmer(text, uuid) from public;
grant execute on function public.commande_a_confirmer(text, uuid) to anon, authenticated;

-- Touche « Confirmer la commande » du lien. Résultat : 'confirmee' (c'est fait), 'deja_confirmee' (confirmée,
-- prête ou récupérée), 'annulee', 'expiree'. Lien sans commande : P0002. Stock insuffisant : refus comme sur le site.
-- Usage unique : seule une commande « demandée » passe à « confirmée ».
create or replace function public.confirmer_commande_par_lien(jeton text, commande uuid) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  actuelle commandes%rowtype;
begin
  perform prive.verifier_jeton_confirmation(jeton);
  select * into actuelle from commandes c where c.id = commande for update;
  if not found then
    raise exception 'Ce lien n''est pas valide.' using errcode = 'P0002';
  end if;
  if actuelle.statut = 'demandee' then
    perform prive.confirmer_commande(actuelle.id);
    insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
    values (actuelle.id, 'confirmee', null, 'boutique', 'Confirmée depuis WhatsApp.');
    return 'confirmee';
  elsif actuelle.statut in ('confirmee', 'prete', 'recuperee') then
    return 'deja_confirmee';
  elsif actuelle.statut = 'annulee' then
    return 'annulee';
  end if;
  return 'expiree';
end $$;
revoke execute on function public.confirmer_commande_par_lien(text, uuid) from public;
grant execute on function public.confirmer_commande_par_lien(text, uuid) to anon, authenticated;

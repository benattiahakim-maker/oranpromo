-- US-26.4 : bouton « Mon QR code » dans le message WhatsApp « commande prête » (décision 5 du propriétaire, 9/10).
-- Nouveau modèle Meta 'oranpromo_commande_prete_retrait' (Utilitaire, fr), bouton lien https://<domaine>/retrait/{{1}}.
-- Désactivé tant que Meta ne l'a pas approuvé ; ensuite :
--   insert into prive.reglages (cle, valeur) values ('bouton_retrait', 'on')
--   on conflict (cle) do update set valeur = excluded.valeur;
-- Sans l'interrupteur, rien ne change : l'ancien message part, identique.
-- Le jeton de retrait n'est jamais stocké dans messages_whatsapp (la boutique lit les messages de ses commandes) :
-- la base met l'identifiant de la commande en 5e paramètre ; au moment de l'envoi, le serveur demande le jeton à
-- jeton_retrait_envoi(CRON_SECRET, commande). Voir docs/architecture.md, « Message WhatsApp (US-26.4) ».
-- Fonctions reprises : prive.messages_suivi_commande et messages_whatsapp_commande, copiées de la production
-- (empreintes vérifiées le 9/10) ; seuls la branche « prete » et la liste des modèles changent.

-- ---------------------------------------------------------------------------
-- 1. Nouveau modèle
-- ---------------------------------------------------------------------------
alter table messages_whatsapp drop constraint if exists messages_whatsapp_modele_check;
alter table messages_whatsapp add constraint messages_whatsapp_modele_check check (modele in (
  'oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete',
  'oranpromo_commande_expiree', 'oranpromo_no_show', 'oranpromo_compte_bloque',
  'oranpromo_commande_prete_ar', 'oranpromo_commande_expiree_ar', 'oranpromo_no_show_ar', 'oranpromo_compte_bloque_ar',
  'oranpromo_commande_prete_retrait'));

-- ---------------------------------------------------------------------------
-- 2. Message « commande prête » avec le bouton (interrupteur 'bouton_retrait')
-- ---------------------------------------------------------------------------
create or replace function prive.messages_suivi_commande() returns trigger
language plpgsql security definer set search_path = public as $function$
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
    -- US-26.4 : avec l'interrupteur 'bouton_retrait' = 'on', modèle avec le bouton « Mon QR code » ; 5e paramètre =
    -- identifiant de la commande, remplacé au moment de l'envoi par le jeton de retrait (jamais stocké ici).
    -- Un message qui partirait en arabe garde le modèle arabe actuel, sans bouton.
    if coalesce((select valeur from prive.reglages where cle = 'bouton_retrait'), '') = 'on'
       and not (prive.gabarit_whatsapp_arabe('oranpromo_commande_prete') is not null
                and coalesce((select r.valeur from prive.reglages r where r.cle = 'modeles_arabes'), '') = 'on'
                and prive.langue_message_whatsapp(prive.numero_whatsapp(c.client_telephone), c.id) is not distinct from 'ar') then
      perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_prete_retrait',
        'Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu''au {{4}}. Montrez votre QR code de retrait en boutique (bouton ci-dessous) et payez sur place.',
        array[nom_client, c.numero::text, c.boutique_nom,
              coalesce(to_char(c.expire_le at time zone 'Africa/Algiers', 'DD/MM à HH24"h"MI'), 'dans les 24 heures'), c.id::text], c.id);
    else
      perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_prete',
        'Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu''au {{4}}.',
        array[nom_client, c.numero::text, c.boutique_nom,
              coalesce(to_char(c.expire_le at time zone 'Africa/Algiers', 'DD/MM à HH24"h"MI'), 'dans les 24 heures')], c.id);
    end if;
  elsif new.statut = 'expiree' then
    perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_expiree',
      'Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n''a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher.',
      array[nom_client, c.numero::text, c.boutique_nom], c.id);
  end if;
  return new;
end $function$;

-- ---------------------------------------------------------------------------
-- 3. Envoi juste après l'action de la boutique : le nouveau modèle en fait partie
-- ---------------------------------------------------------------------------
create or replace function public.messages_whatsapp_commande(commande uuid)
returns table (id uuid, reservation uuid, destinataire text, modele text, parametres jsonb, texte text)
language plpgsql security definer set search_path = public as $function$
#variable_conflict use_column
begin
  if auth.uid() is null or not prive.commande_visible(commande) then
    raise exception 'Commande introuvable.' using errcode = '42501';
  end if;
  return query select * from prive.reserver_messages_whatsapp(array(
    select m.id from messages_whatsapp m
    where m.commande_id = commande and m.statut = 'a_envoyer'
      and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete', 'oranpromo_no_show',
                       'oranpromo_commande_prete_ar', 'oranpromo_no_show_ar', 'oranpromo_commande_prete_retrait')
      and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
      and m.cree_le > now() - interval '1 hour'
    order by m.cree_le
    for update skip locked
  ));
end $function$;

-- ---------------------------------------------------------------------------
-- 4. Jeton de retrait pour le bouton, réservé au serveur d'envoi (empreinte de CRON_SECRET)
-- ---------------------------------------------------------------------------
-- Rien si la commande n'est plus prête, si sa date limite est passée ou si elle n'a pas de jeton actif :
-- le serveur envoie alors l'ancien message, sans bouton.
create or replace function public.jeton_retrait_envoi(jeton text, commande uuid) returns text
language plpgsql stable security definer set search_path = public as $function$
#variable_conflict use_variable
declare
  trouve text;
begin
  perform prive.verifier_jeton_notifications(jeton);
  select r.jeton into trouve
  from prive.retraits r join commandes c on c.id = r.commande_id
  where r.commande_id = commande and r.actif and c.statut = 'prete' and c.expire_le > now();
  return trouve;
end $function$;
revoke execute on function public.jeton_retrait_envoi(text, uuid) from public;
grant execute on function public.jeton_retrait_envoi(text, uuid) to anon, authenticated;

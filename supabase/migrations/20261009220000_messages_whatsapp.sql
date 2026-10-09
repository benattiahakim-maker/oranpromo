-- US-20.5 : messages WhatsApp automatiques (WhatsApp Business API).
-- La base écrit les messages dans une file d'attente (messages_whatsapp) ; le serveur Next.js les envoie
-- par le fournisseur configuré. Sans configuration, les messages restent « a_envoyer » (rien n'est envoyé).
-- Aucun secret ici : le jeton de la tâche d'envoi est comparé à son empreinte SHA-256 rangée dans prive.reglages.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists prive.reglages (
  cle text primary key,
  valeur text not null
);
revoke all on prive.reglages from public, anon, authenticated;

create type statut_message_whatsapp as enum ('a_envoyer', 'envoye', 'echec');

create table messages_whatsapp (
  id uuid primary key default gen_random_uuid(),
  destinataire text not null check (destinataire ~ '^\+213[1-9][0-9]{8}$'),
  modele text not null check (modele in ('oranpromo_nouvelle_commande', 'oranpromo_commande_prete', 'oranpromo_commande_expiree', 'oranpromo_compte_bloque')),
  parametres jsonb not null default '[]'::jsonb check (jsonb_typeof(parametres) = 'array'),
  texte text not null,
  commande_id uuid references commandes (id) on delete cascade,
  statut statut_message_whatsapp not null default 'a_envoyer',
  tentatives integer not null default 0 check (tentatives between 0 and 5),
  reserve_jusqu_a timestamptz,
  reservation uuid,
  erreur text,
  identifiant_fournisseur text,
  cree_le timestamptz not null default now(),
  envoye_le timestamptz
);
create index messages_whatsapp_a_envoyer_idx on messages_whatsapp (cree_le) where statut = 'a_envoyer';
create index messages_whatsapp_commande_idx on messages_whatsapp (commande_id);

alter table messages_whatsapp enable row level security;
create policy "messages whatsapp lisibles par l'admin" on messages_whatsapp for select to authenticated using (prive.est_admin());
revoke insert, update, delete, truncate on messages_whatsapp from anon, authenticated;
revoke select on messages_whatsapp from anon;

-- ---------------------------------------------------------------------------
-- 2. Création des messages (déclencheurs)
-- ---------------------------------------------------------------------------
-- Numéro algérien au format international, ou null s'il n'est pas exploitable.
create or replace function prive.numero_whatsapp(numero text) returns text
language sql immutable as $$
  select case
    when chiffres ~ '^213[1-9][0-9]{8}$' then '+' || chiffres
    when chiffres ~ '^00213[1-9][0-9]{8}$' then '+' || substr(chiffres, 3)
    when chiffres ~ '^0[1-9][0-9]{8}$' then '+213' || substr(chiffres, 2)
    when chiffres ~ '^[1-9][0-9]{8}$' then '+213' || chiffres
  end
  from (select regexp_replace(coalesce(numero, ''), '\D', '', 'g') as chiffres) n
$$;

create or replace function prive.montant_da(montant integer) returns text
language sql immutable as $$
  select replace(to_char(montant, 'FM999,999,999'), ',', ' ') || ' DA'
$$;

-- Remplace {{1}}, {{2}}… par les paramètres (même texte que le modèle Meta).
create or replace function prive.ajouter_message_whatsapp(destinataire text, modele text, gabarit text, parametres text[], commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  numero text := prive.numero_whatsapp(destinataire);
  texte text := gabarit;
begin
  if numero is null then
    return; -- numéro inutilisable : pas de message
  end if;
  for i in 1 .. coalesce(array_length(parametres, 1), 0) loop
    texte := replace(texte, '{{' || i || '}}', coalesce(parametres[i], ''));
  end loop;
  insert into messages_whatsapp (destinataire, modele, parametres, texte, commande_id)
  values (numero, modele, to_jsonb(coalesce(parametres, '{}'::text[])), texte, commande);
end $$;
revoke execute on function prive.ajouter_message_whatsapp(text, text, text, text[], uuid) from public, anon, authenticated;

create or replace function prive.messages_suivi_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  articles integer;
  restants integer;
begin
  select co.id, co.numero, co.client_nom, co.client_telephone, co.total, co.expire_le, co.client_id,
         b.nom as boutique_nom, b.whatsapp as boutique_whatsapp, p.no_shows, p.bloque
  into c
  from commandes co join boutiques b on b.id = co.boutique_id left join profils p on p.id = co.client_id
  where co.id = new.commande_id;
  if not found then
    return new;
  end if;

  if new.statut = 'demandee' then
    select coalesce(sum(quantite), 0) into articles from lignes_commande where commande_id = c.id;
    perform prive.ajouter_message_whatsapp(c.boutique_whatsapp, 'oranpromo_nouvelle_commande',
      'Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace OranPromo, rubrique Commandes.',
      array[c.numero::text, c.client_nom, articles::text, prive.montant_da(c.total)], c.id);
  elsif new.statut = 'prete' then
    perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_prete',
      'Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu''au {{4}}.',
      array[c.client_nom, c.numero::text, c.boutique_nom,
            coalesce(to_char(c.expire_le at time zone 'Africa/Algiers', 'DD/MM à HH24"h"MI'), 'dans les 24 heures')], c.id);
  elsif new.statut = 'expiree' and not coalesce(c.bloque, false) then
    restants := greatest(5 - coalesce(c.no_shows, 0), 1);
    perform prive.ajouter_message_whatsapp(c.client_telephone, 'oranpromo_commande_expiree',
      'Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n''a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher. Attention : encore {{4}} commande(s) non récupérée(s) et votre compte sera bloqué.',
      array[c.client_nom, c.numero::text, c.boutique_nom, restants::text], c.id);
  end if;
  return new;
end $$;

create trigger messages_whatsapp_suivi after insert on suivi_commandes
  for each row execute function prive.messages_suivi_commande();

create or replace function prive.message_compte_bloque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.ajouter_message_whatsapp(new.telephone, 'oranpromo_compte_bloque',
    'Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo.',
    array[coalesce(new.nom, 'cher client')], null);
  return new;
end $$;

create trigger messages_whatsapp_blocage after update of bloque on profils
  for each row when (new.bloque and not old.bloque) execute function prive.message_compte_bloque();

-- L'expiration compte le no-show AVANT d'écrire le suivi : le message d'expiration donne le bon nombre
-- d'essais restants, et n'est pas envoyé si le compte vient d'être bloqué (message de blocage à la place).
create or replace function prive.expirer_commandes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  expiree record;
  nombre integer := 0;
begin
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  for expiree in
    select c.id, c.client_id from commandes c
    where c.statut = 'prete' and c.expire_le <= now()
    order by c.expire_le
    for update skip locked
  loop
    perform prive.remettre_stock(expiree.id);
    update commandes c set statut = 'expiree', terminee_le = now() where c.id = expiree.id;
    -- Les expressions de droite lisent les valeurs d'avant la mise à jour.
    update profils p set
      no_shows = p.no_shows + 1,
      bloque = p.bloque or p.no_shows + 1 >= 5,
      bloque_le = case when not p.bloque and p.no_shows + 1 >= 5 then now() else p.bloque_le end
    where p.id = expiree.client_id;
    insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
    values (expiree.id, 'expiree', null, 'systeme', 'Non récupérée dans les 24 heures.');
    nombre := nombre + 1;
  end loop;
  return nombre;
end $$;
revoke execute on function prive.expirer_commandes() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Envoi : réservation (2 minutes) et résultat
-- ---------------------------------------------------------------------------
create or replace function prive.reserver_messages_whatsapp(ids uuid[]) returns table (
  id uuid, reservation uuid, destinataire text, modele text, parametres jsonb, texte text
) language plpgsql security definer set search_path = public as $$
begin
  return query
  update messages_whatsapp m set reserve_jusqu_a = now() + interval '2 minutes', reservation = gen_random_uuid()
  where m.id = any (ids)
  returning m.id, m.reservation, m.destinataire, m.modele, m.parametres, m.texte;
end $$;
revoke execute on function prive.reserver_messages_whatsapp(uuid[]) from public, anon, authenticated;

-- Juste après une action : messages « nouvelle commande » et « commande prête » de cette commande,
-- pour ses participants seulement. Les rappels (expiration, blocage) passent par la tâche d'envoi.
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
      and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_commande_prete')
      and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
      and m.cree_le > now() - interval '1 hour'
    order by m.cree_le
    for update skip locked
  ));
end $$;
revoke execute on function public.messages_whatsapp_commande(uuid) from public, anon;
grant execute on function public.messages_whatsapp_commande(uuid) to authenticated;

-- Tâche planifiée : tous les messages en attente. Le jeton est comparé à l'empreinte rangée par l'admin :
--   insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('<CRON_SECRET>', 'UTF8')), 'hex'))
--   on conflict (cle) do update set valeur = excluded.valeur;
create or replace function public.messages_whatsapp_en_attente(jeton text, limite integer default 20) returns table (
  id uuid, reservation uuid, destinataire text, modele text, parametres jsonb, texte text
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  attendu text;
begin
  select valeur into attendu from prive.reglages where cle = 'jeton_notifications';
  if attendu is null or jeton is null or length(jeton) < 16
     or encode(sha256(convert_to(jeton, 'UTF8')), 'hex') <> attendu then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  -- Trop anciens : on n'envoie plus (un rappel de 3 jours n'a plus de sens).
  update messages_whatsapp m set statut = 'echec', erreur = 'Trop ancien, non envoyé.'
  where m.statut = 'a_envoyer' and m.cree_le < now() - interval '3 days';
  return query select * from prive.reserver_messages_whatsapp(array(
    select m.id from messages_whatsapp m
    where m.statut = 'a_envoyer' and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
    order by m.cree_le
    limit least(greatest(coalesce(limite, 20), 1), 100)
    for update skip locked
  ));
end $$;
revoke execute on function public.messages_whatsapp_en_attente(text, integer) from public;
grant execute on function public.messages_whatsapp_en_attente(text, integer) to anon, authenticated;

-- Résultat d'un envoi, accepté seulement avec la réservation remise au moment de l'envoi.
create or replace function public.resultat_message_whatsapp(message uuid, reservation uuid, succes boolean,
  identifiant text default null, erreur text default null, definitif boolean default false) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  update messages_whatsapp m set
    statut = case when succes then 'envoye'::statut_message_whatsapp
                  when definitif or m.tentatives + 1 >= 5 then 'echec'::statut_message_whatsapp
                  else 'a_envoyer'::statut_message_whatsapp end,
    tentatives = least(m.tentatives + 1, 5),
    envoye_le = case when succes then now() else null end,
    identifiant_fournisseur = case when succes then left(identifiant, 200) else m.identifiant_fournisseur end,
    erreur = case when succes then null else left(coalesce(erreur, 'Erreur inconnue.'), 500) end,
    -- Après un échec, on attend 2 minutes avant de réessayer.
    reserve_jusqu_a = case when succes then null else now() + interval '2 minutes' end,
    reservation = null
  where m.id = message and m.reservation = reservation and m.statut = 'a_envoyer';
end $$;
revoke execute on function public.resultat_message_whatsapp(uuid, uuid, boolean, text, text, boolean) from public;
grant execute on function public.resultat_message_whatsapp(uuid, uuid, boolean, text, text, boolean) to anon, authenticated;

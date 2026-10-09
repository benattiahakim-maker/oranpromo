-- US-23 (étape 4) : messages WhatsApp au client en arabe (darja), avec repli en français.
-- La langue de la commande est celle du site au moment de la commande (cookie « langue »).
-- Les messages au client (commande prête, commande expirée, client pas venu, compte bloqué) partent en arabe
-- seulement si la commande est en arabe ET si les modèles arabes sont approuvés par Meta (interrupteur) :
--   insert into prive.reglages (cle, valeur) values ('modeles_arabes', 'on')
--   on conflict (cle) do update set valeur = excluded.valeur;
-- Tant que l'interrupteur n'est pas « on », tout part en français, comme avant.
-- Les modèles arabes portent le nom du modèle français suivi de « _ar » (langue Meta « ar »).
-- Le message à la boutique (nouvelle commande) reste en français.
-- Aucune règle de blocage, de no-show ou de vérification du numéro n'est modifiée : seule la fonction qui écrit
-- dans la file (prive.ajouter_message_whatsapp) choisit le texte.
-- Voir docs/architecture.md, « Arabe et darja (US-23) ».

-- ---------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------
alter table commandes add column langue text not null default 'fr' check (langue in ('fr', 'ar'));
alter table messages_whatsapp add column langue text not null default 'fr' check (langue in ('fr', 'ar'));

alter table messages_whatsapp drop constraint if exists messages_whatsapp_modele_check;
alter table messages_whatsapp add constraint messages_whatsapp_modele_check check (modele in (
  'oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete',
  'oranpromo_commande_expiree', 'oranpromo_no_show', 'oranpromo_compte_bloque',
  'oranpromo_commande_prete_ar', 'oranpromo_commande_expiree_ar', 'oranpromo_no_show_ar', 'oranpromo_compte_bloque_ar'));

-- ---------------------------------------------------------------------------
-- 2. Langue de la commande (juste après passer_commande, par le client lui-même)
-- ---------------------------------------------------------------------------
create or replace function public.definir_langue_commande(commande uuid, langue text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour modifier une commande.' using errcode = '42501';
  end if;
  if langue is null or langue not in ('fr', 'ar') then
    raise exception 'Langue inconnue.' using errcode = '22023';
  end if;
  update commandes c set langue = langue where c.id = commande and c.client_id = auth.uid();
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.definir_langue_commande(uuid, text) from public, anon;
grant execute on function public.definir_langue_commande(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Textes arabes (mêmes paramètres, même ordre que les modèles français)
-- ---------------------------------------------------------------------------
-- null : pas de version arabe (message à la boutique).
create or replace function prive.gabarit_whatsapp_arabe(modele text) returns text
language sql immutable as $$
  select case modele
    -- Texte validé n° 10 (propriétaire, 9/10/2026).
    when 'oranpromo_commande_prete' then 'السلام {{1}}، الطلب رقم {{2}} راهو واجد عند {{3}}. تقدر تجي تدّيه حتى {{4}}.'
    when 'oranpromo_commande_expiree' then 'السلام {{1}}، الطلب رقم {{2}} عند {{3}} ما تدّاش في 24 ساعة: تلغات والسلعة رجعت للبيع. من فضلك ما تطلب غير واش راك تجي تدّي.'
    when 'oranpromo_no_show' then 'السلام {{1}}، {{2}} قالولنا بلي ما جيتش تدّي الطلب رقم {{3}}. عندك دروك {{4}} طلبات ما تدّاوش: كان زادو {{5}} يتبلوكا حسابك في OranPromo. من فضلك ما تطلب غير واش راك تجي تدّي.'
    when 'oranpromo_compte_bloque' then 'السلام {{1}}، حسابك في OranPromo تبلوكا من بعد 5 طلبات ما تدّاوش. باش يتحلّ، اتصل بـ OranPromo.'
  end
$$;

-- Paramètres écrits en français par les fonctions existantes → version arabe.
create or replace function prive.parametres_whatsapp_arabe(modele text, parametres text[]) returns text[]
language plpgsql immutable as $$
declare
  resultat text[] := coalesce(parametres, '{}'::text[]);
begin
  -- Nom absent ou refusé : « cher client » → « خويا » (masculin générique, comme les textes validés).
  if resultat[1] = 'cher client' then
    resultat[1] := 'خويا';
  end if;
  if modele = 'oranpromo_commande_prete' and array_length(resultat, 1) >= 4 then
    resultat[4] := case
      when resultat[4] ~ '^\d{2}/\d{2} à \d{2}h\d{2}$'
        then regexp_replace(resultat[4], '^(\d{2}/\d{2}) à (\d{2})h(\d{2})$', '\1 على \2:\3')
      when resultat[4] = 'dans les 24 heures' then 'تفوت 24 ساعة'
      else resultat[4] end;
  end if;
  return resultat;
end $$;

-- Langue du client destinataire : celle de la commande ; pour le blocage (sans commande), celle de sa dernière commande.
create or replace function prive.langue_message_whatsapp(numero text, commande uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    case when langue_message_whatsapp.commande is not null
         then (select c.langue from commandes c where c.id = langue_message_whatsapp.commande)
         else (select c.langue from commandes c where prive.numero_whatsapp(c.client_telephone) = langue_message_whatsapp.numero
               order by c.cree_le desc, c.numero desc limit 1) end,
    'fr')
$$;

-- Même fonction qu'avant (20261009220000_messages_whatsapp) : en plus, version arabe pour un client arabophone
-- quand les modèles arabes sont approuvés ; sinon texte français (repli).
create or replace function prive.ajouter_message_whatsapp(destinataire text, modele text, gabarit text, parametres text[], commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  numero text := prive.numero_whatsapp(destinataire);
  texte text := gabarit;
  nom_modele text := modele;
  valeurs text[] := coalesce(parametres, '{}'::text[]);
  langue_message text := 'fr';
begin
  if numero is null then
    return; -- numéro inutilisable : pas de message
  end if;
  if prive.gabarit_whatsapp_arabe(modele) is not null
     and coalesce((select r.valeur from prive.reglages r where r.cle = 'modeles_arabes'), '') = 'on'
     and prive.langue_message_whatsapp(numero, commande) = 'ar' then
    langue_message := 'ar';
    nom_modele := modele || '_ar';
    texte := prive.gabarit_whatsapp_arabe(modele);
    valeurs := prive.parametres_whatsapp_arabe(modele, valeurs);
  end if;
  for i in 1 .. coalesce(array_length(valeurs, 1), 0) loop
    texte := replace(texte, '{{' || i || '}}', coalesce(valeurs[i], ''));
  end loop;
  insert into messages_whatsapp (destinataire, modele, parametres, texte, commande_id, langue)
  values (numero, nom_modele, to_jsonb(valeurs), texte, commande, langue_message);
end $$;
revoke execute on function prive.ajouter_message_whatsapp(text, text, text, text[], uuid) from public, anon, authenticated;
revoke execute on function prive.gabarit_whatsapp_arabe(text) from public, anon, authenticated;
revoke execute on function prive.parametres_whatsapp_arabe(text, text[]) from public, anon, authenticated;
revoke execute on function prive.langue_message_whatsapp(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Envoi juste après l'action : les versions arabes partent aussi tout de suite
-- ---------------------------------------------------------------------------
-- Même fonction qu'avant (20261010190000_confirmer_whatsapp), liste des modèles complétée.
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
      and m.modele in ('oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete', 'oranpromo_no_show',
                       'oranpromo_commande_prete_ar', 'oranpromo_no_show_ar')
      and (m.reserve_jusqu_a is null or m.reserve_jusqu_a < now())
      and m.cree_le > now() - interval '1 hour'
    order by m.cree_le
    for update skip locked
  ));
end $$;
revoke execute on function public.messages_whatsapp_commande(uuid) from public, anon;
grant execute on function public.messages_whatsapp_commande(uuid) to authenticated;

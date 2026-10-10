-- US-31.5 : alerte WhatsApp « nouvelles promos » des boutiques suivies (Marketing, consentement séparé).
-- Voir docs/user-stories.md, module 17, et docs/architecture.md, « Alerte WhatsApp (US-31.5) ».
-- ÉTEINTE PAR DÉFAUT (décision du propriétaire : « plus tard, après les conditions ») : tant que le réglage
-- 'alertes_whatsapp' n'est pas 'on', la case n'est proposée nulle part, aucune promo n'est notée et aucun message
-- n'est écrit. Même allumée, rien ne part sans plafond mensuel ('alertes_plafond_mois' absent ou 0 = arrêt).
-- Mise en route (propriétaire, SQL Editor) seulement APRÈS la relecture de l'avocat et l'APPROBATION par Meta du
-- modèle Marketing 'bledeal_nouvelles_promos' (et 'bledeal_nouvelles_promos_ar' pour l'arabe) :
--   insert into prive.reglages (cle, valeur) values ('alertes_whatsapp', 'on'), ('alertes_plafond_mois', '5000')
--   on conflict (cle) do update set valeur = excluded.valeur;
--   -- arabe, une fois le modèle arabe approuvé :
--   insert into prive.reglages (cle, valeur) values ('alertes_modele_arabe', 'on') on conflict (cle) do update set valeur = excluded.valeur;
-- Règles : case séparée, jamais cochée d'office, suivre une boutique ne vaut pas accord (lois 18-05, art. 31 à 33 ;
-- 18-07, art. 37) ; preuve gardée (journal) ; un message par jour et par client au plus, seulement s'il y a du nouveau ;
-- désabonnement par lien sans connexion, effet immédiat ; numéro vérifié seulement ; pas de compte bloqué.
-- Ce qui ne change pas : abonnements (US-31.1), blocage, no-shows, numéro, statuts, stock, bons, messages existants
-- (ajouter_message_whatsapp, file, envoi, résultat).
-- Écart avec la conception (colonnes alerte_whatsapp / alerte_consentie_le dans abonnements_boutique) : l'accord vaut
-- pour toutes les boutiques suivies (« des boutiques que je suis ») ; il est donc gardé par compte, dans le schéma
-- privé (prive.alertes_whatsapp), avec un journal des accords et retraits (prive.journal_alertes_whatsapp). Le lien de
-- désabonnement porte un jeton aléatoire gardé en base (pas de nouveau secret à configurer), donné au serveur d'envoi
-- au dernier moment, comme le jeton de retrait (US-26.4) : il n'est jamais écrit dans messages_whatsapp.

-- ---------------------------------------------------------------------------
-- 1. Tables (schéma privé : ni l'API ni PostgREST n'y ont accès)
-- ---------------------------------------------------------------------------
create table prive.alertes_whatsapp (
  profil_id uuid primary key references public.profils(id) on delete cascade,
  actif boolean not null default false,
  langue text not null default 'fr' check (langue in ('fr', 'ar')),
  consentie_le timestamptz,
  retiree_le timestamptz,
  derniere_alerte timestamptz,
  jeton text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  check (not actif or consentie_le is not null)
);
create index alertes_whatsapp_actives_idx on prive.alertes_whatsapp (consentie_le) where actif;

-- Preuve (loi 18-05, art. 33) : chaque accord et chaque retrait, avec le numéro et la version du texte de la case.
create table prive.journal_alertes_whatsapp (
  id bigint generated always as identity primary key,
  profil_id uuid not null references public.profils(id) on delete cascade,
  action text not null check (action in ('accord', 'retrait')),
  source text not null check (source in ('vitrine', 'compte', 'lien')),
  numero text,
  texte text,
  le timestamptz not null default now()
);
create index journal_alertes_whatsapp_profil_idx on prive.journal_alertes_whatsapp (profil_id, le);

-- Promos créées ou réactivées (notées seulement quand les alertes sont allumées ; gardées 7 jours).
create table prive.nouvelles_promos (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  le timestamptz not null default now()
);
create index nouvelles_promos_boutique_idx on prive.nouvelles_promos (boutique_id, le);

revoke all on prive.alertes_whatsapp, prive.journal_alertes_whatsapp, prive.nouvelles_promos from public, anon, authenticated;

-- Texte de la case, version du 10/10/2026 (gardé dans le journal à chaque accord).
create or replace function prive.texte_accord_alertes(langue text) returns text
language sql immutable set search_path = public as $$
  select case when langue = 'ar'
    then 'نحب يجيني على الواتساب البروموات الجداد تاع الحوانت اللي نتبّعهم (ميساج واحد في النهار على الأكثر). نقدر نحبّس وقتما حبيت. (10/10/2026)'
    else 'Recevoir sur WhatsApp les nouvelles promos des boutiques que je suis (un message par jour au plus). Je peux arrêter à tout moment. (10/10/2026)' end
$$;

create or replace function prive.alertes_proposees() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select r.valeur = 'on' from prive.reglages r where r.cle = 'alertes_whatsapp'), false)
$$;

-- ---------------------------------------------------------------------------
-- 2. Nouveau modèle Meta (Marketing)
-- ---------------------------------------------------------------------------
alter table messages_whatsapp drop constraint if exists messages_whatsapp_modele_check;
alter table messages_whatsapp add constraint messages_whatsapp_modele_check check (modele in (
  'oranpromo_nouvelle_commande', 'oranpromo_nouvelle_commande_confirmer', 'oranpromo_commande_prete',
  'oranpromo_commande_expiree', 'oranpromo_no_show', 'oranpromo_compte_bloque',
  'oranpromo_commande_prete_ar', 'oranpromo_commande_expiree_ar', 'oranpromo_no_show_ar', 'oranpromo_compte_bloque_ar',
  'oranpromo_commande_prete_retrait',
  'bledeal_nouvelles_promos', 'bledeal_nouvelles_promos_ar'));

-- La page /alertes/<jeton> : « alertes » ne peut jamais devenir le code d'une ville (contrainte à part, comme
-- villes_code_libre_campagne ; même liste que CODES_RESERVES dans lib/ville.ts).
alter table public.villes add constraint villes_code_libre_alertes check (code <> 'alertes');

-- ---------------------------------------------------------------------------
-- 3. Accord et retrait (client connecté)
-- ---------------------------------------------------------------------------
-- État pour l'écran : alertes proposées (réglage) et actives pour ce compte. Visiteur : jamais actives.
create or replace function public.etat_alertes_whatsapp() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('proposees', prive.alertes_proposees(),
    'actives', coalesce((select a.actif from prive.alertes_whatsapp a where a.profil_id = auth.uid()), false))
$$;
revoke execute on function public.etat_alertes_whatsapp() from public;
grant execute on function public.etat_alertes_whatsapp() to anon, authenticated;

-- Accord (case cochée puis « Enregistrer ») : client seulement, alertes proposées.
create or replace function public.activer_alertes_whatsapp(langue text, source text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid := auth.uid();
  numero text;
begin
  if compte is null then
    raise exception 'Connectez-vous pour recevoir les alertes.' using errcode = '42501';
  end if;
  if not exists (select 1 from profils p where p.id = compte and p.role = 'client') then
    raise exception 'Réservé aux clients.' using errcode = '42501';
  end if;
  if not prive.alertes_proposees() then
    raise exception 'Les alertes WhatsApp ne sont pas encore proposées.' using errcode = '55000';
  end if;
  if langue is null or langue not in ('fr', 'ar') or source is null or source not in ('vitrine', 'compte') then
    raise exception 'Paramètre inconnu.' using errcode = '22023';
  end if;
  select p.telephone into numero from profils p where p.id = compte;
  insert into prive.alertes_whatsapp as a (profil_id, actif, langue, consentie_le, retiree_le)
  values (compte, true, langue, now(), null)
  on conflict (profil_id) do update set actif = true, langue = excluded.langue, consentie_le = now(), retiree_le = null
  where not a.actif or a.langue <> excluded.langue;
  if found then
    insert into prive.journal_alertes_whatsapp (profil_id, action, source, numero, texte)
    values (compte, 'accord', source, numero, prive.texte_accord_alertes(langue));
  end if;
end $$;
revoke execute on function public.activer_alertes_whatsapp(text, text) from public, anon;
grant execute on function public.activer_alertes_whatsapp(text, text) to authenticated;

-- Retrait, toujours possible (même alertes éteintes).
create or replace function prive.retirer_alertes(compte uuid, source text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update prive.alertes_whatsapp a set actif = false, retiree_le = now() where a.profil_id = compte and a.actif;
  if not found then
    return false;
  end if;
  insert into prive.journal_alertes_whatsapp (profil_id, action, source, numero)
  values (compte, 'retrait', source, (select p.telephone from profils p where p.id = compte));
  return true;
end $$;

create or replace function public.desactiver_alertes_whatsapp() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour arrêter les alertes.' using errcode = '42501';
  end if;
  perform prive.retirer_alertes(auth.uid(), 'compte');
end $$;
revoke execute on function public.desactiver_alertes_whatsapp() from public, anon;
grant execute on function public.desactiver_alertes_whatsapp() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Désabonnement par lien, sans connexion (/alertes/<jeton>)
-- ---------------------------------------------------------------------------
-- Lecture : 'actives', 'desactivees', ou null (lien inconnu). Rien d'autre sur le compte.
create or replace function public.etat_alertes_par_lien(jeton text) returns text
language sql stable security definer set search_path = public as $$
  select case when a.actif then 'actives' else 'desactivees' end
  from prive.alertes_whatsapp a
  where etat_alertes_par_lien.jeton ~ '^[0-9a-f]{48}$' and a.jeton = etat_alertes_par_lien.jeton
$$;
revoke execute on function public.etat_alertes_par_lien(text) from public;
grant execute on function public.etat_alertes_par_lien(text) to anon, authenticated;

-- Effet immédiat (loi 18-05, art. 32 : au plus 24 h ; la page affichée sert d'accusé de réception).
-- Renvoie 'desactivees' (aussi si c'était déjà fait) ou null (lien inconnu).
create or replace function public.desactiver_alertes_par_lien(jeton text) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  compte uuid;
begin
  if jeton is null or jeton !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  select a.profil_id into compte from prive.alertes_whatsapp a where a.jeton = jeton;
  if compte is null then
    return null;
  end if;
  perform prive.retirer_alertes(compte, 'lien');
  return 'desactivees';
end $$;
revoke execute on function public.desactiver_alertes_par_lien(text) from public;
grant execute on function public.desactiver_alertes_par_lien(text) to anon, authenticated;

-- Jeton du bouton « Ne plus recevoir », pour le serveur d'envoi seulement (empreinte de CRON_SECRET), au moment
-- de l'envoi : null si les alertes ont été arrêtées entre-temps (le message ne part pas).
create or replace function public.jeton_alertes_envoi(jeton text, profil uuid) returns text
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare
  trouve text;
begin
  perform prive.verifier_jeton_notifications(jeton);
  select a.jeton into trouve from prive.alertes_whatsapp a where a.profil_id = profil and a.actif;
  return trouve;
end $$;
revoke execute on function public.jeton_alertes_envoi(text, uuid) from public;
grant execute on function public.jeton_alertes_envoi(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Promos nouvelles ou réactivées (seulement quand les alertes sont allumées)
-- ---------------------------------------------------------------------------
create or replace function prive.noter_nouvelle_promo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if prive.alertes_proposees() then
      insert into prive.nouvelles_promos (article_id, boutique_id)
      select a.id, a.boutique_id from articles a where a.id = new.article_id;
    end if;
  exception when others then
    raise warning 'Promo non notée pour les alertes (%) : %', new.article_id, sqlerrm;
  end;
  return null;
end $$;
create trigger z_alerte_nouvelle_promo after insert on public.promos
  for each row execute function prive.noter_nouvelle_promo();
create trigger z_alerte_promo_reactivee after update of date_fin on public.promos
  for each row when (old.date_fin <= now() and new.date_fin > now())
  execute function prive.noter_nouvelle_promo();

-- ---------------------------------------------------------------------------
-- 6. Préparation quotidienne (9 h 50 à Alger, avant la tâche d'envoi de 10 h)
-- ---------------------------------------------------------------------------
-- Pour chaque compte avec des alertes actives (client, numéro vérifié, pas bloqué), compte les boutiques suivies
-- (validées) qui ont au moins une promo nouvelle depuis la veille (et depuis l'accord et la dernière alerte), encore
-- en cours et visible. S'il y en a : un message, au plus un par jour, dans la limite du plafond du mois.
-- Renvoie le nombre de messages écrits.
create or replace function prive.preparer_alertes_whatsapp() returns integer
language plpgsql security definer set search_path = public as $$
declare
  plafond integer;
  deja integer;
  ecrits integer := 0;
  debut_jour timestamptz := date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  arabe boolean := coalesce((select g.valeur = 'on' from prive.reglages g where g.cle = 'alertes_modele_arabe'), false);
  r record;
  prenom text;
  resume text;
  numero text;
begin
  delete from prive.nouvelles_promos n where n.le < now() - interval '7 days';
  if not prive.alertes_proposees() then
    return 0;
  end if;
  plafond := coalesce((select case when g.valeur ~ '^\d{1,9}$' then g.valeur::integer end
                       from prive.reglages g where g.cle = 'alertes_plafond_mois'), 0);
  select count(*) into deja from messages_whatsapp m
  where m.modele in ('bledeal_nouvelles_promos', 'bledeal_nouvelles_promos_ar')
    and m.cree_le >= date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  if plafond - deja <= 0 then
    return 0;
  end if;
  for r in
    select a.profil_id, a.langue, p.telephone, p.nom, x.nombre, x.premiere
    from prive.alertes_whatsapp a
    join profils p on p.id = a.profil_id
    cross join lateral (
      select count(*)::integer as nombre, (array_agg(t.nom order by t.derniere desc, t.nom))[1] as premiere
      from (select bo.nom, max(n.le) as derniere
            from abonnements_boutique ab
            join boutiques bo on bo.id = ab.boutique_id and bo.statut = 'validee'
            join prive.nouvelles_promos n on n.boutique_id = bo.id
            join promos pr on pr.article_id = n.article_id and pr.date_fin > now()
            where ab.profil_id = a.profil_id
              and n.le > greatest(now() - interval '1 day', a.consentie_le, coalesce(a.derniere_alerte, '-infinity'))
              and prive.article_visible(n.article_id)
            group by bo.id, bo.nom) t
    ) x
    where a.actif and p.role = 'client' and p.telephone_verifie_le is not null and not p.bloque
      and x.nombre > 0
      and (a.derniere_alerte is null or a.derniere_alerte < debut_jour)
    order by a.consentie_le
    limit plafond - deja
  loop
    numero := prive.numero_whatsapp(r.telephone);
    continue when numero is null;
    if exists (select 1 from messages_whatsapp m where m.destinataire = numero and m.cree_le >= debut_jour
               and m.modele in ('bledeal_nouvelles_promos', 'bledeal_nouvelles_promos_ar')) then
      continue;
    end if;
    prenom := case when prive.nom_valide(r.nom) then split_part(trim(r.nom), ' ', 1) end;
    -- 3e paramètre : identifiant du compte, remplacé au moment de l'envoi par le jeton du lien « Ne plus recevoir ».
    if arabe and r.langue = 'ar' then
      resume := case when r.nombre > 1 then r.premiere || ' و ' || (r.nombre - 1) || ' حوانت خرين' else r.premiere end;
      insert into messages_whatsapp (destinataire, modele, parametres, texte, langue)
      values (numero, 'bledeal_nouvelles_promos_ar', to_jsonb(array[coalesce(prenom, 'خويا'), resume, r.profil_id::text]),
              'السلام ' || coalesce(prenom, 'خويا') || '، كاين بروموات جداد في BleDeal عند الحوانت اللي تتبّعهم: ' || resume || '.', 'ar');
    else
      resume := case when r.nombre > 1 then r.premiere || ' et ' || (r.nombre - 1) || ' autre(s)' else r.premiere end;
      insert into messages_whatsapp (destinataire, modele, parametres, texte, langue)
      values (numero, 'bledeal_nouvelles_promos', to_jsonb(array[coalesce(prenom, 'cher client'), resume, r.profil_id::text]),
              'Bonjour ' || coalesce(prenom, 'cher client') || ', de nouvelles promos sur BleDeal dans les boutiques que vous suivez : ' || resume || '.', 'fr');
    end if;
    update prive.alertes_whatsapp a set derniere_alerte = now() where a.profil_id = r.profil_id;
    ecrits := ecrits + 1;
  end loop;
  return ecrits;
end $$;

revoke execute on function prive.texte_accord_alertes(text), prive.alertes_proposees(), prive.retirer_alertes(uuid, text),
  prive.noter_nouvelle_promo(), prive.preparer_alertes_whatsapp()
  from public, anon, authenticated;

-- Chaque jour à 9 h 50 heure d'Alger (8 h 50 UTC). Sans le réglage, la fonction ne fait que purger.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise warning 'pg_cron indisponible : lancer chaque jour select prive.preparer_alertes_whatsapp() (voir la migration 20261020100000).';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('alertes-whatsapp', '50 8 * * *', 'select prive.preparer_alertes_whatsapp()');
exception when others then
  raise warning 'Tâche planifiée non créée (%) : activer pg_cron puis lancer cron.schedule (voir la migration 20261020100000).', sqlerrm;
end $$;

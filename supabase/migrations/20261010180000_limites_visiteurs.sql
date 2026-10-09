-- Sécurité · Limiter les envois en masse (vues, clics « Ajouter au panier », partages, signalements).
-- Avant : tout visiteur pouvait insérer directement dans evenements et signalements avec la clé publique ; les seules
-- limites (PR #2, migration securite_points_mineurs) étaient globales : 120 événements par minute et par boutique,
-- 10 signalements par heure et par article, 200 par heure au total. Impossible de distinguer deux visiteurs.
-- Désormais :
--   1. plus aucune insertion directe (politiques supprimées, droit INSERT retiré à anon et authenticated) ;
--   2. tout passe par deux fonctions de la base, appelées par les actions serveur du site avec un secret serveur
--      (VISITEURS_SECRET, empreinte SHA-256 dans prive.reglages, clé « jeton_visiteurs ») ;
--   3. limite PAR VISITEUR, tenue par la base dans prive.actions_visiteurs (lignes de plus de 24 h supprimées) :
--      - compte connecté : clé « u:<identifiant du compte> », prise dans la session (auth.uid()), jamais dans la requête ;
--      - visiteur anonyme : clé « ip:<HMAC-SHA256 de l'adresse IP> » calculée par le serveur avec le secret : l'adresse
--        IP n'est jamais enregistrée en clair, et la clé ne peut pas être inventée sans le secret.
--   Les limites globales de la PR #2 restent en place (déclencheurs evenement_controle et signalement_controle).
--   Pour activer (sinon les mesures sont ignorées et les signalements refusés) :
--     insert into prive.reglages (cle, valeur)
--     values ('jeton_visiteurs', encode(sha256(convert_to('<VISITEURS_SECRET>', 'UTF8')), 'hex'))
--     on conflict (cle) do update set valeur = excluded.valeur;

create table prive.actions_visiteurs (
  id bigint generated always as identity primary key,
  visiteur text not null,
  action text not null,
  cible text not null,
  date timestamptz not null default now()
);
create index actions_visiteurs_visiteur_idx on prive.actions_visiteurs (visiteur, action, date);
create index actions_visiteurs_date_idx on prive.actions_visiteurs (date);
revoke all on prive.actions_visiteurs from public, anon, authenticated;

-- Jeton du serveur (VISITEURS_SECRET) : sans lui, personne ne peut appeler les fonctions ci-dessous.
create or replace function prive.verifier_jeton_visiteurs(jeton text) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  attendu text;
begin
  select valeur into attendu from prive.reglages where cle = 'jeton_visiteurs';
  if attendu is null or jeton is null or length(jeton) < 16
     or encode(sha256(convert_to(jeton, 'UTF8')), 'hex') <> attendu then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
end $$;
revoke execute on function prive.verifier_jeton_visiteurs(text) from public, anon, authenticated;

-- Clé du visiteur : le compte connecté d'abord (session), sinon l'empreinte d'adresse IP fournie par le serveur.
create or replace function prive.cle_visiteur(visiteur text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    return 'u:' || auth.uid()::text;
  end if;
  if visiteur is null or visiteur !~ '^ip:[0-9a-f]{64}$' then
    raise exception 'Visiteur inconnu.' using errcode = '22023';
  end if;
  return visiteur;
end $$;
revoke execute on function prive.cle_visiteur(text) from public, anon, authenticated;

-- Statistiques : vue d'article ou de boutique, clic « Ajouter au panier » (clic_reserver), partage.
-- Renvoie true si l'événement est compté, false s'il est ignoré :
--   - même visiteur, même type, même boutique / article / taille dans les 10 dernières minutes (rechargements) ;
--   - plus de 300 événements par heure pour ce visiteur (aucun humain ne voit 300 pages par heure ; une adresse IP
--     partagée par beaucoup de clients d'un opérateur mobile peut l'atteindre : les mesures en trop sont perdues,
--     la page fonctionne normalement).
create or replace function public.enregistrer_evenement(jeton text, visiteur text, type type_evenement, boutique uuid,
  article uuid default null, taille text default null) returns boolean
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  cle text;
  cible_action text;
begin
  perform prive.verifier_jeton_visiteurs(jeton);
  cle := prive.cle_visiteur(visiteur);
  -- Mêmes règles que l'ancienne politique d'insertion : boutique publique, article visible de cette boutique.
  if not exists (select 1 from boutiques b where b.id = boutique and b.statut = 'validee')
     or (article is not null and not (prive.article_visible(article)
         and exists (select 1 from articles a where a.id = article and a.boutique_id = boutique)))
     or (taille is not null and char_length(taille) > 20) then
    raise exception 'Événement refusé.' using errcode = '22023';
  end if;
  cible_action := type::text || ':' || boutique::text || ':' || coalesce(article::text, '') || ':' || coalesce(taille, '');
  delete from prive.actions_visiteurs a where a.date < now() - interval '1 day';
  if exists (select 1 from prive.actions_visiteurs a where a.visiteur = cle and a.action = 'evenement'
             and a.cible = cible_action and a.date > now() - interval '10 minutes') then
    return false;
  end if;
  if (select count(*) from prive.actions_visiteurs a where a.visiteur = cle and a.action = 'evenement'
      and a.date > now() - interval '1 hour') >= 300 then
    return false;
  end if;
  insert into evenements (type, boutique_id, article_id, taille) values (type, boutique, article, taille);
  insert into prive.actions_visiteurs (visiteur, action, cible) values (cle, 'evenement', cible_action);
  return true;
end $$;

-- Signalement d'un article visible du public. Par visiteur : un seul signalement par article en 24 h, 5 par heure.
create or replace function public.signaler_article(jeton text, visiteur text, article uuid, motif text,
  commentaire text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  cle text;
  texte text := nullif(btrim(coalesce(commentaire, '')), '');
begin
  perform prive.verifier_jeton_visiteurs(jeton);
  cle := prive.cle_visiteur(visiteur);
  if motif is null or motif not in ('contrefacon', 'contenu_inapproprie', 'arnaque', 'autre') then
    raise exception 'Choisissez un motif.' using errcode = '22023';
  end if;
  if texte is not null and char_length(texte) > 1000 then
    raise exception 'Le commentaire doit contenir 1000 caractères au plus.' using errcode = '22023';
  end if;
  if article is null or not prive.article_visible(article) then
    raise exception 'Cet article n''est plus en ligne.' using errcode = '22023';
  end if;
  delete from prive.actions_visiteurs a where a.date < now() - interval '1 day';
  if exists (select 1 from prive.actions_visiteurs a where a.visiteur = cle and a.action = 'signalement'
             and a.cible = article::text and a.date > now() - interval '1 day') then
    raise exception 'Vous avez déjà signalé cet article, merci. Il sera examiné rapidement.' using errcode = '54000';
  end if;
  if (select count(*) from prive.actions_visiteurs a where a.visiteur = cle and a.action = 'signalement'
      and a.date > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de signalements envoyés : réessayez dans une heure.' using errcode = '54000';
  end if;
  insert into signalements (article_id, motif, commentaire) values (article, motif, texte);
  insert into prive.actions_visiteurs (visiteur, action, cible) values (cle, 'signalement', article::text);
end $$;

revoke execute on function public.enregistrer_evenement(text, text, type_evenement, uuid, uuid, text) from public;
revoke execute on function public.signaler_article(text, text, uuid, text, text) from public;
grant execute on function public.enregistrer_evenement(text, text, type_evenement, uuid, uuid, text) to anon, authenticated;
grant execute on function public.signaler_article(text, text, uuid, text, text) to anon, authenticated;

-- Plus d'insertion directe avec la clé publique.
drop policy "visiteur enregistre un événement" on evenements;
drop policy "visiteur signale" on signalements;
revoke insert on evenements from anon, authenticated;
revoke insert on signalements from anon, authenticated;

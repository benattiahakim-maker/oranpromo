-- US-26.1 : retrait par QR code (jeton de 128 bits et code à 4 chiffres par commande prête) et mode de remise.
-- Voir docs/architecture.md, « Retrait par QR code (US-26) », et docs/user-stories.md, module 13.
-- Décisions du propriétaire (9/10) : pas de limite d'essais ni de blocage de boutique ; mode de remise fiable (US-27).
-- Aucune règle de blocage, de no-show, de contestation ni de vérification du numéro n'est modifiée ;
-- changer_statut_commande n'est pas modifiée (le bouton « Remis sans QR code » l'utilise tel quel).

-- ---------------------------------------------------------------------------
-- 1. Mode de remise sur la commande (lisible par le client, la boutique et l'admin, comme le reste de la commande)
-- ---------------------------------------------------------------------------
alter table commandes add column mode_remise text
  check (mode_remise in ('qr', 'code', 'manuel'));
alter table commandes add constraint commandes_mode_remise_recuperee
  check (mode_remise is null or statut = 'recuperee');
comment on column commandes.mode_remise is
  'US-26 : comment la commande a été remise (qr, code, manuel). Posé par la base au passage prete → recuperee, jamais modifiable. Vide avant US-26.';

-- Posé par la base seulement : la valeur donnée par remettre_commande (qr/code) au passage prete → recuperee,
-- sinon « manuel » ; dans tous les autres cas l'ancienne valeur est gardée.
create or replace function prive.poser_mode_remise() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.statut = 'prete' and new.statut = 'recuperee' then
    if new.mode_remise is null or new.mode_remise not in ('qr', 'code')
       or coalesce(current_setting('oranpromo.remise', true), '') is distinct from new.mode_remise then
      new.mode_remise := 'manuel';
    end if;
  else
    new.mode_remise := old.mode_remise;
  end if;
  return new;
end $$;
revoke execute on function prive.poser_mode_remise() from public, anon, authenticated;

create trigger commandes_mode_remise before update on commandes
  for each row execute function prive.poser_mode_remise();

-- ---------------------------------------------------------------------------
-- 2. Jetons de retrait (schéma prive : jamais exposé, aucune politique, lu par les fonctions seulement)
-- ---------------------------------------------------------------------------
create table prive.retraits (
  commande_id uuid primary key references public.commandes(id) on delete cascade,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  jeton text not null unique check (jeton ~ '^[A-Za-z0-9_-]{22}$'),
  code text not null check (code ~ '^[0-9]{4}$'),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
-- Deux commandes prêtes d'une même boutique n'ont jamais le même code.
create unique index retraits_code_actif on prive.retraits (boutique_id, code) where actif;
alter table prive.retraits enable row level security;
revoke all on prive.retraits from public, anon, authenticated;

-- 128 bits aléatoires (générateur cryptographique de pgcrypto) en base64url : 22 caractères.
create or replace function prive.nouveau_jeton_retrait() returns text
language sql volatile set search_path = public as $$
  select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_')
$$;

create or replace function prive.nouveau_code_retrait() returns text
language sql volatile set search_path = public as $$
  select lpad((((get_byte(b, 0) * 256 + get_byte(b, 1)) * 256 + get_byte(b, 2)) % 10000)::text, 4, '0')
  from (select extensions.gen_random_bytes(3) as b) x
$$;
revoke execute on function prive.nouveau_jeton_retrait() from public, anon, authenticated;
revoke execute on function prive.nouveau_code_retrait() from public, anon, authenticated;

-- Au passage « prête » : nouveau jeton et nouveau code ; en quittant « prête » : le retrait n'est plus actif.
create or replace function prive.gerer_retrait() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  essai integer := 0;
begin
  if new.statut = 'prete' and old.statut is distinct from 'prete' then
    loop
      essai := essai + 1;
      begin
        insert into prive.retraits (commande_id, boutique_id, jeton, code)
        values (new.id, new.boutique_id, prive.nouveau_jeton_retrait(), prive.nouveau_code_retrait())
        on conflict (commande_id) do update
          set jeton = excluded.jeton, code = excluded.code, actif = true, cree_le = now(), boutique_id = excluded.boutique_id;
        exit;
      exception when unique_violation then
        if essai >= 50 then
          raise exception 'Impossible de préparer le code de retrait : réessayez.' using errcode = '55000';
        end if;
      end;
    end loop;
  elsif old.statut = 'prete' and new.statut is distinct from 'prete' then
    update prive.retraits set actif = false where commande_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function prive.gerer_retrait() from public, anon, authenticated;

create trigger commandes_retrait after update of statut on commandes
  for each row execute function prive.gerer_retrait();

-- Commandes déjà prêtes au moment de la migration : elles reçoivent aussi un jeton.
do $$
declare c record;
begin
  for c in select id, boutique_id from commandes where statut = 'prete' loop
    loop
      begin
        insert into prive.retraits (commande_id, boutique_id, jeton, code)
        values (c.id, c.boutique_id, prive.nouveau_jeton_retrait(), prive.nouveau_code_retrait())
        on conflict (commande_id) do nothing;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lecture
-- ---------------------------------------------------------------------------
create or replace function prive.lignes_retrait(c_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('titre', l.titre, 'taille', l.taille, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire)
                  order by l.titre, l.taille), '[]'::jsonb)
  from lignes_commande l where l.commande_id = c_id
$$;
revoke execute on function prive.lignes_retrait(uuid) from public, anon, authenticated;

-- Client de la commande : son jeton et son code, seulement tant que la commande est prête et pas expirée.
create or replace function public.retrait_client(commande uuid) returns table (jeton text, code text)
language sql stable security definer set search_path = public as $$
  select r.jeton, r.code
  from prive.retraits r join commandes c on c.id = r.commande_id
  where r.commande_id = retrait_client.commande and r.actif
    and c.client_id = auth.uid() and c.statut = 'prete' and c.expire_le > now()
$$;
revoke execute on function public.retrait_client(uuid) from public, anon;
grant execute on function public.retrait_client(uuid) to authenticated;

-- Page du proche (sans connexion) : boutique, numéro, articles, montant ; jamais le nom ni le téléphone du client.
create or replace function public.retrait_par_lien(jeton text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r prive.retraits%rowtype;
  c commandes%rowtype;
  b boutiques%rowtype;
  etat text;
begin
  if jeton is null or jeton !~ '^[A-Za-z0-9_-]{22}$' then
    return null;
  end if;
  select * into r from prive.retraits x where x.jeton = retrait_par_lien.jeton;
  if not found then
    return null;
  end if;
  select * into c from commandes where id = r.commande_id;
  select * into b from boutiques where id = c.boutique_id;
  etat := case
    when c.statut = 'prete' and r.actif and c.expire_le > now() then 'prete'
    when c.statut = 'recuperee' then 'recuperee'
    when c.statut = 'annulee' then 'annulee'
    else 'expiree' end;
  return jsonb_build_object(
    'etat', etat, 'numero', c.numero, 'total', c.total, 'expire_le', c.expire_le, 'terminee_le', c.terminee_le,
    'boutique', jsonb_build_object('nom', b.nom, 'slug', b.slug, 'quartier', b.quartier, 'adresse', b.adresse),
    'lignes', prive.lignes_retrait(c.id),
    'code', case when etat = 'prete' then r.code end);
end $$;
revoke execute on function public.retrait_par_lien(text) from public;
grant execute on function public.retrait_par_lien(text) to anon, authenticated;

-- Retrait cherché par la boutique connectée (jeton du QR code ou code à 4 chiffres). Exactement un des deux.
-- Jeton inconnu, abîmé ou d'une autre boutique : « invalide » (même réponse). Code : commandes prêtes de la boutique seulement.
create or replace function prive.chercher_retrait(jeton text, code text, verrouiller boolean)
returns table (commande_id uuid, etat text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  ma uuid := prive.ma_boutique();
  trouve uuid;
  c commandes%rowtype;
begin
  if auth.uid() is null or ma is null then
    raise exception 'Connectez-vous à votre espace boutique.' using errcode = '42501';
  end if;
  if (jeton is null) = (code is null) then
    raise exception 'Donnez le QR code ou le code à 4 chiffres.' using errcode = '22023';
  end if;
  if jeton is not null then
    if jeton ~ '^[A-Za-z0-9_-]{22}$' then
      select r.commande_id into trouve from prive.retraits r where r.jeton = jeton and r.boutique_id = ma;
    end if;
  elsif code ~ '^[0-9]{4}$' then
    select r.commande_id into trouve from prive.retraits r where r.boutique_id = ma and r.code = code and r.actif;
  end if;
  if trouve is null then
    return query select null::uuid, 'invalide'::text;
    return;
  end if;
  if verrouiller then
    select * into c from commandes x where x.id = trouve for update;
  else
    select * into c from commandes x where x.id = trouve;
  end if;
  if c.boutique_id is distinct from ma then
    return query select null::uuid, 'invalide'::text;
    return;
  end if;
  return query select c.id, case
    when c.statut = 'prete' and c.expire_le > now() then 'ok'
    when c.statut = 'recuperee' then 'deja_remise'
    when c.statut = 'annulee' then 'annulee'
    else 'expiree' end;
end $$;
revoke execute on function prive.chercher_retrait(text, text, boolean) from public, anon, authenticated;

create or replace function prive.resume_retrait(c_id uuid, etat text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when c_id is null then jsonb_build_object('etat', etat) else (
    select jsonb_build_object(
      'etat', etat, 'commande', c.id, 'numero', c.numero,
      'prenom', split_part(btrim(c.client_nom), ' ', 1),
      'total', c.total, 'expire_le', c.expire_le, 'terminee_le', c.terminee_le, 'mode_remise', c.mode_remise,
      'lignes', prive.lignes_retrait(c.id))
    from commandes c where c.id = c_id) end
$$;
revoke execute on function prive.resume_retrait(uuid, text) from public, anon, authenticated;

-- Lecture seule : ne change jamais le statut.
create or replace function public.retrait_boutique(jeton text default null, code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  t record;
begin
  select * into t from prive.chercher_retrait(jeton, code, false);
  return prive.resume_retrait(t.commande_id, t.etat);
end $$;
revoke execute on function public.retrait_boutique(text, text) from public, anon;
grant execute on function public.retrait_boutique(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Remise : prete → recuperee, même mise à jour que changer_statut_commande, mode « qr » ou « code »
-- ---------------------------------------------------------------------------
create or replace function public.remettre_commande(jeton text default null, code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  t record;
  mode text := case when jeton is not null then 'qr' else 'code' end;
begin
  select * into t from prive.chercher_retrait(jeton, code, true);
  if t.etat = 'ok' then
    perform set_config('oranpromo.remise', mode, true);
    update commandes c set statut = 'recuperee', terminee_le = now(), mode_remise = mode where c.id = t.commande_id;
    perform set_config('oranpromo.remise', '', true);
    insert into suivi_commandes (commande_id, statut, auteur_id, auteur, note)
    values (t.commande_id, 'recuperee', auth.uid(), 'boutique', case mode when 'qr' then 'Remise par QR code' else 'Remise par code' end);
    return prive.resume_retrait(t.commande_id, 'remise');
  end if;
  return prive.resume_retrait(t.commande_id, t.etat);
end $$;
revoke execute on function public.remettre_commande(text, text) from public, anon;
grant execute on function public.remettre_commande(text, text) to authenticated;

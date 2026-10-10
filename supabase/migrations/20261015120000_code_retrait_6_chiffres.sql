-- Relecture n°6, suivi (relecture de Claude transmise par le propriétaire).
-- 1) Le code de retrait passe de 4 à 6 chiffres (1 000 000 de possibilités), toujours unique parmi les commandes prêtes
--    de la boutique (index retraits_code_actif inchangé). Les codes existants sont régénérés en 6 chiffres.
-- 2) Lecture seule : GET /rest/v1/rpc/retrait_boutique s'exécute dans une transaction en lecture seule, où l'essai faux
--    ne pouvait pas être enregistré (limite contournée). La saisie d'un code est refusée en lecture seule (25006),
--    avant toute recherche.
-- 3) Limites des codes faux :
--    a) par boutique : 20 codes faux en une heure (fenêtre glissante) → saisie du code refusée tant qu'il y en a 20
--       dans la dernière heure (remplace « 10 en 15 minutes ») ;
--    b) par commande : un code faux à une faute de frappe près du code d'une commande prête (un chiffre faux, ou deux
--       chiffres voisins inversés) compte pour cette commande ; au 5e, le code de cette commande est refusé 15 minutes.
--       Les autres commandes de la boutique restent utilisables par code.
--    Le QR code et « Remis sans QR code » ne passent jamais par ces limites. Bons et parrainage : QR code seulement
--    (inchangé, 20261015100000_retrait_code_limite_bons_qr.sql).
-- remettre_commande, retrait_boutique, gerer_retrait, messages_suivi_commande ne changent pas. Aucune règle de blocage,
-- de no-show, de numéro vérifié, de statut ou de stock ne change.

-- ---------------------------------------------------------------------------
-- 1) Code à 6 chiffres
-- ---------------------------------------------------------------------------
-- 4 octets aléatoires modulo 1 000 000 (biais < 0,03 %).
create or replace function prive.nouveau_code_retrait() returns text
language sql volatile set search_path = public as $$
  select lpad(((((get_byte(b, 0)::bigint * 256 + get_byte(b, 1)) * 256 + get_byte(b, 2)) * 256 + get_byte(b, 3)) % 1000000)::text, 6, '0')
  from (select extensions.gen_random_bytes(4) as b) x
$$;
revoke execute on function prive.nouveau_code_retrait() from public, anon, authenticated;

-- Donne un nouveau code à 6 chiffres à chaque retrait qui n'en a pas encore (unique par boutique parmi les retraits actifs).
-- Utilisée une fois par cette migration ; gardée pour le test SQL (supabase/tests/retrait_code_limite.test.sql).
create or replace function prive.regenerer_codes_retrait() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  r record;
  essai integer;
  n integer := 0;
begin
  for r in select x.commande_id from prive.retraits x where x.code !~ '^[0-9]{6}$' order by x.actif desc, x.cree_le loop
    essai := 0;
    loop
      essai := essai + 1;
      begin
        update prive.retraits x set code = prive.nouveau_code_retrait() where x.commande_id = r.commande_id;
        exit;
      exception when unique_violation then
        if essai >= 50 then
          raise exception 'Impossible de préparer le code de retrait : réessayez.' using errcode = '55000';
        end if;
      end;
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function prive.regenerer_codes_retrait() from public, anon, authenticated;

alter table prive.retraits drop constraint retraits_code_check;
select prive.regenerer_codes_retrait();
alter table prive.retraits add constraint retraits_code_check check (code ~ '^[0-9]{6}$');

-- ---------------------------------------------------------------------------
-- 3) Limites : essais par boutique (commande_id nul) et par commande (commande_id posé), blocage par commande
-- ---------------------------------------------------------------------------
alter table prive.essais_code_retrait
  add column commande_id uuid references public.commandes(id) on delete cascade;
create index essais_code_retrait_commande on prive.essais_code_retrait (commande_id) where commande_id is not null;
-- Ancienne règle (10 en 15 minutes) : plus de blocage de toute la boutique pour 15 minutes, les anciens essais sont oubliés.
delete from prive.essais_code_retrait;
drop table prive.blocages_code_retrait;

create table prive.blocages_code_commande (
  commande_id uuid primary key references public.commandes(id) on delete cascade,
  jusqu_a timestamptz not null
);
alter table prive.blocages_code_commande enable row level security;
revoke all on prive.blocages_code_commande from public, anon, authenticated;

-- Une faute de frappe près : même longueur et un seul chiffre différent, ou deux chiffres voisins inversés.
create or replace function prive.codes_proches(a text, b text) returns boolean
language sql immutable set search_path = public as $$
  select length(a) = length(b) and case d
    when 1 then true
    when 2 then exists (select 1 from generate_series(1, length(a) - 1) i
                        where substr(a, i, 1) = substr(b, i + 1, 1) and substr(a, i + 1, 1) = substr(b, i, 1)
                          and substr(a, i, 1) <> substr(a, i + 1, 1))
    else false end
  from (select count(*) as d from generate_series(1, least(length(a), length(b))) i
        where substr(a, i, 1) <> substr(b, i, 1)) x
$$;
revoke execute on function prive.codes_proches(text, text) from public, anon, authenticated;

-- Même fonction que 20261015100000_retrait_code_limite_bons_qr.sql ; seule la branche « code » change.
create or replace function prive.chercher_retrait(jeton text, code text, verrouiller boolean)
returns table (commande_id uuid, etat text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  ma uuid := prive.ma_boutique();
  trouve uuid;
  proche uuid;
  plus_ancien timestamptz;
  bloque_jusqu_a timestamptz;
  c commandes%rowtype;
begin
  if auth.uid() is null or ma is null then
    raise exception 'Connectez-vous à votre espace boutique.' using errcode = '42501';
  end if;
  if (jeton is null) = (code is null) then
    raise exception 'Donnez le QR code ou le code à 6 chiffres.' using errcode = '22023';
  end if;
  if jeton is not null then
    if jeton ~ '^[A-Za-z0-9_-]{22}$' then
      select r.commande_id into trouve from prive.retraits r where r.jeton = jeton and r.boutique_id = ma;
    end if;
  else
    -- En lecture seule (appel GET), l'essai faux ne pourrait pas être compté : refus avant toute recherche.
    if current_setting('transaction_read_only') = 'on' then
      raise exception 'Saisie du code impossible en lecture seule.' using errcode = '25006';
    end if;
    -- Un essai à la fois par boutique : des essais en parallèle ne passent pas tous avant la limite.
    perform pg_advisory_xact_lock(hashtextextended('bledeal:code_retrait:' || ma::text, 0));
    delete from prive.essais_code_retrait e where e.boutique_id = ma and e.le < now() - interval '1 hour';
    select min(e.le) into plus_ancien from (
      select e.le from prive.essais_code_retrait e where e.boutique_id = ma and e.commande_id is null
      order by e.le desc limit 20) e
    having count(*) >= 20;
    if plus_ancien is not null then
      raise exception 'Trop de codes faux (20 en une heure) : la saisie du code est bloquée encore % min. Scannez le QR code du client.',
        greatest(1, ceil(extract(epoch from plus_ancien + interval '1 hour' - now()) / 60))::integer
        using errcode = '54000';
    end if;
    if code ~ '^[0-9]{6}$' then
      select r.commande_id into trouve from prive.retraits r where r.boutique_id = ma and r.code = code and r.actif;
    end if;
    if trouve is not null then
      select b.jusqu_a into bloque_jusqu_a from prive.blocages_code_commande b where b.commande_id = trouve and b.jusqu_a > now();
      if bloque_jusqu_a is not null then
        raise exception 'Trop de codes faux pour cette commande : son code est bloqué encore % min. Scannez le QR code du client.',
          greatest(1, ceil(extract(epoch from bloque_jusqu_a - now()) / 60))::integer
          using errcode = '54000';
      end if;
    else
      insert into prive.essais_code_retrait (boutique_id) values (ma);
      if code ~ '^[0-9]{6}$' then
        for proche in select r.commande_id from prive.retraits r
                      where r.boutique_id = ma and r.actif and prive.codes_proches(r.code, code) loop
          insert into prive.essais_code_retrait (boutique_id, commande_id) values (ma, proche);
          if (select count(*) from prive.essais_code_retrait e where e.commande_id = proche) >= 5 then
            insert into prive.blocages_code_commande (commande_id, jusqu_a) values (proche, now() + interval '15 minutes')
            on conflict on constraint blocages_code_commande_pkey do update set jusqu_a = excluded.jusqu_a;
            delete from prive.essais_code_retrait e where e.commande_id = proche;
          end if;
        end loop;
      end if;
    end if;
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

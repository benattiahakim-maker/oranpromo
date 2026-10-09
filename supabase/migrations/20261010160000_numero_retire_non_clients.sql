-- Relecture n°5 (Claude) : un compte qui cesse d'être client perd son numéro de connexion.
-- Commerçants, ambassadeurs et admin se connectent par lien e-mail (relecture n°4, point 3). Quand le rôle d'un
-- profil passe de « client » à un autre rôle (rattacher_commercant, promotion par l'admin, ou toute autre mise à
-- jour de profils.role), la base retire le numéro du compte Supabase Auth : auth.users.phone, phone_confirmed_at,
-- phone_change (et son code en cours). Le compte ne peut plus se connecter par code.
-- Côté profil : telephone_verifie_le est effacé ; profils.telephone aussi, mais seulement si c'était le numéro de
-- connexion vérifié (numéro du compte, libéré pour un vrai client). Un numéro saisi à la main (non vérifié) reste :
-- il ne sert qu'au contact et ne compte jamais pour un autre compte.
-- Ordre des déclencheurs : celui-ci est un AFTER UPDATE sur profils, donc le rôle est déjà changé ; il ne fait que
-- vider phone / phone_change, ce que prive.refuser_numero_etranger (numero_client_algerien) laisse toujours passer.
-- Puis z_numero_verifie efface telephone_verifie_le ; l'index unique des numéros vérifiés n'est jamais gêné
-- (on retire une vérification, on n'en ajoute pas).

create or replace function prive.retirer_numero_non_client(compte uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  numero_connexion text;
  verifie boolean;
  avant text := coalesce(current_setting('oranpromo.traitement_systeme', true), '');
begin
  perform set_config('oranpromo.traitement_systeme', 'on', true);
  select nullif(u.phone, '') into numero_connexion from auth.users u where u.id = compte;
  select p.telephone_verifie_le is not null into verifie from profils p where p.id = compte;
  update auth.users u set phone = null, phone_confirmed_at = null, phone_change = '', phone_change_token = '',
    phone_change_sent_at = null
  where u.id = compte
    and (u.phone is not null or u.phone_confirmed_at is not null or coalesce(u.phone_change, '') <> ''
         or coalesce(u.phone_change_token, '') <> '' or u.phone_change_sent_at is not null);
  update profils p set
    telephone = case when verifie and p.telephone = '+' || numero_connexion then null else p.telephone end,
    telephone_verifie_le = null
  where p.id = compte
    and (p.telephone_verifie_le is not null or (verifie and p.telephone = '+' || numero_connexion));
  -- Les no-shows comptés par le numéro vérifié ne comptent plus pour ce compte : recalcul.
  perform prive.recalculer_no_shows(compte, null);
  perform set_config('oranpromo.traitement_systeme', avant, true);
end $$;
revoke execute on function prive.retirer_numero_non_client(uuid) from public, anon, authenticated;

create or replace function prive.numero_retire_si_non_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform prive.retirer_numero_non_client(new.id);
  return null;
end $$;
revoke execute on function prive.numero_retire_si_non_client() from public, anon, authenticated;

create trigger numero_retire_non_client after update of role on profils
  for each row when (old.role is distinct from new.role and new.role <> 'client')
  execute function prive.numero_retire_si_non_client();

-- Nettoyage unique : comptes non clients qui ont encore un numéro (ou un changement de numéro en cours).
select prive.retirer_numero_non_client(p.id)
from profils p join auth.users u on u.id = p.id
where p.role <> 'client'
  and (u.phone is not null or u.phone_confirmed_at is not null or coalesce(u.phone_change, '') <> ''
       or p.telephone_verifie_le is not null);

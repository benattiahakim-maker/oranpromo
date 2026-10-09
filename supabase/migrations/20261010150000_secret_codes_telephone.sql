-- Relecture n°4 (Claude), point 4 : un secret à part pour les limites d'envoi des codes.
-- Avant : controler_envoi_code / enregistrer_envoi_code acceptaient le jeton de la tâche WhatsApp (CRON_SECRET).
-- Désormais : jeton = CODES_TELEPHONE_SECRET (variable serveur), empreinte SHA-256 rangée dans prive.reglages
-- sous la clé « jeton_codes_telephone » :
--   insert into prive.reglages (cle, valeur)
--   values ('jeton_codes_telephone', encode(sha256(convert_to('<CODES_TELEPHONE_SECRET>', 'UTF8')), 'hex'))
--   on conflict (cle) do update set valeur = excluded.valeur;
-- Une fuite de l'un des deux secrets ne donne plus accès à l'autre usage.
create or replace function prive.verifier_jeton_codes(jeton text) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  attendu text;
begin
  select valeur into attendu from prive.reglages where cle = 'jeton_codes_telephone';
  if attendu is null or jeton is null or length(jeton) < 16
     or encode(sha256(convert_to(jeton, 'UTF8')), 'hex') <> attendu then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
end $$;
revoke execute on function prive.verifier_jeton_codes(text) from public, anon, authenticated;

create or replace function public.controler_envoi_code(jeton text, numero text) returns void
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
begin
  perform prive.verifier_jeton_codes(jeton);
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
  perform prive.verifier_jeton_codes(jeton);
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

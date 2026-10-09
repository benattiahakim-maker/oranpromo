-- Tests SQL de la migration 20261010150000_secret_codes_telephone.sql (relecture n°4, point 4).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/secret_codes_telephone.test.sql
-- Tout se passe dans une transaction annulée à la fin : aucune donnée n'est gardée.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
begin;

create function pg_temp.ok(condition boolean, nom text) returns text language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'ÉCHEC - %', nom; end if;
  return 'ok - ' || nom;
end $$;

create function pg_temp.erreur(requete text, code text, morceau text, nom text) returns text language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    if sqlstate = code and position(morceau in sqlerrm) > 0 then return 'ok - ' || nom; end if;
    raise exception 'ÉCHEC - % : erreur % « % »', nom, sqlstate, sqlerrm;
  end;
  raise exception 'ÉCHEC - % : aucune erreur', nom;
end $$;

delete from prive.reglages where cle in ('jeton_notifications', 'jeton_codes_telephone');
delete from prive.envois_codes;
insert into prive.reglages (cle, valeur) values
  ('jeton_notifications', encode(sha256(convert_to('secret-taches-whatsapp-0123', 'UTF8')), 'hex'));

set local role anon;
select pg_temp.erreur($$select controler_envoi_code('secret-taches-whatsapp-0123', '+213555600001')$$, '42501', 'Accès refusé',
  'le secret de la tâche WhatsApp (CRON_SECRET) ne sert plus aux limites d''envoi des codes');
select pg_temp.erreur($$select enregistrer_envoi_code('secret-taches-whatsapp-0123', '+213555600001')$$, '42501', 'Accès refusé',
  'ni pour enregistrer un envoi');
select pg_temp.erreur($$select controler_envoi_code('secret-codes-telephone-0123', '+213555600001')$$, '42501', 'Accès refusé',
  'sans empreinte « jeton_codes_telephone » dans la base : refus');

reset role;
insert into prive.reglages (cle, valeur) values
  ('jeton_codes_telephone', encode(sha256(convert_to('secret-codes-telephone-0123', 'UTF8')), 'hex'));
set local role anon;
select pg_temp.ok((select count(*) = 1 from (select controler_envoi_code('secret-codes-telephone-0123', '+213555600001')) x),
  'avec CODES_TELEPHONE_SECRET : contrôle accepté');
select enregistrer_envoi_code('secret-codes-telephone-0123', '+213555600001') \g /dev/null
select pg_temp.erreur($$select controler_envoi_code('secret-codes-telephone-0123', '+213555600001')$$, '54000', 'Attendez une minute',
  'les limites par numéro s''appliquent toujours');
select pg_temp.erreur($$select controler_envoi_code('secret-codes-tel', '+213555600002')$$, '42501', 'Accès refusé',
  'un jeton trop court ou faux est refusé');
select pg_temp.erreur($$select messages_whatsapp_en_attente('secret-codes-telephone-0123')$$, '42501', 'Accès refusé',
  'le secret des codes ne donne pas accès aux messages WhatsApp en attente');
reset role;
select pg_temp.ok((select count(*) = 1 from prive.envois_codes where telephone = '+213555600001'), 'un envoi enregistré');

rollback;
\echo 'Tous les tests SQL du point 4 de la relecture n°4 passent.'

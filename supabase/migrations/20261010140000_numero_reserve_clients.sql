-- Relecture n°4 (Claude), point 3 : seuls les clients ont un numéro de connexion.
-- Commerçants, ambassadeurs et admin se connectent par lien e-mail : la base refuse d'ajouter ou de changer
-- auth.users.phone / phone_change sur leur compte (aucun code envoyé : Supabase Auth écrit phone_change avant
-- d'envoyer le code de vérification). Retirer un numéro reste possible.
create or replace function prive.refuser_numero_etranger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  role_compte text;
  nouveau_phone boolean := coalesce(new.phone, '') <> '' and (tg_op = 'INSERT' or new.phone is distinct from old.phone);
  nouveau_change boolean := coalesce(new.phone_change, '') <> '' and (tg_op = 'INSERT' or new.phone_change is distinct from old.phone_change);
begin
  if nouveau_phone and not prive.telephone_client_valide('+' || new.phone) then
    raise exception 'Numéro refusé : seuls les mobiles algériens (05, 06 ou 07) sont acceptés.' using errcode = '23514';
  end if;
  if nouveau_change and not prive.telephone_client_valide('+' || new.phone_change) then
    raise exception 'Numéro refusé : seuls les mobiles algériens (05, 06 ou 07) sont acceptés.' using errcode = '23514';
  end if;
  -- À la création, le profil n'existe pas encore : un nouveau compte est toujours un client.
  if tg_op = 'UPDATE' and (nouveau_phone or nouveau_change) then
    select p.role::text into role_compte from public.profils p where p.id = new.id;
    if role_compte is not null and role_compte <> 'client' then
      raise exception 'Les comptes commerçant, ambassadeur et administrateur se connectent par e-mail : pas de numéro de téléphone de connexion.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function prive.refuser_numero_etranger() from public, anon, authenticated;

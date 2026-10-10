-- US-34.1 : pages /conditions, /conditions-commercants et /confidentialite. Ces mots ne peuvent jamais devenir le code
-- d'une ville (sinon /<code> ouvrirait la page). Contrainte à part (la contrainte villes_code_libre n'est pas réécrite :
-- d'autres stories peuvent la modifier en parallèle). Même liste que CODES_RESERVES (lib/ville.ts).
-- Aucune autre règle ne change.
alter table public.villes add constraint villes_code_libre_juridique
  check (code not in ('conditions', 'conditions-commercants', 'confidentialite'));

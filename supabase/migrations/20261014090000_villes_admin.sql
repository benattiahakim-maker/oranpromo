-- US-29.4 : ouverture des villes par l'admin (/admin/villes) et fin de la ville « oran » par défaut.
-- Oran se comporte exactement comme avant : mêmes bornes, mêmes messages, mêmes droits.

-- 1. Plus de ville par défaut : chaque nouvelle boutique dit sa ville (formulaire « Nouvelle boutique »).
--    Les boutiques existantes gardent leur ville (toutes à « oran » depuis US-29.1).
alter table public.boutiques alter column ville drop default;

-- 2. Codes réservés : « favicon » et « images » (fichiers de public/ servis à la racine) ne peuvent pas devenir
--    l'adresse d'une ville. Même liste que CODES_RESERVES (lib/ville.ts) pour les dossiers de app/ et de public/.
alter table public.villes drop constraint villes_code_libre;
alter table public.villes add constraint villes_code_libre check (code not in (
  'admin', 'api', 'apercu-local', 'auth', 'carte', 'catalogue', 'compte', 'confirmer', 'espace', 'favicon', 'images',
  'langue', 'manifest', 'panier', 'parrainage', 'retrait', 'robots', 'sitemap', 'ville', 'villes', 'visiteurs'));

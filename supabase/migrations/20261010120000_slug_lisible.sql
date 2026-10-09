-- US-22 : lien de boutique à partager.
-- Le slug est l'adresse publique de la vitrine (/b/<slug>), mise en bio Instagram/TikTok/Facebook
-- et imprimée en QR code : il doit rester lisible. En plus du check initial (^[a-z0-9-]{2,60}$),
-- on refuse les tirets en début ou en fin et les tirets doublés. Les slugs existants respectent déjà
-- ce format (la contrainte est validée à l'ajout). Même règle dans lib/lien-boutique.ts (slugValide).
-- L'unicité (contrainte unique initiale) et la protection du slug d'une boutique publiée
-- (prive.proteger_coordonnees_boutique, admin seulement) ne changent pas.
alter table boutiques
  add constraint boutiques_slug_lisible check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

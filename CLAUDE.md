@AGENTS.md

# OranPromo — règles pour les agents

OranPromo est le click & collect des boutiques de vêtements d'Oran : le client voit une promo, réserve par un message WhatsApp pré-rempli, vient essayer et payer en boutique. Le propriétaire du projet ne code pas : **c'est toi qui codes, et tu dois prouver que ça marche.**

## À lire avant de coder

1. `docs/user-stories.md` — la story demandée et ses critères d'acceptation.
2. `docs/architecture.md` — où mettre le code, tables, règles métier, style.
3. `docs/maquettes/<Écran>.dc.html` — la maquette de l'écran (HTML statique, 390 × 844).
4. `node_modules/next/dist/docs/` — avant d'utiliser une API Next.js (version 16, différente de ce que tu connais).

## Règles

1. **Une story à la fois.** Ne fais que ce que la story demande. Ne touche pas aux autres écrans.
2. **Ne rien inventer.** Pas de table, colonne, route ou dépendance qui ne figure pas dans `docs/architecture.md`. Si c'est nécessaire, arrête-toi et explique pourquoi.
3. **Règles métier dans `lib/` et dans la base**, jamais dans les composants d'affichage. Réutilise `lib/prix.ts` (`formaterPrix`, `prixAffiche`, `promoActive`) et `lib/whatsapp.ts` (`lienReservation`).
4. **Supabase** : `creerClientServeur()` (`lib/supabase/server.ts`) dans les pages et actions serveur, `creerClientNavigateur()` dans les composants `"use client"`. Types depuis `lib/supabase/types.ts` (`Tables<"articles">`). Ne contourne jamais les règles de sécurité (RLS) ; n'utilise jamais de clé secrète Supabase dans le code.
5. **Schéma** : toute modification = nouveau fichier dans `supabase/migrations/`, jamais modifier un ancien. Puis `npm run db:types`.
6. **Secrets** : jamais de clé dans le code ni dans un commit. `ANTHROPIC_API_KEY` uniquement côté serveur. `.env.local` ne se commite pas.
7. **Textes en français** ; noms métier en français sans accents (`prixPromo`, `boutique`), termes techniques en anglais (`component`, `hook`).
8. **Mobile d'abord** : chaque écran doit fonctionner à 375 px de large. Respecte le style des maquettes (noir et blanc, Bodoni Moda / Jost, angles droits, pas d'ombres).
9. **Fichiers** : crée et modifie les fichiers avec ton outil d'édition, jamais avec des commandes du terminal (`echo >`, here-strings PowerShell, `Set-Content`).
10. **Windows** : utilise `npm.cmd` au lieu de `npm` dans PowerShell.
11. **Tests** : toute nouvelle règle métier dans `lib/` a son fichier `*.test.ts` à côté.

## Avant de dire « terminé »

1. `npm run build` passe sans erreur.
2. `npm test` passe.
3. `npm run lint` passe.
4. Pour **chaque** critère d'acceptation de la story : dis s'il est rempli et cite le fichier et la ligne qui le prouvent. Si un critère n'est pas rempli, dis-le clairement.
5. Commit avec un message qui commence par l'identifiant : `US-07 Réserver un article sur WhatsApp`.

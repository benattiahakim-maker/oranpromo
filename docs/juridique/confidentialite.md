# Politique de confidentialité de BleDeal — BROUILLON

> **Brouillon à faire relire par un avocat algérien avant toute mise en ligne.** Version proposée : `[AAAA-MM-JJ]`. Sources : loi 18-07 (modifiée par la loi 25-11) et loi 18-05, voir `docs/juridique/README.md`. **Avant de traiter des données sur le site ouvert au public, BleDeal doit déposer une déclaration préalable auprès de l'ANPDP (loi 18-07, art. 12 à 14) et régler la question des transferts vers l'étranger (art. 44 et 45) : voir le point 8.**

## 1. Responsable du traitement

`[raison sociale]`, `[adresse]`, `[e-mail]`. Délégué à la protection des données : `[nom, contact]` (loi 25-11, art. 41 bis, **à vérifier**). Récépissé de déclaration ANPDP : `[n°, date]`.

## 2. Données collectées et pourquoi

| Données | Pourquoi | Base (loi 18-07, art. 7) |
| --- | --- | --- |
| Numéro WhatsApp (vérifié par code), nom ou prénom | compte, commandes, messages de commande | exécution du contrat |
| Commandes (boutique, articles, montants, statuts, dates, mode de retrait), « client pas venu », blocage | réservation, retrait, règles anti-abus | exécution du contrat |
| Bons, parrainages, avis, boutiques suivies | services demandés par le client | exécution du contrat / consentement |
| Accord pour les messages publicitaires WhatsApp et sa date | alertes de nouvelles promos (si accepté) | consentement exprès (loi 18-05, art. 31 ; loi 18-07, art. 37) |
| Commerçants : e-mail, nom, boutique, adresse, WhatsApp, photos des articles | espace commerçant, vitrine | exécution du contrat |
| Mesures de visite (vues, clics, partages, signalements) avec une **empreinte de l'adresse IP** (l'adresse elle-même n'est pas gardée) | statistiques des boutiques, limites anti-abus | `[à qualifier par l'avocat : intérêt de l'activité / consentement]` |
| Position (bouton « Autour de moi », « Me localiser ») | trier ou centrer la carte | utilisée **dans le téléphone seulement**, non envoyée à BleDeal |

BleDeal ne collecte que les données nécessaires aux commandes (loi 18-05, art. 26).

## 3. Qui voit vos données

- **La boutique** de votre commande : votre nom et votre numéro, pour cette commande seulement.
- **Le public** : votre prénom et l'initiale de votre nom sur vos avis.
- **L'équipe BleDeal** (administrateurs) : pour le service, la modération et la lutte contre la fraude.
- **Les prestataires techniques** (sous-traitants, loi 18-07, art. 39), point 8.

BleDeal ne vend pas vos données.

## 4. Cookies et stockage dans le téléphone

Seulement ce qui est nécessaire au site : session de connexion, langue (`langue`), ville choisie (`ville`), code de parrainage reçu (`parrain`), panier (dans le téléphone), brouillons d'articles des commerçants (dans le téléphone). Pas de cookie publicitaire. Captcha Cloudflare Turnstile à la connexion par téléphone.

## 5. Messages WhatsApp

- Messages de service : code de connexion, commande prête, rappels, blocage.
- Messages publicitaires : seulement avec votre accord séparé ; arrêt gratuit à tout moment par le lien du message, pris en compte dans les 24 heures, avec confirmation (loi 18-05, art. 32).

## 6. Durées de conservation

`[À fixer avec l'avocat et le comptable]` — proposition : compte tant qu'il est actif, puis `[x]` ans ; commandes et relevés de bons `[x]` ans (preuves, comptabilité ; la loi 18-05, art. 25, demande à l'e-fournisseur de garder le registre des transactions) ; mesures de visite `[x]` mois ; codes de connexion : quelques minutes (Twilio / Supabase).

## 7. Vos droits

Information (art. 32), **accès** (art. 34), **rectification ou effacement** gratuit, sous 10 jours (art. 35), **opposition**, notamment à la prospection (art. 36), **retrait du consentement** à tout moment (art. 7). Écrire à `[e-mail]`. Réclamation possible auprès de l'**ANPDP** (anpdp.dz).

## 8. Prestataires et transferts hors d'Algérie

Les services suivants traitent des données **hors d'Algérie** :

| Prestataire | Rôle | Lieu (à confirmer) |
| --- | --- | --- |
| Supabase | base de données, connexion, photos | région Paris (France) |
| Vercel | hébergement du site | `[à confirmer]` |
| Meta (WhatsApp Cloud API) | messages WhatsApp | `[à confirmer]` |
| Twilio Verify | codes de connexion | `[à confirmer]` |
| Cloudflare Turnstile | captcha | `[à confirmer]` |
| CARTO | fonds de carte | `[à confirmer]` |
| Anthropic (API Claude) | aide à la rédaction des fiches et traduction, à partir des photos et textes des commerçants | `[à confirmer]` |

La loi 18-07 (art. 44) soumet le transfert vers un État étranger à l'**autorisation de l'ANPDP** ; l'art. 45 prévoit des exceptions, notamment le **consentement exprès** de la personne et le transfert **nécessaire à l'exécution d'un contrat**. **À décider avec l'avocat** : demander l'autorisation, s'appuyer sur ces exceptions, ou héberger en Algérie (voir aussi la loi 18-05, art. 8 : site hébergé en Algérie, « .com.dz »).

## 9. Sécurité

Accès limité par des règles dans la base (chaque compte ne lit que ses données), connexions chiffrées, secrets côté serveur, limites d'essais. En cas de violation, BleDeal prévient l'ANPDP et les personnes concernées (loi 18-07, art. 43 ; délai de la loi 25-11 **à vérifier**).

## 10. Mineurs

`[À fixer]` : le site est réservé aux personnes de `[18 / 19]` ans ou plus, ou avec l'accord d'un parent (loi 18-07, art. 8).

## 11. Modifications

Chaque version porte une date ; une modification importante est présentée et doit être acceptée.

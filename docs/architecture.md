# Architecture technique — OranPromo

Une seule application **Next.js 16 (App Router, TypeScript, Tailwind 4)** + **Supabase** (base PostgreSQL, connexion par SMS, stockage des photos). L'IA (API Claude) est appelée **uniquement côté serveur**. Hébergement prévu : Vercel.

> ⚠️ Next.js 16 diffère de ce que les modèles connaissent. Avant d'utiliser une API Next.js, lire le guide correspondant dans `node_modules/next/dist/docs/`. Exemple : `cookies()`, `headers()` et `params` sont asynchrones (`await`).

## Où vit quoi

```
app/
  page.tsx                      accueil : promos du moment (US-04)
  catalogue/page.tsx            catalogue, recherche, filtres (US-05, US-06)
  a/[id]/page.tsx               fiche article + aperçu de partage (US-02, 03, 07, 17)
  b/[slug]/page.tsx             vitrine boutique + aperçu de partage (US-01, 03)
  espace/connexion/page.tsx     connexion par lien e-mail (US-09)
  auth/callback/route.ts        retour du lien e-mail → session (US-09)
  espace/page.tsx               mes articles (US-11)
  espace/articles/nouveau/      ajout d'article, fiche IA (US-10, 14, 15)
  espace/articles/[id]/         modification, promo (US-11, 12)
  espace/statistiques/          mes chiffres (US-13)
  admin/...                     boutiques, modération, tableau de bord (US-16, 18, 19)
  api/ia/fiche/route.ts         photo → fiche (US-14)
  api/ia/traduire/route.ts      traduction arabe (US-15)
components/                     composants d'affichage réutilisables
lib/
  prix.ts                       règles de prix et promo (testé)
  whatsapp.ts                   lien de réservation (testé)
  supabase/client.ts            client navigateur ("use client")
  supabase/server.ts            client serveur (pages, routes, actions)
  supabase/types.ts             types générés depuis la base (ne pas modifier à la main)
supabase/migrations/            schéma SQL et règles de sécurité (déjà appliqués)
docs/                           user stories, architecture, maquettes
```

## Lecture et écriture des données

- **Lecture publique** : les pages serveur lisent directement la base avec `creerClientServeur()`. Les règles de sécurité (RLS) ne renvoient que ce que le public a le droit de voir : boutiques validées, articles disponibles ou réservés confirmés il y a moins de 21 jours.
- **Écritures du commerçant** : actions serveur (`"use server"`) ou client navigateur avec la session du commerçant. La base refuse toute écriture hors de sa boutique, même si l'interface a un bug.
- **Routes `app/api/`** : uniquement pour ce qui a besoin d'un secret (IA Claude). Pas de route API pour lire des données que Supabase sert déjà.
- **Statistiques** : insertion dans `evenements` (autorisée à tout visiteur, sans donnée personnelle).

## Base de données (déjà créée sur Supabase, projet `oranpromo`)

Colonnes en `snake_case` français sans accents. Prix = entiers en dinars.

| Table | Rôle | Points clés |
| --- | --- | --- |
| `boutiques` | vitrines | `slug` unique ; `statut` : `en_attente`, `validee`, `suspendue` ; seul un admin change le statut |
| `profils` | un par compte connecté | `role` : `commercant`, `ambassadeur`, `admin` ; `boutique_id` ; créé automatiquement à l'inscription |
| `articles` | articles | `statut` : `disponible`, `reserve`, `vendu`, `masque` ; `categorie` : liste fixe de 19 catégories (règle dans la base) ; `genre` : `homme`, `femme`, `enfant`, `mixte` ; `derniere_confirmation` ; `propose_par_ia` ; `masque_par_moderation` (seul un admin le lève) |
| `photos` | 1 à 5 par article | `adresse` (grande photo 1200 px, fiche article), `adresse_vignette` (miniature 400 px, cartes ; vide pour les anciennes photos → repli sur `adresse`), `ordre` ; adresses limitées au stockage `photos` du projet, dossier de l'article (règle dans la base) |
| `tailles` | tailles d'un article | `libelle`, `disponible` ; unique par article |
| `promos` | au plus une par article | `prix_promo` (> 0 et < `articles.prix`, règle dans la base), `badge`, `date_fin` |
| `evenements` | statistiques | `type` : `vue_article`, `vue_boutique`, `clic_reserver`, `partage` ; `date` fixée par la base ; 120 par minute et par boutique au plus |
| `signalements` | signalements clients | `statut` : `ouvert`, `traite`, `rejete` ; `cree_le` fixée par la base ; 10 par heure et par article, 200 par heure au total |
| `decisions` | décisions de modération | `action`, `auteur_id`, `date` |
| `appels_ia` | quota des routes IA | `utilisateur_id`, `date` ; aucune lecture directe, uniquement via `consommer_quota_ia()` (30 appels par heure et par compte) |

Le stockage `photos` (public, 5 Mo max, jpeg/png/webp) impose le chemin `<boutique_id>/<article_id>/<fichier>`.

**Changer le schéma** : créer un nouveau fichier `supabase/migrations/AAAAMMJJHHMMSS_description.sql`, ne jamais modifier une migration existante, puis régénérer les types (`npm run db:types`).

## Règles métier

- Une promo est active si sa `date_fin` n'est pas passée ; sinon le prix normal s'applique. Calcul à la lecture (`promoActive`, `prixAffiche` dans `lib/prix.ts`).
- Un article non confirmé depuis 21 jours n'est plus visible du public (règle dans la base).
- Seules les boutiques validées sont publiques.
- Seuls un admin ou un ambassadeur créent une boutique ; une fois publiée (validée ou suspendue), son nom, son WhatsApp, son slug et ses liens ne changent qu'avec un admin (règle dans la base).
- Les dates `cree_le` et `derniere_confirmation` d'un article sont fixées par la base pour le commerçant (heure du serveur).
- Un article masqué par la modération (`masque_par_moderation`) ne peut pas être démasqué par le commerçant (règle dans la base, rappelée dans `lib/gestion-articles.ts`).
- Les routes IA sont réservées aux boutiques validées et limitées par compte (`lib/acces-ia.ts`) ; leur corps de requête est lu avec une taille bornée (`lib/corps-requete.ts`).
- Le prix promo est un entier > 0 strictement inférieur au prix normal (`lib/promo.ts` et la base) ; le prix d'un article en promo ne peut pas descendre sous le prix promo.
- Les listes publiques (accueil, catalogue) appliquent explicitement la visibilité publique (`lib/catalogue.ts`) : un admin ou un commerçant connecté y voit la même chose que le public. Le catalogue lit au plus 1 000 articles par requête.
- Le navigateur prépare chaque photo (`lib/compression-photo.ts`, `preparerPhoto`) : une grande photo JPEG de 1200 px (qualité baissée jusqu'à ~700 Ko) et une miniature de 400 px (~30 Ko, 150 Ko au plus), rangée dans `<boutique_id>/<article_id>/<uuid>-vignette.jpg`. Les cartes (accueil, catalogue, vitrine, mes articles) affichent la miniature, la fiche affiche la grande photo.
- Les photos et miniatures envoyées sont vérifiées côté serveur sur leur contenu réel (JPEG), pas seulement sur le type annoncé par le navigateur ; 4 Mo au total par envoi (photos + miniatures), sous la limite d'environ 4,5 Mo de Vercel (`bodySizeLimit` dans `next.config.ts`).
- Les redirections n'utilisent que des hôtes connus (`lib/origine.ts` : hôte de `NEXT_PUBLIC_SITE_URL`, plus localhost en développement).
- L'IA ne propose jamais prix, tailles, contenances, marque ni authenticité.
- **Catégories et univers** (`lib/article.ts`) : 4 univers (Femme · Homme · Enfant · Beauté), sans sous-catégories.
  - Mode (`CATEGORIES_MODE`) : T-shirts et polos, Chemises, Pulls et sweats, Vestes et manteaux, Pantalons et jeans, Survêtements et ensembles, Robes, Jupes, Abayas, djellabas, kamis, Tenues traditionnelles, Hijabs et foulards, Chaussures, Sacs, Accessoires. Genre obligatoire.
  - Beauté (`CATEGORIES_BEAUTE`) : Parfums, Maquillage, Soins visage et corps, Cheveux, Hammam et traditionnel. Genre facultatif (enregistré `mixte`) ; contenance en ml (5 à 1000 ml) ou « Unique » au lieu d'une taille.
  - Tailles par catégorie : `taillesPourArticle()` (lettres XS–3XL, 36–50 pour les pantalons, pointures, âges pour l'enfant, taille unique pour sacs, hijabs et accessoires).
  - La base refuse une catégorie hors liste (`prive.verifier_categorie_article`, migration `20261009170000_categories_univers.sql`). Changer la liste = modifier `lib/article.ts` ET une nouvelle migration.
  - Univers dans le catalogue (`lib/catalogue.ts`, `?univers=femme|homme|enfant|beaute`) : Femme / Homme = mode du genre ou mixte, Enfant = mode enfant, Beauté = catégories beauté.
- Affichage des prix : toujours `formaterPrix()` → « 3 500 DA ».

## IA (US-14, US-15)

`@anthropic-ai/sdk`, clé `ANTHROPIC_API_KEY` lue côté serveur uniquement. Demander une réponse JSON structurée (titre, description, categorie, genre, couleur) et la valider avant de la renvoyer. La catégorie est imposée parmi la liste officielle (mode et beauté). Si la photo ne montre ni un article de mode ni un produit de beauté : renvoyer une erreur claire, ne rien remplir.

## Tests

| Niveau | Outil | Exemples |
| --- | --- | --- |
| Règles métier | Vitest (`npm test`) | promo active/expirée, lien WhatsApp, format des prix |
| Composants | Testing Library | bouton « Réserver » désactivé sans taille, prix barré en promo |
| Parcours complets | Playwright (après le MVP) | recherche → fiche → réservation |

## Style (voir `docs/maquettes/`)

Luxe monochrome : blanc `#FFFFFF`, noir `#0A0A0A`, gris `#6F6F6F`, traits `#E6E6E6`, fond photo `#F3F2EF`. Titres et logo en Bodoni Moda (`font-titre`), texte en Jost (`font-sans`). Libellés en capitales espacées (classe `etiquette`). Angles droits, pas d'ombres, boutons noirs pleins. Couleurs Tailwind disponibles : `noir`, `blanc`, `gris`, `trait`, `fond-photo`.

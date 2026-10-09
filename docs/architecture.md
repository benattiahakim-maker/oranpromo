# Architecture technique — OranPromo

Une seule application **Next.js 16 (App Router, TypeScript, Tailwind 4)** + **Supabase** (base PostgreSQL, connexion par SMS, stockage des photos). L'IA (API Claude) est appelée **uniquement côté serveur**. Hébergement prévu : Vercel.

> ⚠️ Next.js 16 diffère de ce que les modèles connaissent. Avant d'utiliser une API Next.js, lire le guide correspondant dans `node_modules/next/dist/docs/`. Exemple : `cookies()`, `headers()` et `params` sont asynchrones (`await`).

## Où vit quoi

```
app/
  page.tsx                      accueil : univers, grande photo, tuiles, promos du moment (US-04, lib/accueil.ts)
  catalogue/page.tsx            catalogue, recherche, filtres (US-05, US-06)
  a/[id]/page.tsx               fiche article + aperçu de partage (US-02, 03, 07, 17)
  b/[slug]/page.tsx             vitrine boutique + aperçu de partage (US-01, 03)
  espace/connexion/page.tsx     connexion par lien e-mail (US-09)
  auth/callback/route.ts        retour du lien e-mail → session (US-09)
  espace/page.tsx               mes articles (US-11)
  espace/articles/nouveau/      ajout d'article, fiche IA (US-10, 14, 15)
  espace/articles/[id]/         modification, promo (US-11, 12)
  espace/statistiques/          mes chiffres (US-13)
  espace/commandes/             commandes reçues par la boutique (US-20.3)
  panier/page.tsx               panier d'une boutique, « Commander » (US-20.2)
  compte/connexion/page.tsx     connexion client par lien e-mail (US-20.2)
  compte/page.tsx               profil client : nom, téléphone, no-shows (US-20.2, 20.4)
  compte/commandes/             mes commandes et suivi avec la frise (US-20.2)
  admin/...                     boutiques, modération, tableau de bord, clients bloqués (US-16, 18, 19, 20.4)
  api/ia/fiche/route.ts         photo → fiche (US-14)
  api/ia/traduire/route.ts      traduction arabe (US-15)
  api/notifications/whatsapp/route.ts  envoi des messages WhatsApp en attente, appelé par une tâche planifiée (US-20.5)
components/                     composants d'affichage réutilisables
lib/
  prix.ts                       règles de prix et promo (testé)
  whatsapp.ts                   liens wa.me (testé)
  stock.ts                      stock par taille (US-20.1, testé)
  panier.ts                     panier d'une boutique, gardé dans le navigateur (US-20.2, testé)
  commandes.ts                  statuts, transitions, frise, lecture et actions (US-20.2, 20.3, testé)
  clients.ts                    profil client, no-shows, déblocage (US-20.2, 20.4, testé)
  notifications/                messages WhatsApp : fournisseur (Meta Cloud API), envoi de la file d'attente (US-20.5, testé)
  supabase/client.ts            client navigateur ("use client")
  supabase/server.ts            client serveur (pages, routes, actions)
  supabase/types.ts             types générés depuis la base (ne pas modifier à la main)
supabase/migrations/            schéma SQL et règles de sécurité (déjà appliqués)
supabase/tests/                 tests SQL des règles de la base (transaction annulée, psql)
docs/                           user stories, architecture, maquettes
```

## Lecture et écriture des données

- **Lecture publique** : les pages serveur lisent directement la base avec `creerClientServeur()`. Les règles de sécurité (RLS) ne renvoient que ce que le public a le droit de voir : boutiques validées, articles disponibles ou réservés confirmés il y a moins de 21 jours.
- **Écritures du commerçant** : actions serveur (`"use server"`) ou client navigateur avec la session du commerçant. La base refuse toute écriture hors de sa boutique, même si l'interface a un bug.
- **Routes `app/api/`** : uniquement pour ce qui a besoin d'un secret (IA Claude). Pas de route API pour lire des données que Supabase sert déjà.
- **Statistiques** : insertion dans `evenements` (autorisée à tout visiteur, sans donnée personnelle).
- **Commandes** : aucune écriture directe dans `commandes`, `lignes_commande`, `suivi_commandes` ; tout passe par les fonctions de la base `passer_commande()` et `changer_statut_commande()` (appelées par des actions serveur), qui vérifient les droits, les transitions et déplacent le stock.

## Base de données (déjà créée sur Supabase, projet `oranpromo`)

Colonnes en `snake_case` français sans accents. Prix = entiers en dinars.

| Table | Rôle | Points clés |
| --- | --- | --- |
| `boutiques` | vitrines | `slug` unique ; `statut` : `en_attente`, `validee`, `suspendue` ; seul un admin change le statut |
| `profils` | un par compte connecté | `role` : `client` (par défaut pour un nouveau compte), `commercant`, `ambassadeur`, `admin` ; `boutique_id` ; `nom`, `telephone` (format `+213XXXXXXXXX` quand l'utilisateur le saisit) ; `no_shows`, `bloque`, `bloque_le` (modifiables seulement par la base et l'admin) ; créé automatiquement à l'inscription |
| `articles` | articles | `statut` : `disponible`, `reserve`, `vendu`, `masque` ; `categorie` : liste fixe de 19 catégories (règle dans la base) ; `genre` : `homme`, `femme`, `enfant`, `mixte` ; `derniere_confirmation` ; `propose_par_ia` ; `masque_par_moderation` (seul un admin le lève) |
| `photos` | 1 à 5 par article | `adresse` (grande photo 1200 px, fiche article), `adresse_vignette` (miniature 400 px, cartes ; vide pour les anciennes photos → repli sur `adresse`), `ordre` ; adresses limitées au stockage `photos` du projet, dossier de l'article (règle dans la base) |
| `tailles` | tailles d'un article | `libelle`, `quantite` (stock indicatif, 0 à 999, 1 par défaut), `disponible` (calculé par la base : `quantite > 0`) ; unique par article |
| `promos` | au plus une par article | `prix_promo` (> 0 et < `articles.prix`, règle dans la base), `badge`, `date_fin` |
| `evenements` | statistiques | `type` : `vue_article`, `vue_boutique`, `clic_reserver`, `partage` ; `date` fixée par la base ; 120 par minute et par boutique au plus |
| `signalements` | signalements clients | `statut` : `ouvert`, `traite`, `rejete` ; `cree_le` fixée par la base ; 10 par heure et par article, 200 par heure au total |
| `decisions` | décisions de modération | `action`, `auteur_id`, `date` |
| `commandes` | commandes client (US-20) ; `no_show_le` (« Client pas venu » déclaré par la boutique), `no_show_annule_le` (annulé par l'admin) | `numero` (affiché « n° 12 »), `client_id`, `boutique_id`, `statut` : `demandee`, `confirmee`, `prete`, `recuperee`, `annulee`, `expiree` ; `client_nom`, `client_telephone` (copiés du profil à la commande) ; `note` (client, 300 car.), `motif_annulation` : `plus_en_stock`, `boutique_indisponible`, `client_a_annule`, `autre` ; `total` (DA) ; dates `cree_le`, `confirmee_le`, `prete_le`, `expire_le` (= `prete_le` + 24 h), `terminee_le` |
| `lignes_commande` | articles d'une commande | `commande_id`, `article_id` (vide si l'article est supprimé), `titre`, `taille`, `quantite` (1 à 10), `prix_unitaire` (prix affiché au moment de la commande, promo active comprise) |
| `suivi_commandes` | frise d'une commande | `commande_id`, `statut`, `date`, `auteur_id` (vide = automatique), `auteur` : `client`, `boutique`, `admin`, `systeme` ; `note` (300 car.) |
| `messages_whatsapp` | file d'attente des messages WhatsApp (US-20.5) | `destinataire` (`+213…`), `modele` (nom du modèle Meta), `parametres` (liste de textes), `texte` (version lisible), `commande_id`, `statut` : `a_envoyer`, `envoye`, `echec` ; `tentatives` (5 au plus), `reserve_jusqu_a`, `erreur`, `identifiant_fournisseur`, `cree_le`, `envoye_le` ; lisible par l'admin seulement, écrit par la base |
| `prive.reglages` | réglages internes (schéma non exposé) | `cle`, `valeur` ; ex. `jeton_notifications` = empreinte SHA-256 du secret de la tâche d'envoi WhatsApp |
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
- Images de l'accueil (`lib/accueil.ts`) : choisies automatiquement parmi les articles visibles du public (200 plus récents), jamais d'image externe. Grande photo = grande photo du dernier article ; tuiles univers et « pièces phares » (`PIECES_PHARES`) = miniature du dernier article de l'univers ou de la catégorie ; sans article, tuile noire unie avec le mot. Maquette : `docs/maquettes/Accueil.dc.html`.
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

## Commandes (US-20)

Décisions du propriétaire : compte client lié au numéro de téléphone (connexion par lien e-mail en attendant le SMS) ; le client suit, la boutique met à jour ; une commande = plusieurs articles d'**une** boutique ; stock par taille, indicatif ; WhatsApp automatique.

- **Stock** (`lib/stock.ts`, migration `…_stock_par_taille.sql`) : `tailles.quantite` ; `disponible` est recalculé par la base (`quantite > 0`). Une écriture de `disponible` seule (ancien code, formulaire de modification) met la quantité à 0 ou à au moins 1. Quand la somme des quantités d'un article disponible ou réservé tombe à 0, la base le passe « Vendu » ; quand elle repasse au-dessus de 0 alors qu'il était « Vendu », il redevient « Disponible ». Ce calcul se fait **par instruction** (déclencheurs `articles_statut_stock_*` avec tables de transition, migration `20261009230000`) : une remise en stock de plusieurs tailles d'un coup est bien vue. Le commerçant modifie la quantité directement (`tailles`, droits existants).
- **Panier** (`lib/panier.ts`) : gardé dans le navigateur (`localStorage`, clé `oranpromo:panier`), une seule boutique, 10 lignes au plus, quantité 1 à 10 par ligne. Les prix du panier sont indicatifs : la base recalcule à la commande.
- **Passer commande** : `passer_commande(boutique, lignes, note)` (fonction de la base, `security definer`) : compte connecté, non bloqué (ni ce compte, ni un autre compte avec le même numéro, ni 5 no-shows sur ce compte ou ce numéro), avec nom valide et téléphone, pas sa propre boutique ; boutique validée ; articles visibles de cette boutique ; taille existante avec `quantite >= quantite demandée` ; 1 à 10 lignes, chacune avec `article_id`, `taille` et `quantite` (clé manquante = refus clair) ; au plus 5 commandes en cours (`demandee`, `confirmee`, `prete`) et 10 commandes par heure par client. Le stock ne bouge pas.
- **Transitions** : `changer_statut_commande(commande, statut, motif, note)` :
  - boutique (ou admin) : `demandee → confirmee` (stock − quantité ; **refusée** avec « Stock insuffisant pour … » si une ligne dépasse le stock — la boutique corrige son stock ou annule « Plus en stock »), `confirmee → prete` (`prete_le` = maintenant, `expire_le` = + 24 h), `prete → recuperee`, et `demandee|confirmee|prete → annulee` avec un motif `plus_en_stock`, `boutique_indisponible` ou `autre` ;
  - client : `demandee|confirmee → annulee` (motif `client_a_annule`) ;
  - annuler une commande `confirmee` ou `prete` remet le stock (ligne dont l'article ou la taille a disparu : ignorée) ;
  - `prive.retirer_stock` / `prive.remettre_stock` verrouillent les tailles dans l'ordre de leur `id` (pas d'interblocage entre deux commandes).
  - Toute autre transition est refusée. Chaque transition ajoute une ligne à `suivi_commandes`.
- **Expiration** : `prive.expirer_commandes()` passe `expiree` les commandes `prete` dont `expire_le` est passé et remet le stock. **Aucun no-show automatique** (décision du propriétaire, option C). Lancée toutes les 15 minutes par `pg_cron` (job `expirer-commandes`).
- **No-shows** (migration `20261009230000_corrections_relecture.sql`) :
  - la boutique déclare « Client pas venu » : `declarer_no_show(commande)` — boutique de la commande seulement, une fois par commande (`commandes.no_show_le`), sur une commande `expiree` ou `prete` depuis plus de 24 h (elle est alors expirée tout de suite) ; le client reçoit `oranpromo_no_show` avec les essais restants ;
  - nombre de no-shows = commandes avec un no-show déclaré et non annulé, passées par ce compte **ou** avec ce numéro (`commandes.client_telephone`) : un nouveau compte avec le même numéro hérite des no-shows. `profils.no_shows`, `bloque`, `bloque_le` en sont la copie, recalculée par la base (`prive.recalculer_no_shows`) ; bloqué au 5e ; un compte bloqué ne change pas de numéro ;
  - l'admin annule un no-show : `annuler_no_show(commande)` (`commandes.no_show_annule_le`) ; le compte est débloqué s'il repasse sous 5.
- **Déblocage** : `debloquer_client(client)` (admin seulement) : annule tous les no-shows comptés pour ce compte et son numéro, `bloque = false`, `no_shows = 0`.
- **Nom du client** : lettres latines (accents compris) ou arabes, espaces, apostrophe, tiret ; 2 à 60 caractères ; ni chiffres, ni lien, ni retour à la ligne (`prive.nom_valide`, contrainte `profils_nom_valide`, et `nomValide()` dans `lib/clients.ts`). Il part dans les messages WhatsApp : un nom non conforme y est remplacé par « cher client ».
- **Droits (RLS)** : le client lit ses commandes, leurs lignes et leur suivi ; la boutique lit ceux de sa boutique ; l'admin lit tout. Aucune politique d'écriture : uniquement les fonctions ci-dessus. Le client ne peut changer ni son rôle, ni `no_shows`, ni `bloque`.
- **Messages WhatsApp** (`lib/notifications/`) :
  - la base crée les messages dans `messages_whatsapp` (déclencheurs sur `suivi_commandes` et `profils`) : `oranpromo_nouvelle_commande` (boutique), `oranpromo_commande_prete`, `oranpromo_commande_expiree` (simple rappel), `oranpromo_no_show` (client pas venu, avec les essais restants), `oranpromo_compte_bloque` (client) ;
  - envoi côté serveur seulement, par le fournisseur choisi (`WHATSAPP_FOURNISSEUR`, `meta` par défaut : WhatsApp Cloud API, messages modèles en français) ; sans `WHATSAPP_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID`, aucun envoi ;
  - juste après une action (commande, « prête », « client pas venu »), l'action serveur envoie les messages de cette commande (`messages_whatsapp_commande()`, réservé aux participants) ;
  - le résultat d'un envoi n'est accepté qu'avec le jeton du serveur (`resultat_message_whatsapp(jeton, …)`, empreinte de `CRON_SECRET`) : sans `CRON_SECRET`, rien ne part juste après une action, la tâche planifiée s'en charge ; `lib/notifications/index.ts` est `server-only` ;
  - les autres (expiration, blocage, échecs) sont envoyés par `GET /api/notifications/whatsapp`, protégé par `Authorization: Bearer <CRON_SECRET>`, appelé par une tâche planifiée (Vercel Cron ou autre) ; la base vérifie l'empreinte du secret (`messages_whatsapp_en_attente()`, `prive.reglages`) ;
  - chaque envoi réserve le message 2 minutes (pas de double envoi), 5 tentatives au plus, puis `echec` ;
  - la tâche traite 5 messages au plus par appel (10 s maximum chacun) et ne commence plus d'envoi à moins de 17 s de la limite de 60 s de la fonction : un message n'est jamais coupé en plein envoi (sinon doublon).
  - mise en service :
    1. compte WhatsApp Business (Meta Business Manager) avec un numéro dédié, puis `WHATSAPP_TOKEN` (jeton d'utilisateur système permanent) et `WHATSAPP_PHONE_NUMBER_ID` sur l'hébergeur ;
    2. faire approuver par Meta les 5 modèles (catégorie « Utilitaire », langue `fr`) avec exactement ces textes (variables `{{1}}`…) :
       - `oranpromo_nouvelle_commande` : « Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace OranPromo, rubrique Commandes. »
       - `oranpromo_commande_prete` : « Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu'au {{4}}. »
       - `oranpromo_commande_expiree` : « Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n'a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher. »
       - `oranpromo_no_show` : « Bonjour {{1}}, {{2}} nous signale que vous n'êtes pas venu(e) chercher votre commande n° {{3}}. C'est votre {{4}}e commande non récupérée : encore {{5}} et votre compte OranPromo sera bloqué. Merci de ne commander que ce que vous viendrez chercher. »
       - `oranpromo_compte_bloque` : « Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo. »
    3. choisir `CRON_SECRET` (32 caractères aléatoires au moins), le mettre sur l'hébergeur et ranger son empreinte dans la base (éditeur SQL Supabase) : `insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('<CRON_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;`
    4. appeler `GET /api/notifications/whatsapp` avec `Authorization: Bearer <CRON_SECRET>` : `vercel.json` déclare un Vercel Cron (`0 9 * * *`, une fois par jour à 10 h, heure d'Oran : c'est le maximum du plan Hobby ; Vercel ajoute l'en-tête tout seul quand `CRON_SECRET` est défini). Sur le plan Pro, passer à `*/5 * * * *` ; sinon ajouter un appel toutes les 5 minutes par un service externe (cron-job.org…). Les messages « nouvelle commande », « prête » et « client pas venu » partent tout de suite après l'action ; la tâche sert aux rappels d'expiration, aux blocages et aux nouvelles tentatives ;
    5. suivre la file dans la table `messages_whatsapp` (colonnes `statut`, `erreur`).

## Variables d'environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navigateur et serveur | connexion à Supabase (clé publique) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODELE` | serveur | IA (US-14, US-15) |
| `NEXT_PUBLIC_SITE_URL` | serveur | adresse publique du site |
| `WHATSAPP_FOURNISSEUR` | serveur | `meta` (par défaut) ; prévu pour `twilio` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | serveur | WhatsApp Cloud API (Meta) ; vides = aucun envoi |
| `WHATSAPP_LANGUE` | serveur | langue des modèles Meta (`fr` par défaut) |
| `WHATSAPP_API_VERSION` | serveur | version de l'API Graph de Meta (`v23.0` par défaut) |
| `CRON_SECRET` | serveur | secret de la tâche d'envoi des messages en attente |

## IA (US-14, US-15)

`@anthropic-ai/sdk`, clé `ANTHROPIC_API_KEY` lue côté serveur uniquement. Demander une réponse JSON structurée (titre, description, categorie, genre, couleur) et la valider avant de la renvoyer. La catégorie est imposée parmi la liste officielle (mode et beauté). Si la photo ne montre ni un article de mode ni un produit de beauté : renvoyer une erreur claire, ne rien remplir.

## Tests

| Niveau | Outil | Exemples |
| --- | --- | --- |
| Règles métier | Vitest (`npm test`) | promo active/expirée, lien WhatsApp, format des prix |
| Règles de la base | `psql -v ON_ERROR_STOP=1 -f supabase/tests/<fichier>.test.sql` sur une base locale avec toutes les migrations (rôles `anon` / `authenticated`, `auth.uid()` lu dans `request.jwt.claim.sub`) ; tout est annulé à la fin | stock à la confirmation, statut « Vendu », no-shows, blocage par numéro, nom, jeton WhatsApp |
| Composants | Testing Library | bouton « Réserver » désactivé sans taille, prix barré en promo |
| Parcours complets | Playwright (après le MVP) | recherche → fiche → réservation |

## Style (voir `docs/maquettes/`)

Luxe monochrome : blanc `#FFFFFF`, noir `#0A0A0A`, gris `#6F6F6F`, traits `#E6E6E6`, fond photo `#F3F2EF`. Titres et logo en Bodoni Moda (`font-titre`), texte en Jost (`font-sans`). Libellés en capitales espacées (classe `etiquette`). Angles droits, pas d'ombres, boutons noirs pleins. Couleurs Tailwind disponibles : `noir`, `blanc`, `gris`, `trait`, `fond-photo`.

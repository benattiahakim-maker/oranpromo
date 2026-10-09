# Architecture technique — OranPromo

Une seule application **Next.js 16 (App Router, TypeScript, Tailwind 4)** + **Supabase** (base PostgreSQL, connexion par lien e-mail ou par code WhatsApp, stockage des photos). L'IA (API Claude) est appelée **uniquement côté serveur**. Hébergement prévu : Vercel.

> ⚠️ Next.js 16 diffère de ce que les modèles connaissent. Avant d'utiliser une API Next.js, lire le guide correspondant dans `node_modules/next/dist/docs/`. Exemple : `cookies()`, `headers()` et `params` sont asynchrones (`await`).

## Où vit quoi

```
app/
  page.tsx                      accueil : univers, grande photo, tuiles, promos du moment (US-04, lib/accueil.ts)
  catalogue/page.tsx            catalogue, recherche, filtres (US-05, US-06)
  a/[id]/page.tsx               fiche article + aperçu de partage (US-02, 03, 07, 17)
  b/[slug]/page.tsx             vitrine boutique + aperçu de partage (US-01, 03, 22)
  b/[slug]/apercu/route.tsx     image d'aperçu générée (boutique sans photo d'article, US-22)
  espace/connexion/page.tsx     connexion par lien e-mail (US-09)
  auth/callback/route.ts        retour du lien e-mail → session (US-09)
  espace/page.tsx               mes articles (US-11)
  espace/articles/nouveau/      ajout d'article, fiche IA (US-10, 14, 15)
  espace/articles/[id]/         modification, promo (US-11, 12)
  espace/statistiques/          mes chiffres (US-13)
  espace/affiche/page.tsx       affiche à imprimer avec le QR code de la boutique (US-22)
  espace/commandes/             commandes reçues par la boutique (US-20.3)
  panier/page.tsx               panier d'une boutique, « Commander » (US-20.2)
  compte/connexion/page.tsx     connexion client par lien e-mail ou par numéro + code (US-20.2, US-21)
  compte/connexion/actions.ts   envoi et vérification du code de connexion (US-21)
  compte/page.tsx               profil client : nom, téléphone, no-shows (US-20.2, 20.4)
  compte/commandes/             mes commandes et suivi avec la frise (US-20.2)
  admin/...                     boutiques, modération, tableau de bord, clients bloqués (US-16, 18, 19, 20.4)
  api/ia/fiche/route.ts         photo → fiche (US-14)
  api/ia/traduire/route.ts      traduction arabe (US-15)
  api/notifications/whatsapp/route.ts  envoi des messages WhatsApp en attente, appelé par une tâche planifiée (US-20.5)
  confirmer/[jeton]/page.tsx    page du lien « Confirmer » du message WhatsApp, sans connexion, lecture seule (US-20.6)
  confirmer/actions.ts          action serveur « Confirmer la commande » du lien (US-20.6)
  visiteurs/actions.ts          actions serveur des visiteurs : mesures (vues, clics, partages) et signalements, limités par visiteur
components/                     composants d'affichage réutilisables
lib/
  prix.ts                       règles de prix et promo (testé)
  whatsapp.ts                   liens wa.me (testé)
  lien-boutique.ts              slug, lien public, partage WhatsApp, aperçu, QR code de la boutique (US-22, testé)
  stock.ts                      stock par taille (US-20.1, testé)
  panier.ts                     panier d'une boutique, gardé dans le navigateur (US-20.2, testé)
  commandes.ts                  statuts, transitions, frise, lecture et actions (US-20.2, 20.3, testé)
  clients.ts                    profil client, no-shows, déblocage (US-20.2, 20.4, testé)
  telephone.ts                  numéro mobile algérien, mode de connexion client (US-21, testé)
  codes-telephone.ts            envoi et vérification des codes, limites d'envoi (US-21, serveur seulement, testé)
  confirmation.ts               lien signé « Confirmer » (US-20.6) : fabrication, vérification, confirmation (serveur seulement, testé)
  visiteurs.ts                  clé de visiteur (empreinte d'IP), mesures et signalements par les fonctions de la base (serveur seulement, testé)
  notifications/                messages WhatsApp : fournisseur (Meta Cloud API), envoi de la file d'attente (US-20.5, testé)
  supabase/client.ts            client navigateur ("use client")
  supabase/server.ts            client serveur (pages, routes, actions)
  supabase/types.ts             types générés depuis la base (ne pas modifier à la main)
supabase/migrations/            schéma SQL et règles de sécurité (déjà appliqués)
supabase/tests/                 tests SQL des règles de la base (transaction annulée, psql)
docs/                           user stories, architecture, maquettes
public/images/accueil/          images fixes de l'accueil (WebP), voir « Crédits des images »
```

## Lecture et écriture des données

- **Lecture publique** : les pages serveur lisent directement la base avec `creerClientServeur()`. Les règles de sécurité (RLS) ne renvoient que ce que le public a le droit de voir : boutiques validées, articles disponibles ou réservés confirmés il y a moins de 21 jours.
- **Écritures du commerçant** : actions serveur (`"use server"`) ou client navigateur avec la session du commerçant. La base refuse toute écriture hors de sa boutique, même si l'interface a un bug.
- **Routes `app/api/`** : uniquement pour ce qui a besoin d'un secret (IA Claude). Pas de route API pour lire des données que Supabase sert déjà.
- **Statistiques et signalements** : plus d'insertion directe dans `evenements` ni `signalements` ; le navigateur appelle les actions serveur `app/visiteurs/actions.ts`, qui appellent `enregistrer_evenement()` et `signaler_article()` avec le secret `VISITEURS_SECRET` ; la base limite par visiteur (voir « Limites par visiteur »).
- **Commandes** : aucune écriture directe dans `commandes`, `lignes_commande`, `suivi_commandes` ; tout passe par les fonctions de la base `passer_commande()` et `changer_statut_commande()` (appelées par des actions serveur), qui vérifient les droits, les transitions et déplacent le stock.

## Base de données (déjà créée sur Supabase, projet `oranpromo`)

Colonnes en `snake_case` français sans accents. Prix = entiers en dinars.

| Table | Rôle | Points clés |
| --- | --- | --- |
| `boutiques` | vitrines | `nom` : 2 à 80 caractères, espaces autour retirés (même limite à l’écran `NOM_BOUTIQUE_MAX`, sur le serveur `validerBoutique` et dans la base : contrainte + déclencheur `boutique_nom_verifie`, message « Le nom de la boutique doit contenir entre 2 et 80 caractères. ») ; `slug` unique, lisible (`^[a-z0-9]+(-[a-z0-9]+)*$`, 2 à 60 caractères, contrainte `boutiques_slug_lisible`, US-22) ; `statut` : `en_attente`, `validee`, `suspendue` ; seul un admin change le statut |
| `profils` | un par compte connecté | `role` : `client` (par défaut pour un nouveau compte), `commercant`, `ambassadeur`, `admin` ; `boutique_id` ; `nom`, `telephone` (format `+213XXXXXXXXX` quand l'utilisateur le saisit) ; `telephone_verifie_le` (numéro vérifié par code, US-21, écrit par la base) ; `no_shows`, `bloque`, `bloque_le`, `bloque_par_admin` (modifiables seulement par la base et l'admin) ; créé automatiquement à l'inscription |
| `articles` | articles | `statut` : `disponible`, `reserve`, `vendu`, `masque` ; `categorie` : liste fixe de 19 catégories (règle dans la base) ; `genre` : `homme`, `femme`, `enfant`, `mixte` ; `derniere_confirmation` ; `propose_par_ia` ; `masque_par_moderation` (seul un admin le lève) |
| `photos` | 1 à 5 par article | `adresse` (grande photo 1200 px, fiche article), `adresse_vignette` (miniature 400 px, cartes ; vide pour les anciennes photos → repli sur `adresse`), `ordre` ; adresses limitées au stockage `photos` du projet, dossier de l'article (règle dans la base) |
| `tailles` | tailles d'un article | `libelle`, `quantite` (stock indicatif, 0 à 999, 1 par défaut), `disponible` (calculé par la base : `quantite > 0`) ; unique par article |
| `promos` | au plus une par article | `prix_promo` (> 0 et < `articles.prix`, règle dans la base), `badge`, `date_fin` |
| `evenements` | statistiques | `type` : `vue_article`, `vue_boutique`, `clic_reserver`, `partage` ; `date` fixée par la base ; 120 par minute et par boutique au plus ; écrit seulement par `enregistrer_evenement()` (limite par visiteur) |
| `signalements` | signalements clients | `statut` : `ouvert`, `traite`, `rejete` ; `cree_le` fixée par la base ; 10 par heure et par article, 200 par heure au total ; écrit seulement par `signaler_article()` (limite par visiteur) |
| `decisions` | décisions de modération | `action`, `auteur_id`, `date` |
| `commandes` | commandes client (US-20) ; `no_show_le` (« Client pas venu » déclaré par la boutique), `no_show_annule_le` (annulé par l'admin), `contestee_le` / `contestation_validee_le` (contestation par le client, validée par l'admin ; motif dans `contestations`) | `numero` (affiché « n° 12 »), `client_id`, `boutique_id`, `statut` : `demandee`, `confirmee`, `prete`, `recuperee`, `annulee`, `expiree` ; `client_nom`, `client_telephone`, `telephone_verifie` (copiés du profil à la commande ; `telephone_verifie`, US-21) ; `note` (client, 300 car.), `motif_annulation` : `plus_en_stock`, `boutique_indisponible`, `client_a_annule`, `autre` ; `total` (DA) ; dates `cree_le`, `confirmee_le`, `prete_le`, `expire_le` (= `prete_le` + 24 h), `terminee_le` |
| `contestations` | motif d'une contestation de no-show (une par commande) | `commande_id` (clé, = la commande), `client_id`, `motif` (5 à 300 car.), `cree_le` ; lecture par le client qui l'a écrite et par l'admin seulement (RLS) — jamais par la boutique ; écriture uniquement par `contester_no_show` |
| `lignes_commande` | articles d'une commande | `commande_id`, `article_id` (vide si l'article est supprimé), `titre`, `taille`, `quantite` (1 à 10), `prix_unitaire` (prix affiché au moment de la commande, promo active comprise) |
| `suivi_commandes` | frise d'une commande | `commande_id`, `statut`, `date`, `auteur_id` (vide = automatique), `auteur` : `client`, `boutique`, `admin`, `systeme` ; `note` (300 car.) |
| `messages_whatsapp` | file d'attente des messages WhatsApp (US-20.5) | `destinataire` (`+213…`), `modele` (nom du modèle Meta), `parametres` (liste de textes), `texte` (version lisible), `commande_id`, `statut` : `a_envoyer`, `envoye`, `echec` ; `tentatives` (5 au plus), `reserve_jusqu_a`, `erreur`, `identifiant_fournisseur`, `cree_le`, `envoye_le` ; lisible par l'admin seulement, écrit par la base |
| `prive.reglages` | réglages internes (schéma non exposé) | `cle`, `valeur` ; ex. `jeton_notifications` = empreinte SHA-256 du secret de la tâche d'envoi WhatsApp ; `connexion_client`, `blocage_par_numero` (US-21) ; `jeton_confirmation` (empreinte de `CONFIRMATION_SECRET`) et `bouton_confirmer` (`on` = modèle avec bouton « Confirmer », US-20.6) |
| `prive.actions_visiteurs` | limites par visiteur (schéma non exposé) | `visiteur` (`u:<compte>` ou `ip:<empreinte HMAC de l'IP>`), `action` (`evenement`, `signalement`), `cible`, `date` ; lignes de plus de 24 h supprimées au fil de l'eau |
| `prive.envois_codes` | codes de connexion envoyés (US-21, schéma non exposé) | `telephone`, `envoye_le` ; limite 1 par minute et 5 par heure et par numéro |
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
- Images de l'accueil (`lib/accueil.ts`, décision du propriétaire du 9/10 : visuels couleur inspirés d'Oran) : images fixes de la marque dans `public/images/accueil/` (WebP), affichées avec `next/image` ; plus de lecture d'articles pour l'accueil. Grande photo = `accueil-santa-cruz.webp` (800 × 960, ≤ 120 Ko, cadrée sur le fort, `objectPosition` 50 % 20 %, voile dégradé noir pour la lisibilité du titre, `alt` vide car décorative) avec son **crédit affiché** en bas à droite (`CREDIT_GRANDE_PHOTO`) ; tuiles univers et « pièces phares » (`PIECES_PHARES`) = `univers-<clé>.webp` / `cat-<catégorie>.webp` (600 × 600, ≤ 60 Ko, `alt` en français), mot en dessous sur fond blanc. Ajouter ou changer une image : même format et même poids, crédit dans la section « Crédits des images ». Maquette (mise en page) : `docs/maquettes/Accueil.dc.html`.
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

Décisions du propriétaire : compte client lié au numéro de téléphone (connexion par lien e-mail, ou par numéro vérifié par code en mode téléphone, US-21) ; le client suit, la boutique met à jour ; une commande = plusieurs articles d'**une** boutique ; stock par taille, indicatif ; WhatsApp automatique.

- **Stock** (`lib/stock.ts`, migration `…_stock_par_taille.sql`) : `tailles.quantite` ; `disponible` est recalculé par la base (`quantite > 0`). Une écriture de `disponible` seule (ancien code, formulaire de modification) met la quantité à 0 ou à au moins 1. Quand la somme des quantités d'un article disponible ou réservé tombe à 0, la base le passe « Vendu » ; quand elle repasse au-dessus de 0 alors qu'il était « Vendu », il redevient « Disponible ». Ce calcul se fait **par instruction** (déclencheurs `articles_statut_stock_*` avec tables de transition, migration `20261009230000`) : une remise en stock de plusieurs tailles d'un coup est bien vue. Le commerçant modifie la quantité directement (`tailles`, droits existants).
- **Panier** (`lib/panier.ts`) : gardé dans le navigateur (`localStorage`, clé `oranpromo:panier`), une seule boutique, 10 lignes au plus, quantité 1 à 10 par ligne. Les prix du panier sont indicatifs : la base recalcule à la commande.
- **Passer commande** : `passer_commande(boutique, lignes, note)` (fonction de la base, `security definer`) : compte connecté, non bloqué (ni ce compte, ni 5 no-shows sur ce compte ; les no-shows d'autres comptes ne comptent que pour un numéro vérifié par code, voir No-shows ; en mode téléphone, numéro vérifié exigé, US-21), avec nom valide et téléphone, pas sa propre boutique ; boutique validée ; articles visibles de cette boutique ; taille existante avec `quantite >= quantite demandée` ; 1 à 10 lignes, chacune avec `article_id`, `taille` et `quantite` (clé manquante = refus clair) ; au plus 5 commandes en cours (`demandee`, `confirmee`, `prete`) et 10 commandes par heure par client ; au plus 20 nouvelles commandes par heure et par boutique, tous clients confondus, **sans compter les commandes annulées par le client dans les 2 minutes** qui suivent leur création, et au plus **3 commandes par heure pour un même client dans une même boutique** (annulées comprises) (déclencheur `commandes_limite_boutique`, migrations `20261009233000` et `20261010130000_relecture4_blocage_limites`, erreurs 54000 « Cette boutique a reçu trop de commandes dans la dernière heure… » / « Vous avez déjà passé 3 commandes dans cette boutique en une heure… »). Le stock ne bouge pas.
- **Transitions** : `changer_statut_commande(commande, statut, motif, note)` :
  - boutique (ou admin) : `demandee → confirmee` (stock − quantité ; **refusée** avec « Stock insuffisant pour … » si une ligne dépasse le stock — la boutique corrige son stock ou annule « Plus en stock »), `confirmee → prete` (`prete_le` = maintenant, `expire_le` = + 24 h), `prete → recuperee`, et `demandee|confirmee|prete → annulee` avec un motif `plus_en_stock`, `boutique_indisponible` ou `autre` ;
  - client : `demandee|confirmee → annulee` (motif `client_a_annule`) ;
  - annuler une commande `confirmee` ou `prete` remet le stock (ligne dont l'article ou la taille a disparu : ignorée) ;
  - `prive.retirer_stock` / `prive.remettre_stock` verrouillent les tailles dans l'ordre de leur `id` (pas d'interblocage entre deux commandes).
  - Toute autre transition est refusée. Chaque transition ajoute une ligne à `suivi_commandes`.
- **Expiration** : `prive.expirer_commandes()` passe `expiree` les commandes `prete` dont `expire_le` est passé et remet le stock. **Aucun no-show automatique** (décision du propriétaire, option C). Lancée toutes les 15 minutes par `pg_cron` (job `expirer-commandes`).
- **No-shows** (migration `20261009230000_corrections_relecture.sql`) :
  - la boutique déclare « Client pas venu » : `declarer_no_show(commande)` — boutique de la commande seulement, une fois par commande (`commandes.no_show_le`), sur une commande `expiree` ou `prete` depuis plus de 24 h (elle est alors expirée tout de suite) ; le client reçoit `oranpromo_no_show` avec les essais restants ;
  - nombre de no-shows = commandes de **ce compte** avec un no-show déclaré, non annulé et sans contestation en attente, **plus** (US-21.3) celles passées par un autre compte avec le même numéro **vérifié** (`commandes.telephone_verifie`), à condition que ce compte ait lui aussi ce numéro vérifié (migrations `20261009233000_numero_non_verifie.sql` et `20261010100000_blocage_numero_verifie.sql`). Un numéro saisi à la main n'est pas fiable (n'importe qui peut saisir celui d'une autre personne) : il ne compte jamais pour un autre compte. `profils.no_shows`, `bloque`, `bloque_le` en sont la copie, recalculée par la base (`prive.recalculer_no_shows`) ; bloqué automatiquement au 5e ; un compte bloqué ne change pas de numéro ; `/compte` n'affiche que le compteur du compte ;
  - **contestation** (migration `20261009234500_contestation_no_show.sql`, décision du propriétaire) : le client conteste un no-show depuis `/compte` (`contester_no_show(commande, motif)`) — seulement le compte de la commande, une fois par no-show, motif de 5 à 300 caractères, dans les **7 jours** qui suivent la déclaration du no-show, **une seule contestation en attente à la fois** par compte (`commandes.contestee_le` ; le motif est dans la table `contestations`, invisible pour la boutique — migration `20261009235500_contestation_regles.sql`). Tant que la contestation est en attente, le no-show ne compte pas dans le compteur et ne peut pas déclencher un **nouveau** blocage ; mais un compte **déjà bloqué** le reste tant que ses no-shows, contestations en attente comprises, sont 5 ou plus (`prive.no_shows_avec_contestations`, relecture n°4, migration `20261010130000`) : seule une décision de l'admin le débloque (annuler un no-show, débloquer), et aucun second message « compte bloqué » ne part. L'admin la traite dans `/admin/clients` : `valider_no_show(commande)` (`commandes.contestation_validee_le`, le no-show compte de nouveau, blocage possible) ou `annuler_no_show(commande)`. Aucun message WhatsApp ;
  - blocage décidé par l'admin : `profils.bloque_par_admin` ; jamais levé par un recalcul (contestation, annulation), seulement par `debloquer_client` ;
  - blocage manuel : dans `/admin/clients`, chaque client listé a un bouton **Bloquer** (`bloquer_client(client)`, `bloque_par_admin`, aucun message WhatsApp, le recalcul ne lève pas ce blocage) ou **Débloquer** (`debloquer_client(client)`) ; le numéro affiche « (vérifié) » quand il l'est. La section « Numéro partagé par plusieurs comptes » et `numeros_partages()` sont supprimées (US-21.3) ;
  - blocage par numéro (US-21.3) : **activé** (réglage `blocage_par_numero` = `on` dans `prive.reglages`, `prive.blocage_par_numero()`), limité aux numéros vérifiés par code (voir « Connexion des clients par téléphone ») ;
  - l'admin annule un no-show : `annuler_no_show(commande)` (`commandes.no_show_annule_le`) ; le compte est débloqué s'il repasse sous 5.
- **Déblocage** : `debloquer_client(client)` (admin seulement) : annule les no-shows de ce compte et, si son numéro est vérifié, ceux des commandes passées avec ce numéro vérifié (par n'importe quel compte), `bloque = false`, `no_shows = 0`. **Blocage manuel** : `bloquer_client(client)` (admin seulement).
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

## Connexion des clients par téléphone (US-21)

Remplace la carte Trello « V2 · Connexion par SMS ». Stories : `docs/user-stories.md`, module 8.

**Principe** : Supabase Auth envoie et vérifie le code ; le fournisseur est **Twilio Verify**, configuré par le propriétaire dans le tableau de bord Supabase (Authentication > Sign In / Providers > Phone). **Aucune clé** (Twilio, Turnstile secrète, Supabase service) dans le code, `.env*` ou un commit.

**Deux modes** (bascule sans redéploiement de la base) :

| | `email` (par défaut) | `telephone` |
| --- | --- | --- |
| Variable serveur `CONNEXION_CLIENT` (Vercel) | absente ou `email` : `/compte/connexion` = lien e-mail, comme avant | `telephone` : `/compte/connexion` = numéro + code ; lien vers la connexion e-mail |
| Réglage de la base `connexion_client` (`prive.reglages`, lu par `prive.connexion_par_telephone()`) | absent : aucune vérification exigée | `telephone` : `passer_commande` exige `profils.telephone_verifie_le` |
| Profil `/compte` | nom + numéro saisi à la main (un numéro déjà vérifié n'est plus modifiable) | nom seul ; numéro vérifié par code, « Changer de numéro » = nouvelle vérification |

Les deux réglages vont ensemble : d'abord `CONNEXION_CLIENT=telephone` sur Vercel, puis le réglage de la base (`insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;`). Retour au mode e-mail : supprimer la ligne, puis la variable. Commerçants et admin : toujours le lien e-mail (`/espace/connexion`).

**Parcours** (actions serveur, client Supabase serveur avec la session en cookies ; `supabase-js` 2.117) :
- connexion (`app/compte/connexion/actions.ts`) : `envoyerCodeConnexion(telephone, jetonCaptcha)` → `auth.signInWithOtp({ phone, options: { channel: 'whatsapp', captchaToken } })` ; `verifierCodeConnexion(telephone, code)` → `auth.verifyOtp({ phone, token, type: 'sms' })` (même `type: 'sms'` quand le code est arrivé par WhatsApp) ;
- compte existant connecté par e-mail, ou changement de numéro (`app/compte/actions.ts`) : `envoyerCodeVerification(telephone)` → `auth.updateUser({ phone, channel: 'whatsapp' })` (le serveur Supabase Auth accepte `channel` sur `PUT /user` ; `supabase-js` le transmet tel quel) ; `verifierCodeVerification(telephone, code)` → `auth.verifyOtp({ phone, token, type: 'phone_change' })`. Pas de captcha sur ce parcours (Supabase ne le demande pas : l'utilisateur est déjà connecté) ; les limites par numéro s'appliquent ;
- **WhatsApp uniquement** (US-21.5, SMS trop cher) : pas de bouton SMS, pas de paramètre « canal » dans les actions serveur ; le serveur impose `channel: 'whatsapp'` (`CANAL_CODE` dans `lib/telephone.ts`). Le type `'sms'` de `verifyOtp` est le nom donné par Supabase au code reçu sur un téléphone, quel que soit le canal.
- **Connexion par lien e-mail toujours permise aux clients** (décision du propriétaire), dans les deux modes. Ce qui empêche les comptes multiples en mode téléphone : `passer_commande` exige un numéro vérifié, et l'index unique fait qu'un numéro vérifié = un seul compte. Un client connecté par e-mail vérifie son numéro depuis `/compte` ou `/panier`.

**Format** (`lib/telephone.ts`, testé, et `prive.telephone_client_valide()` dans la base) : `+213` puis `5`, `6` ou `7`, puis 8 chiffres. Saisies acceptées : `05xx xx xx xx`, `5xxxxxxxx`, `+213…`, `00213…`, `0213…`, `+2130…` ; espaces, points, tirets et parenthèses ignorés. Supabase Auth range le numéro sans `+` dans `auth.users.phone`.

**Base** (une migration par sous-story) :
- `profils.telephone_verifie_le` (date de vérification, vide = numéro saisi à la main) ; écrite seulement par la base ;
- `commandes.telephone_verifie` (booléen copié à la commande : le numéro de la commande était-il vérifié ?) ;
- `prive.envois_codes(telephone, envoye_le)` : un enregistrement par code envoyé ; lignes de plus de 24 h supprimées au fil de l'eau ;
- déclencheurs sur `auth.users` :
  - `numero_client_algerien` (avant création ou changement de `phone` / `phone_change`) : refuse un numéro qui n'est pas mobile algérien. À la création d'un compte par numéro, l'erreur arrive **avant** l'envoi du code (aucun message payé vers un numéro étranger). Depuis la relecture n°4 (migration `20261010140000_numero_reserve_clients`), refuse aussi d'ajouter ou de changer un numéro sur un compte commerçant, ambassadeur ou admin (`42501` ; retirer un numéro reste possible) ; `envoyerCodeVerificationClient` fait le même contrôle avant tout envoi, et `/compte` ne propose la vérification qu'aux clients ;
  - (sur `profils`) `numero_retire_non_client` (après changement de `role`, si le nouveau rôle n'est pas `client` ; relecture n°5, migration `20261010160000_numero_retire_non_clients`) : `prive.retirer_numero_non_client` vide `auth.users.phone`, `phone_confirmed_at`, `phone_change` (et `phone_change_token`, `phone_change_sent_at`), efface `profils.telephone_verifie_le`, efface `profils.telephone` s'il était le numéro de connexion vérifié (un numéro saisi à la main est gardé), puis recalcule les no-shows. Couvre `rattacher_commercant`, une promotion admin ou ambassadeur, et toute mise à jour du rôle. Ordre : le rôle est déjà changé quand il s'exécute ; il ne fait que **retirer** un numéro, ce que `numero_client_algerien` laisse passer ; `z_numero_verifie` efface alors la vérification ; l'index unique des numéros vérifiés n'est jamais gêné. Un client ne peut pas changer son propre rôle (`prive.proteger_profil`), donc il ne peut pas perdre son numéro ainsi ;
  - `z_numero_verifie` (après création ou changement de `phone` / `phone_confirmed_at`, après `a_l_inscription`) : numéro confirmé → `profils.telephone = '+' || phone`, `telephone_verifie_le = now()` ; retire la vérification de tout autre profil qui portait ce numéro (l'index unique ne peut pas faire échouer la vérification Supabase) ; recalcule les no-shows ;
- `prive.creer_profil()` ne recopie plus `auth.users.phone` (non vérifié, sans `+`) : le numéro arrive par `z_numero_verifie` ;
- `prive.proteger_profil()` : `telephone_verifie_le` non modifiable par le client ; numéro vérifié non modifiable à la main (« Votre numéro est vérifié : pour en changer, vérifiez le nouveau numéro par code. ») ;
- `passer_commande` : en mode téléphone, refus sans numéro vérifié (`23514`, « Vérifiez votre numéro de téléphone par code avant de commander. ») ; copie `telephone_verifie` ;
- **limites d'envoi** : `controler_envoi_code(jeton, telephone)` (refus `54000` : 1 code par minute, 5 par heure et par numéro) avant l'appel à Supabase, puis `enregistrer_envoi_code(jeton, telephone)` seulement si Supabase a accepté l'envoi (un captcha raté ne consomme pas le quota d'un numéro). Les deux exigent le jeton du serveur `CODES_TELEPHONE_SECRET` (secret à part depuis la relecture n°4, migration `20261010150000_secret_codes_telephone.sql` ; empreinte `jeton_codes_telephone` dans `prive.reglages`, `prive.verifier_jeton_codes`) : personne ne peut épuiser le quota d'un autre numéro depuis le navigateur, et une fuite de `CRON_SECRET` n'y donne plus accès. Sans `CODES_TELEPHONE_SECRET` configuré, l'envoi de code est refusé (« La connexion par téléphone n'est pas encore configurée. »).
- **Blocage par numéro** (US-21.3) : réglage `blocage_par_numero` = `on` ; `prive.no_shows_actifs` compte les no-shows du numéro seulement pour les commandes `telephone_verifie` et seulement si le compte visé a ce numéro vérifié ; index unique partiel `profils(telephone) where telephone_verifie_le is not null` ; `debloquer_client` n'annule par numéro que les no-shows de commandes au numéro vérifié ; `numeros_partages()` et la section admin « Numéro partagé » sont supprimées. Choix de l'index partiel : les anciens numéros saisis à la main peuvent être en double ou appartenir à quelqu'un d'autre ; on ne les supprime pas et on ne les rend pas uniques, on les traite comme non fiables (ils ne comptent jamais pour un autre compte). L'unicité de `auth.users.phone` (Supabase) garantit déjà qu'un numéro ne se vérifie que sur un compte.

**Anti-abus** :
- captcha **Cloudflare Turnstile** avant l'envoi du code : le widget (script `https://challenges.cloudflare.com/turnstile/v0/api.js`, chargé avec `next/script`, sans nouvelle dépendance) affiche le contrôle ; le jeton part dans `captchaToken` ; Supabase le vérifie avec la clé secrète rangée dans Authentication > Attack Protection (Bot protection). Clé de site publique : `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Une fois la protection activée dans Supabase, **toutes** les connexions la demandent : le formulaire de lien e-mail (clients et commerçants) affiche donc aussi le widget dès que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est défini ;
- limites par numéro ci-dessus ; refus des numéros non algériens (écran, serveur, base) ;
- risque restant : un robot qui appelle directement l'API Supabase Auth (`POST /auth/v1/otp`, `PUT /auth/v1/user`, avec la clé publique) contourne la limite « 5 par heure et par numéro » du site, mais doit quand même réussir le captcha ; il pourrait aussi demander `channel: 'sms'` directement à Supabase : c'est pourquoi le canal SMS doit être **désactivé dans le service Twilio Verify** (voir `docs/ETAT.md`). Restent actives, sans code : la base refuse tout numéro non algérien et tout numéro sur un compte non client ; Supabase limite à 1 code par minute et par compte (« Send OTPs », par utilisateur), à 30 demandes par 5 minutes et par IP, et au **nombre de messages par heure pour tout le projet** (« SMS messages sent », 30 par défaut : c'est le plafond de dépense) ; Twilio Verify limite à 5 envois par numéro en 10 minutes (erreur 60203). Fraud Guard et les Geo permissions de Twilio ne concernent que le SMS et la voix, pas WhatsApp ; WhatsApp ne facture pas les messages non remis.
- **Send SMS hook (étudié, non retenu, relecture n°4)** : un hook « Send SMS » (Authentication > Hooks) **remplace** l'envoi de Supabase : quand il est activé, Supabase n'appelle plus Twilio Verify et vérifie lui-même le code (code source de Supabase Auth, `internal/api/phone.go` et `verify.go` : la vérification par Twilio Verify n'a lieu que si le hook est désactivé). Un hook ne peut donc pas seulement « refuser puis laisser Twilio Verify envoyer » : il doit livrer le code lui-même. **Décision du propriétaire (9/10/2026) : option A** — on garde Twilio Verify, pas de hook ; protection par les réglages : captcha (Attack Protection), plafond bas de codes par heure pour le projet (20 à 30, Rate Limits), Twilio prépayé sans recharge automatique, Algérie seulement, Fraud Guard, alertes de consommation. Un hook HTTP (Edge Function) qui envoie par l'API WhatsApp Cloud de Meta (option B) ou par Twilio Messaging (option C) reste une évolution possible : détails dans `docs/ETAT.md`, « Relecture n°4 ».

## Lien de boutique à partager (US-22)

Stories : `docs/user-stories.md`, module 9.

- **Adresse** : `/b/<slug>` (page existante, US-01/03) ; lien absolu = `NEXT_PUBLIC_SITE_URL` + `/b/<slug>` (`lienBoutique()`, `lib/lien-boutique.ts`). Pas de nouvelle route publique ni de redirection : le slug est l'adresse.
- **Slug** : tiré du nom (`slugBoutique()`, `lib/boutique.ts`), coupé à 50 caractères ; à la création (`creerBoutique`), on essaie `nom`, puis `nom-2` … `nom-9`, puis `nom-<6 caractères aléatoires>` ; la contrainte unique de la base reste l'arbitre (conflit `23505` → candidat suivant). L'ambassadeur ne voit pas toutes les boutiques (RLS) : on ne vérifie pas avant, on réessaie. Format vérifié par la base (contrainte `boutiques_slug_lisible`, migration `…_slug_lisible.sql`, en plus du `check` initial `^[a-z0-9-]{2,60}$`) et par `slugValide()`. Le slug d'une boutique publiée ne change qu'avec un admin (règle existante, `prive.proteger_coordonnees_boutique`).
- **Visibilité** : seule une boutique `validee` est lue par le public (RLS existante + filtre `statut = 'validee'` dans la page et dans `apercu`) ; sinon « Boutique indisponible », `robots: noindex`, et `apercu` répond 404.
- **Aperçu** (`generateMetadata` de `app/b/[slug]/page.tsx`) : `title` = nom, `description` = `descriptionBoutique()` (quartier, nombre d'articles disponibles), `alternates.canonical`, Open Graph (`type: website`, `siteName: OranPromo`, `locale: fr_FR`) et Twitter (`summary_large_image`) ; image = grande photo (`photos.adresse`) du dernier article disponible, sinon `/b/<slug>/apercu` (1200 × 630, PNG, `ImageResponse` de `next/og`, inclus dans Next.js : nom de la boutique, quartier, « OranPromo », noir sur blanc). Pas de logo de boutique (aucune colonne prévue).
- **Bloc « Partager ma boutique »** (`components/PartagerBoutique.tsx`, sur `/espace`) : lien, « Copier le lien » (`navigator.clipboard`), « Partager sur WhatsApp » (`lienPartageWhatsApp()` → `https://wa.me/?text=…`, sans numéro : le commerçant choisit le contact ou son statut), QR code, « Télécharger le QR code » (SVG), « Imprimer l'affiche » (`/espace/affiche`). Boutique non validée : message, ni lien de partage ni QR code.
- **QR code** : dépendance `qrcode` (MIT, génération locale, aucun service externe), appelée côté serveur seulement (`qrCodeSvg()` dans `lib/lien-boutique.ts`) ; SVG noir sur blanc, correction d'erreur `M`, marge de 4 modules (lisible imprimé en petit).

## Arabe et darja (US-23)

Textes **validés par le propriétaire le 9/10/2026** (version darja, masculin générique). Mise en œuvre par étapes ; ce qui est fait est indiqué « (fait) ».

**Fait (étape 1, socle)** : `lib/langue.ts` (`Langue`, `COOKIE_LANGUE`, `langueDepuisCookie`, `direction`, `remplir`, `isolerGaucheDroite`), `lib/langue-serveur.ts` (`getLangue()`, `getTextes()`, serveur seulement), `lib/textes/fr.ts`, `ar.ts`, `index.ts` (`textesDe`), `components/FournisseurTextes.tsx` (`useTextes()`, `useLangue()` pour les composants client), `components/ChoixLangue.tsx` + `app/langue/actions.ts` (`choisirLangue`), `app/layout.tsx` (`lang`, `dir`, polices), `.etiquette` en arabe dans `app/globals.css`, `formaterPrix(montant, langue)`. Écarts par rapport à la conception :
- les textes sont des chaînes avec des `{variables}` remplies par `remplir()` (pas de fonctions) : le layout serveur peut ainsi passer au fournisseur client **les textes de la seule langue choisie** ; le dictionnaire français est aussi inclus dans le JavaScript client comme valeur par défaut (tests, composants hors fournisseur) ;
- le sélecteur est **un seul bouton** qui montre l'autre langue (« عربي » ou « FR ») et non deux boutons « FR | عربي » : à 375 px, l'en-tête n'a pas la place pour le logo, la recherche, le panier et deux boutons de 44 px ; pour la même raison, « Rechercher » devient une icône loupe (nom accessible « Rechercher » / « ابحث ») ;
- la galerie photo de la fiche reste en `dir="ltr"` (le défilement horizontal en RTL inverse `scrollLeft`).

**Fait (étape 2, pages publiques et client)** : composants serveur → `getTextes()` / `getLangue()` ; composants client → `useTextes()` / `useLangue()`. Listes fixes : `textes.listes` (clé = valeur française enregistrée en base ou dans l'URL, `traduire()` de `lib/textes` pour l'affichage). `formaterDateHeure(iso, langue)` (`lib/commandes.ts`) : `ar-DZ-u-nu-latn`, 24 h. Titres, noms et adresses saisis par la boutique en `dir="auto"`. Champs téléphone, code et e-mail en `dir="ltr"`. Pourcentage de réduction isolé de gauche à droite (`\u2066…\u2069`). Écart : il n'existe pas de liste fixe des quartiers (saisis par la boutique), ils ne sont donc pas traduits.

**Fait (étape 3, messages d'erreur)** : `lib/textes/messages.ts` : `traduireMessage(message, langue)` et `traduireErreurs(erreurs, langue)`. Les règles (`lib/`) et la base gardent leurs messages **en français, inchangés** ; la traduction se fait **à la sortie** : actions serveur des pages publiques et client (`app/panier`, `app/compte`, `app/compte/connexion`, `app/visiteurs` : `envoyerSignalement`) enveloppées par `enLangue()` (`lib/langue-serveur.ts`, traduit `message`, `erreur`, `erreurs` selon le cookie) ; composants client (messages de `lib/` affichés sans passer par le serveur : `messageNoShows`, `erreurMotifContestation`, `ErreurAutreBoutique`, `ErreurPanier`, `ErreurConnexion`, `MESSAGE_TELEPHONE_INVALIDE`, `validerProfilClient`) via `traduireMessage(…, useLangue())`. Table : messages fixes (clé = texte français, apostrophes `’` et `'` confondues, car la base écrit `'` et `lib/` écrit `’`) + modèles à valeurs (expressions régulières : nombre de pièces, taille, titre, nombre de no-shows…). Message absent de la table → **français gardé** (un test vérifie qu'aucune entrée n'est vide). Écart par rapport à la conception (« codes d'erreur ») : la clé est le message français lui-même, pour ne toucher ni aux règles ni aux fonctions de la base (dont blocage, no-show, vérification du numéro) ; contrepartie : changer un message français demande de changer sa clé dans la table (le test « texte validé n° 8 » et les tests des messages des règles le signalent). Espace commerçant et admin : messages en français.

**Fait (étape 4, WhatsApp en arabe)** : migration `20261010200000_whatsapp_arabe` : `commandes.langue` et `messages_whatsapp.langue` (`fr`/`ar`, défaut `fr`) ; `public.definir_langue_commande(commande, langue)` (le client de la commande seulement), appelée par `commanderPanier` juste après `passer_commande` quand le cookie vaut `ar` (un échec n'empêche pas la commande : messages en français) ; `prive.ajouter_message_whatsapp` (seule fonction modifiée de la chaîne) remplace le texte et le modèle par la version arabe (`prive.gabarit_whatsapp_arabe`, `prive.parametres_whatsapp_arabe` : « cher client » → « خويا », « JJ/MM à HHhMI » → « JJ/MM على HH:MI ») quand : le modèle a une version arabe (client : prête, expirée, client pas venu, compte bloqué), l'interrupteur `prive.reglages.modeles_arabes` vaut `on`, et la langue du client est `ar` (celle de la commande ; pour le blocage, sans commande, celle de sa dernière commande). Les fonctions de règles (`declarer_no_show`, expiration, blocage, `passer_commande`) ne sont pas modifiées. `lib/notifications/meta.ts` : `langueModeleMeta()` : modèle `…_ar` → `language.code = "ar"`, sinon `WHATSAPP_LANGUE`. Écart : modèles **séparés** suffixés `_ar` plutôt que le même nom en deux langues : la file (`messages_whatsapp_commande`, `messages_whatsapp_en_attente`) garde la même forme de résultat (pas de fonction à supprimer et recréer), et chaque modèle arabe est approuvé et activé à part.

**Lu avant de choisir** : le guide `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` (Next.js 16). Il propose des dictionnaires chargés côté serveur (`getDictionary`) et un segment `app/[lang]` avec redirection dans le proxy. On garde les **dictionnaires** du guide, mais **pas** le segment `[lang]` :
- les adresses restent les mêmes (`/a/…`, `/b/<slug>`…) : les liens et QR codes déjà imprimés (US-22) restent valables, aucun déplacement de toutes les pages sous `app/[lang]`, aucune redirection à ajouter dans `proxy.ts` ;
- le propriétaire veut un choix gardé dans un cookie ;
- les pages publiques sont déjà dynamiques (`export const dynamic = "force-dynamic"`) : lire un cookie ne coûte rien en cache ;
- contrepartie acceptée : Google n'indexe que la version française (pas d'adresse `/ar`).

**Aucune nouvelle dépendance** (pas de `next-intl`, `next-international`, `negotiator`…) : deux langues, des textes simples, un cookie ; une bibliothèque n'apporterait que du poids. À reconsidérer seulement si on ajoute une 3e langue ou des pluriels complexes.

Conception proposée :
- `lib/langue.ts` : `LANGUES = ["fr", "ar"]`, `langueDepuisCookie(valeur)` (tout ce qui n'est pas `ar` donne `fr`), `getLangue()` (lit `cookies()` de `next/headers`), `direction(langue)` (`rtl` pour `ar`).
- `lib/dictionnaires/fr.ts` et `ar.ts` : objets TypeScript (pas de JSON, pour le typage), groupés par écran (`accueil`, `fiche`, `panier`, `commandes`, `compte`, `connexion`, `erreurs`, `listes`…). `ar.ts` est typé `satisfies Dictionnaire` (le type de `fr.ts`) : une clé manquante casse le build. `getDictionnaire()` côté serveur (`import "server-only"`), comme `getDictionary` du guide.
- Composants client (`"use client"` : panier, tailles, contestation…) : ils reçoivent leurs textes en props depuis la page serveur, ou par un petit contexte `<Textes>` posé dans le layout avec la seule partie utile du dictionnaire (pas tout le dictionnaire dans le JavaScript du navigateur).
- Messages d'erreur renvoyés par les actions serveur et par la base : aujourd'hui des phrases françaises. On passera à des **codes d'erreur** (ex. `code_incorrect`) traduits à l'affichage ; tant qu'un code n'est pas traduit, le français s'affiche. Les règles elles-mêmes (blocage, no-show, vérification du numéro) ne changent pas.
- `app/layout.tsx` : `<html lang={langue} dir={direction(langue)}>`.
- **Sélecteur** `components/ChoixLangue.tsx` dans `EntetePublic` : un `<form>` avec une **action serveur** `choisirLangue(langue)` qui écrit le cookie `langue` (`path=/`, 1 an, `SameSite=Lax`, `Secure` en production ; pas `httpOnly` nécessaire mais sans risque) puis `refresh()` (de `next/cache`) ; marche sans JavaScript. Libellés « FR » et « عربي ».
- **Mise en page RTL** : Tailwind v4 gère `dir="rtl"` avec les variantes `rtl:`/`ltr:` et les classes logiques (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). Lors du code, remplacer `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` par les classes logiques et retourner les flèches (`rtl:-scale-x-100`). Prix et numéros entourés de `<bdi dir="ltr">` (sinon « 3 500 » devient « 500 3 », vu sur la maquette). La description arabe (US-15) a déjà `dir="rtl" lang="ar"`.
- **Polices** : Bodoni Moda et Jost n'ont pas de lettres arabes. Ajouter par `next/font/google`, sous-ensemble `arabic`, avec `preload: false` (téléchargées seulement si une lettre arabe s'affiche) : **Tajawal** (300, 400, 500 ; texte) et **Noto Naskh Arabic** (400, 500 ; titres). Piles de polices : `font-sans` = Jost puis Tajawal ; `font-titre` = Bodoni Moda puis Noto Naskh Arabic : les lettres latines (noms de boutiques, titres d'articles) gardent les polices actuelles, les lettres arabes prennent la police arabe, y compris dans les descriptions arabes existantes. Licences : SIL Open Font License (usage commercial autorisé).
- `.etiquette` (capitales espacées) : en `[dir=rtl]`, `letter-spacing: 0`, `text-transform: none` et taille plus grande (13 px au lieu de 10 px), l'arabe n'ayant pas de capitales et l'espacement cassant les liaisons.
- **Messages WhatsApp** : nouveaux modèles Meta en langue `ar` (même nom, langue `ar`, ou `…_ar`), à soumettre à **l'approbation de Meta**. Il faudra une migration (nouvelle, jamais en modifiant les anciennes) : colonne `langue` (`fr`/`ar`, défaut `fr`) sur `commandes` (langue au moment de la commande) et sur `messages_whatsapp`, et textes arabes dans les fonctions qui remplissent la file. L'envoi (`lib/notifications/meta.ts`) passe `language.code = "ar"` ; réglage `prive.reglages` « modèles arabes approuvés » : tant qu'il est faux, envoi en français. Les messages à la boutique (nouvelle commande) restent en français.
- **Pas traduit** : contenu saisi par la boutique (nom, titre, description française), espace commerçant, administration, e-mails Supabase, aperçu Open Graph des liens partagés.
- Dates : `Intl.DateTimeFormat("ar-DZ", { numberingSystem: "latn" })` pour garder les chiffres 0-9 ; prix : `formaterPrix` gagne une langue (`DA` → `دج`).
- Maquette : `docs/maquettes/FicheArabe.dc.html`.

## Confirmer depuis WhatsApp (US-20.6)

Story : `docs/user-stories.md`, US-20.6. Maquettes : `WhatsAppConfirmer.dc.html`, `ConfirmerCommande.dc.html`. Migration `20261010190000_confirmer_whatsapp.sql`. Code : `lib/confirmation.ts`, `app/confirmer/[jeton]/page.tsx`, `app/confirmer/actions.ts`, `components/ConfirmerCommande.tsx`, `lib/notifications/` (bouton).

**Bouton lien ou bouton de réponse rapide ?** (modèles « Utilitaire » de Meta : jusqu'à 10 boutons, dont « URL » et « Quick reply » ; developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates)
- **Bouton lien (retenu)** : `https://<domaine>/confirmer/{{1}}` ; un seul paramètre, **à la fin** de l'adresse, envoyé à chaque message (`components: [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "<lien>" }] }]`, caractères spéciaux encodés) ; libellé 25 caractères au plus ; le lien s'ouvre dans le navigateur du téléphone (developers.facebook.com/documentation/business-messaging/whatsapp/templates/components). Rien à recevoir de Meta : pas de webhook.
- Réponse rapide (écartée pour l'instant) : vraie confirmation en une touche, mais il faut une route webhook publique qui reçoit les messages de Meta, vérifie la signature (`X-Hub-Signature-256`, clé secrète de l'application Meta), retrouve la commande depuis le `payload` et répond ; une réponse ouvre aussi une conversation de service de 24 h. Plus de code, un secret Meta de plus, et un échec se voit mal (la boutique ne voit pas de page). À reconsidérer si les boutiques trouvent 2 touches de trop.
- L'adresse du site est **fixée dans le modèle** : il faut le domaine définitif (`NEXT_PUBLIC_SITE_URL`) avant de soumettre le modèle à Meta.

**Avec ou sans connexion ?** Choix retenu (proposé, à valider par le propriétaire à la relecture) : **sans connexion**, le lien suffit.
- Avec connexion : plus sûr si le message est transféré, mais les commerçants se connectent par lien e-mail et le navigateur ouvert par WhatsApp n'a souvent pas leur session : il faudrait se reconnecter (e-mail, puis retour) à chaque fois, et la « confirmation en un clic » disparaît.
- Sans connexion : le lien ne permet qu'**une** chose — passer **cette** commande de « demandée » à « confirmée » pour **sa** boutique — pendant 24 h, une seule fois. S'il fuit (message transféré, capture d'écran), le pire est une commande confirmée trop tôt : le stock baisse, la boutique peut encore l'annuler (« Plus en stock », « Autre ») dans son espace, et le client n'est pas prévenu par un message (la confirmation n'envoie rien). La page ne montre ni le numéro du client ni aucun lien d'action autre que « Confirmer ». Risque jugé acceptable pour le gain.

**Lien** (aucune nouvelle table) :
- `<commande>.<expiration>.<signature>` : identifiant de la commande, date d'expiration (secondes, base 36, envoi + 24 h), signature `HMAC-SHA256(CONFIRMATION_SECRET, "confirmer:" + commande + ":" + expiration)` en base64url (43 caractères). La commande appartient à une seule boutique : le lien ne vaut que pour elle. Calculé par le serveur **au moment de l'envoi** du message (`lireMessages` dans `lib/notifications/`, à partir du 5e paramètre du message, l'identifiant de la commande) : il n'est stocké nulle part. Vérification (`lireLienConfirmation`) : format, signature (comparaison à temps constant) **puis** expiration — une expiration modifiée donne « lien non valide ».
- Usage unique : la base n'accepte que `demandee → confirmee` ; une fois confirmée, le lien ne fait plus rien (« déjà confirmée »).
- Nouvelle variable serveur **`CONFIRMATION_SECRET`** (32 caractères aléatoires au moins), empreinte SHA-256 dans `prive.reglages`, clé `jeton_confirmation` (même principe que `CODES_TELEPHONE_SECRET` et `VISITEURS_SECRET`).

**Page et base** :
- `app/confirmer/[jeton]/page.tsx` (lecture seule, `noindex`, `Referrer-Policy: no-referrer` : vérifie la signature et l'expiration côté serveur, puis lit la commande par `commande_a_confirmer(jeton, commande)` — `jeton` = `CONFIRMATION_SECRET` — : numéro, boutique, prénom, lignes, total, note, statut ; jamais le téléphone) et `app/confirmer/actions.ts` (action serveur « Confirmer la commande » : revérifie le lien puis appelle `confirmer_commande_par_lien(jeton, commande)`). Une commande qui n'est plus « demandée » n'affiche pas de bouton, seulement son état.
- `confirmer_commande_par_lien` : `security definer`, secret obligatoire (appel direct avec la clé publique : `42501`), verrou de la commande, mêmes règles que `changer_statut_commande` pour `demandee → confirmee` (`prive.retirer_stock`, refus « Stock insuffisant pour … »), `confirmee_le`, ligne de suivi `auteur = 'boutique'`, `auteur_id` vide, note « Confirmée depuis WhatsApp ». Résultat : `confirmee`, `deja_confirmee` (confirmée, prête, récupérée), `annulee`, `expiree`. La partie commune avec `changer_statut_commande` est mise dans une fonction `prive.confirmer_commande(…)` pour que les deux boutons gardent toujours les mêmes règles.
- Interrupteur : réglage `bouton_confirmer` (`prive.reglages`, `on` après l'approbation de Meta). Quand il est `on`, la base crée le message `oranpromo_nouvelle_commande_confirmer` (les 4 paramètres du texte + un 5e, l'identifiant de la commande) au lieu de `oranpromo_nouvelle_commande` ; au moment de l'envoi, le serveur retire le 5e paramètre et en fait le lien signé du bouton ; sans `CONFIRMATION_SECRET`, il envoie l'ancien modèle sans bouton (aucun message perdu).
- Modèle à faire approuver (catégorie « Utilitaire », langue `fr`) : `oranpromo_nouvelle_commande_confirmer` : « Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Touchez Confirmer, ou confirmez-la dans votre espace OranPromo, rubrique Commandes. » + bouton lien « Confirmer » → `https://<domaine>/confirmer/{{1}}`.

## Carte des boutiques (US-24) — conception, **pas encore codé**

Stories : `docs/user-stories.md`, module 11. Maquettes : `Carte.dc.html`, `PositionBoutique.dc.html`. À coder après l'arabe (US-23) et après validation du propriétaire. Rien de ce qui suit n'existe encore.

**Lu avant de choisir** : `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` (Next.js 16) : `next/dynamic` avec `{ ssr: false }` n'est permis **que dans un composant client** (erreur dans un composant serveur) ; `01-app/01-getting-started/11-css.md` : une feuille de style d'un paquet (`leaflet/dist/leaflet.css`) peut être importée dans un composant de `app/`, mais elle n'est pas retirée quand on change de page (sans gêne ici : toutes ses classes commencent par `.leaflet-`).

### Fonds de carte : comparaison (conditions lues le 9 octobre 2026)

OranPromo est un **usage commercial** (site d'entreprise, même gratuit pour les clientes). Ordre de grandeur : une visite de `/carte` sur téléphone ≈ 30 à 50 tuiles (vue de départ, un ou deux zooms, « Autour de moi ») ; 1 million de tuiles ≈ 20 000 à 30 000 visites de la carte par mois.

| Fournisseur | Gratuit | Usage commercial gratuit ? | Au-delà | Attribution | Pour la carte (Leaflet) | Source |
| --- | --- | --- | --- | --- | --- | --- |
| **OSMF** `tile.openstreetmap.org` | sans quota annoncé, « best-effort », sans garantie | pas interdit, mais la politique dit qu'un usage lourd est bloqué sans préavis et que les **services commerciaux** doivent s'attendre à perdre l'accès à tout moment ; elle renvoie vers d'autres fournisseurs | — | « © OpenStreetMap contributors », visible sur la carte | tuiles PNG standard ; ni préchargement ni hors-ligne | operations.osmfoundation.org/policies/tiles/ |
| **CARTO** Positron (`light_all`) | 5 M tuiles/mois non commercial | **oui, jusqu'à 1 M de tuiles/mois** avec une clé gratuite (obligatoire depuis septembre 2026 ; sans clé, filigrane) | 500 $/mois (10 M) ; accès gratuit révocable à tout moment | « © OpenStreetMap contributors, © CARTO », visible | tuiles PNG, `@2x` pour écrans Retina (1 requête par tuile) ; style **gris clair** qui va avec le noir et blanc du site | carto.com/basemaps/apikey/, carto.com/legal/basemap-terms/ (version du 29/09/2026, sections 3, 9, 12, 13), github.com/CartoDB/basemap-styles |
| **Stadia Maps** (Alidade Smooth) | 200 000 crédits/mois | **non** (plan gratuit : « Commercial use not allowed ») | Starter 20 $/mois : 1 M crédits, puis 0,03 $ les 1 000 ; 1 tuile = 1 crédit | © Stadia Maps, © OpenMapTiles, © OpenStreetMap | tuiles PNG | stadiamaps.com/pricing/ |
| **MapTiler** | 100 000 requêtes/mois | **non** (plan Free : « testing, PoC, personal, or non-commercial use ») ; logo MapTiler sur la carte | Flex 30 $/mois : 500 000 requêtes, puis 0,15 $ les 1 000 | © MapTiler, © OpenStreetMap + logo | tuiles PNG | maptiler.com/cloud/pricing/ |
| OpenFreeMap | illimité, sans clé | oui | dons | « OpenFreeMap © OpenMapTiles Data from OpenStreetMap » | **tuiles vectorielles seulement** : il faut MapLibre GL (bien plus lourd que Leaflet, WebGL) — écarté | openfreemap.org |

**Recommandation : CARTO Positron**, tuiles raster avec **Leaflet** :
- seul fournisseur trouvé dont l'offre **gratuite autorise l'usage commercial** (jusqu'à 1 M de tuiles par mois), et dont le style gris clair va avec le site ;
- clé gratuite à demander par le propriétaire (carto.com/basemaps/apikey/, déclarer un **usage commercial**) ; elle est **publique** par nature (elle part dans l'adresse de chaque tuile) : la restreindre au domaine du site dans le tableau de bord CARTO et suivre la consommation ; variable `NEXT_PUBLIC_CARTO_CLE` ;
- URL : `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=<clé>` (sous-domaines `a`–`d`, `{r}` = `@2x` sur écran Retina), zoom 11 à 19 ;
- règles CARTO à respecter : attribution « © OpenStreetMap contributors, © CARTO » toujours visible (section 13) ; pas de mise en cache ni de relais des tuiles par notre serveur (9.c.iii) ; pas de téléchargement en masse (9.c.i) ; navigateur : cache ≤ 30 jours (comportement normal) ; l'accès gratuit peut être coupé sans préavis (3.c) ;
- **sans clé** (développement sur le PC, essais) : tuiles OSMF `https://tile.openstreetmap.org/{z}/{x}/{y}.png` avec « © OpenStreetMap contributors » ; usage interactif normal, permis par la politique OSMF ; **pas en production** ;
- plan B si on dépasse 1 M de tuiles par mois ou si CARTO coupe l'accès gratuit : **Stadia Maps Starter** (20 $/mois pour 1 M, puis 0,03 $ les 1 000), bien moins cher que CARTO payant (500 $/mois). Le fournisseur est choisi dans une seule fonction (`fondDeCarte()` dans `lib/carte.ts`, testée) : en changer = changer cette fonction et l'attribution, rien d'autre ;
- vie privée : le navigateur de la cliente demande les tuiles directement à CARTO (adresse IP tronquée, journaux gardés 30 jours aux États-Unis, section 10 des conditions) ; CARTO voit donc quelle zone de la carte est affichée, comme pour toute carte en ligne, mais **jamais les coordonnées** de la cliente. Après « Autour de moi », le recadrage ne dépasse pas le zoom 15 (une tuile ≈ 1 km de côté à Oran).

### Dépendance : `leaflet` 1.9.4 (justification, règle « ne rien inventer »)

- **Leaflet 1.9.4** (dernière version stable ; la 2.0 est en alpha), licence **BSD-2-Clause** (usage commercial libre), **aucune dépendance** ; `leaflet.js` 147 Ko, **≈ 42 Ko compressé** (gzip), `leaflet.css` ≈ 4 Ko compressé (mesuré sur le paquet npm). + `@types/leaflet` en dépendance de développement.
- Pourquoi : carte tactile (zoom à deux doigts, épingle déplaçable `draggable`, `fitBounds`) éprouvée sur téléphone ; écrire tout cela à la main serait plus long et moins fiable.
- **Pas de `react-leaflet`** (une dépendance de plus pour peu de chose) : un composant client crée la carte dans un `useEffect` et la détruit (`map.remove()`) en le quittant. Pas de `leaflet.markercluster` tant qu'il y a moins de 200 boutiques.
- Épingles en `L.divIcon` (carré noir, chiffre blanc des promos, angles droits, sans ombre) : pas d'image d'épingle par défaut de Leaflet (elle se casse avec les outils de build et ne suit pas le style).
- **Chargée seulement où elle sert** : `components/CarteBoutiques.tsx` (`"use client"`) importe `components/CarteLeaflet.tsx` avec `next/dynamic(…, { ssr: false })` ; `CarteLeaflet` importe `leaflet` et `leaflet/dist/leaflet.css`. Même chose pour le bloc de position (`components/ChoixPosition.tsx` → `CartePosition.tsx`). Rien de Leaflet côté serveur (Leaflet touche `window`). L'accueil et le catalogue n'importent rien de cela : un test vérifie qu'aucun fichier de `app/page.tsx`, `app/catalogue/` ni `components/EntetePublic.tsx` n'importe `leaflet`, et le rapport de `npm run build` est comparé avant / après.
- Le conteneur de la carte a `dir="ltr"` même quand la page est en arabe (la carte ne se retourne pas ; Leaflet gère mal un conteneur `rtl`) ; tout le reste de la page suit `dir`.

### Données

- **Pas de nouvelle colonne** : `boutiques.latitude` et `boutiques.longitude` existent déjà (`double precision`, schéma initial), sont déjà saisies (formulaire de création) et lues (vitrine). Les 2 boutiques actuelles ont une position dans les bornes (lecture du 9/10 : Akid Lotfi 35,7303 / −0,5784 ; Front de Mer 35,7034 / −0,6436).
- **Pas de PostGIS** (extension non installée sur le projet) : quelques centaines de boutiques au plus, distances calculées **dans le navigateur** (formule de haversine, `distanceMetres()` dans `lib/carte.ts`) ; une règle de bornes simple suffit. PostGIS ne servirait que pour une recherche par rayon côté serveur — justement ce qu'on ne veut pas (la position de la cliente n'y va jamais) — ou pour la vraie frontière de la wilaya (polygone), jugée inutile : l'admin valide chaque boutique.
- **Migration US-24.1** (nouveau fichier, jamais en modifiant les anciens) :
  - `boutiques_position_complete` : `check ((latitude is null) = (longitude is null))` ;
  - `boutiques_position_oran` : `check (latitude is null or (latitude between 35.33 and 35.92 and longitude between -1.15 and -0.10))` (`NaN` et l'infini ne sont pas « entre » : refusés) ;
  - `prive.proteger_coordonnees_boutique()` réécrite par `create or replace` : `latitude` et `longitude` rejoignent la liste réservée à l'admin quand `old.statut <> 'en_attente'` ; message « Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, la position ou les liens. » ; et message clair « La position doit être dans la wilaya d'Oran. » (`23514`) avant que la contrainte ne réponde par son nom technique ;
  - fonction `public.boutiques_carte(limite integer default 500)` : `language sql stable security invoker`, `set search_path = public`, `execute` pour `anon` et `authenticated`. Renvoie `id, slug, nom, quartier, latitude, longitude, promos_en_cours integer, rayons jsonb` (liste des couples `{categorie, genre}` distincts de ses articles visibles), pour les boutiques `statut = 'validee'` seulement, triées par nom, `limit least(greatest(limite, 1), 500)`. Articles comptés avec les **mêmes filtres explicites que `lib/catalogue.ts`** : statut `disponible` ou `reserve`, `derniere_confirmation > now() - 21 jours` (un admin connecté ne voit donc rien de plus que le public) ; promo en cours = `promos.date_fin >= now()`. Ni photo, ni WhatsApp, ni adresse, ni horaires. L'univers est calculé côté site à partir de `rayons` avec `articleDansUnivers()` (`lib/catalogue.ts`) : la liste des catégories beauté reste à un seul endroit (`lib/article.ts`).
- **Droits (RLS)** : inchangés. Le public lit déjà les boutiques validées, position comprise (politique « public voit les boutiques validées ») ; la fonction est `security invoker` et filtre en plus `statut = 'validee'`. Écriture de la position : politique existante « commerçant modifie sa boutique » (sa boutique, ou admin) + déclencheur ci-dessus ; l'ambassadeur ne modifie pas une boutique après sa création (politique existante) : il la place **à la création**, sur place.

### Page `/carte` (US-24.3)

- `app/carte/page.tsx` (composant serveur, `force-dynamic` comme les autres pages publiques) : `await searchParams` (`univers`), un seul appel `supabase.rpc("boutiques_carte")` avec `creerClientServeur()`, puis rend la **liste** (HTML serveur : utilisable sans JavaScript) et `<CarteBoutiques boutiques={…} />`. `metadata` : titre « Carte des boutiques ».
- `lib/carte.ts` (testé) : `distanceMetres(a, b)`, `trierParDistance()`, `formaterDistance(m, langue)` (« 850 m », « 2,4 km » ; « 850 م », « 2,4 كم »), `universBoutique(rayons)`, `avecPosition()` / `sansPosition()`, `fondDeCarte()` (URL et attribution), `BORNES_ORAN`, `dansOran(lat, lng)`, `lienItineraire()` (sorti de `app/b/[slug]/page.tsx`, réutilise `positionBoutique()` de `lib/vitrine.ts` ; la vitrine l'utilise aussi).
- `components/CarteBoutiques.tsx` (`"use client"`) : filtre univers (synchronisé avec l'adresse par `router.replace`, sans nouvel appel à la base), bouton « Autour de moi », mini-fiche, liste triée ; charge `CarteLeaflet` en `ssr: false`.
- **Autour de moi** : `navigator.geolocation.getCurrentPosition` **seulement au toucher**, `{ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }` (la précision du quartier suffit). La position reste dans l'état React du composant : **jamais** dans une action serveur, un `fetch`, l'adresse, un cookie, `localStorage` ni `enregistrerMesure`. Elle est oubliée en quittant la page. La géolocalisation n'existe qu'en contexte sécurisé (HTTPS, `localhost`, `127.0.0.1`).
- Liens : « Carte » dans `EntetePublic` ; bloc « Les boutiques sur la carte » sur l'accueil (texte et lien seulement, aucune carte, aucune image de tuile).

### Saisie de la position (US-24.2)

- `components/ChoixPosition.tsx` (`"use client"`) dans `NouvelleBoutique` (création), dans `/admin/boutiques` (« Position » sur chaque boutique) et dans `/espace` (boutique en attente seulement).
- « Je suis dans la boutique » : `getCurrentPosition` avec `{ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }` ; `coords.accuracy` affichée arrondie (« ± 12 m ») ; avertissement au-delà de 100 m.
- Lien Google Maps : `coordonneesDepuisTexte(texte)` dans `lib/position.ts` (testé, **sans aucun accès réseau**) : `!3d<lat>!4d<lng>` d'abord, puis `@<lat>,<lng>`, puis les paramètres `q`, `ll`, `query`, `destination`, puis deux nombres seuls ; hôtes reconnus : `google.<domaine>/maps`, `maps.google.<domaine>` ; liens courts (`maps.app.goo.gl`, `goo.gl/maps`) → message dédié, rien n'est suivi. Le serveur ne reçoit que deux nombres (jamais le lien), valide (`validerPosition()` dans `lib/boutique.ts` : bornes d'Oran, les deux ou aucune, arrondi à 6 décimales) et la base revérifie.
- Actions serveur : `modifierPositionBoutique(id, latitude, longitude)` dans `app/admin/boutiques/actions.ts` et `app/espace/actions.ts` (sa boutique seulement ; la base refuse une boutique publiée) ; erreurs de la base traduites en messages (`23514` → « La position doit être dans la wilaya d'Oran. », `42501` → « Pour déplacer votre boutique sur la carte, contactez OranPromo. »).

### Bornes de la wilaya d'Oran

| | Minimum | Maximum |
| --- | --- | --- |
| Latitude | **35,33** | **35,92** |
| Longitude | **−1,15** | **−0,10** |

- Source : limite administrative de la wilaya d'Oran dans **OpenStreetMap**, relation **1259187** (`admin_level` 4, Wikidata Q231331), rectangle englobant lu par Nominatim le 9 octobre 2026 : latitude 35,3335035 à 35,9093713, longitude −1,1396429 à −0,1136930 (données © contributeurs OpenStreetMap, ODbL) ; https://www.openstreetmap.org/relation/1259187. Le rectangle va jusqu'aux **îles Habibas** (ouest), rattachées à la wilaya.
- Arrondi vers l'extérieur (≈ 1 km de marge) pour ne jamais refuser une vraie boutique d'Oran.
- C'est un **rectangle**, pas la frontière exacte : il laisse passer quelques km² des wilayas voisines (Aïn Témouchent, Sidi Bel Abbès, Mascara, Mostaganem) et de la mer. Suffisant contre les erreurs (signe de la longitude oublié, coordonnées d'une autre ville, inversion latitude / longitude) ; l'admin valide chaque boutique.

### Variable d'environnement prévue

`NEXT_PUBLIC_CARTO_CLE` (navigateur) : clé CARTO Basemaps (publique, restreinte au domaine dans le tableau de bord CARTO) ; vide = tuiles OSMF (développement seulement).

## Limites par visiteur (vues, clics, partages, signalements)

Carte Trello « Sécurité · Limiter les envois en masse ». Migration `20261010180000_limites_visiteurs.sql`.

- **Avant** (PR #2) : insertion directe par tout visiteur avec la clé publique ; limites globales seulement (120 événements par minute et par boutique ; 10 signalements par heure et par article, 200 par heure au total). Elles restent en place.
- **Plus d'insertion directe** : politiques d'insertion supprimées, droit `INSERT` retiré à `anon` et `authenticated` sur `evenements` et `signalements`.
- **Chemin unique** : composant → action serveur (`enregistrerMesure`, `envoyerSignalement`) → `lib/visiteurs.ts` → fonctions `enregistrer_evenement(jeton, visiteur, type, boutique, article, taille)` et `signaler_article(jeton, visiteur, article, motif, commentaire)`. Le `jeton` est `VISITEURS_SECRET` (empreinte SHA-256 dans `prive.reglages`, clé `jeton_visiteurs`) : un appel direct à Supabase avec la clé publique est refusé (`42501`).
- **Clé du visiteur** :
  - compte connecté : `u:<identifiant>`, prise par la base dans la session (`auth.uid()`), jamais dans la requête ;
  - visiteur anonyme : `ip:<HMAC-SHA256(VISITEURS_SECRET, adresse IP)>`, calculée par le serveur ; l'IP vient de `x-real-ip` / `x-forwarded-for`, réécrits par Vercel (non falsifiables). L'IP n'est jamais enregistrée en clair, l'empreinte est gardée 24 h au plus, et elle ne peut pas être fabriquée sans le secret. Pas de cookie ni d'identifiant de suivi.
- **Limites** :
  - mesures : même visiteur, même type, même boutique / article / taille dans les 10 minutes → ignorée (rechargements) ; plus de 300 par heure et par visiteur → ignorées. Une mesure ignorée ou en erreur n'empêche jamais d'afficher la page ;
  - signalements : un seul par article et par visiteur en 24 h (« Vous avez déjà signalé cet article, merci. Il sera examiné rapidement. »), 5 par heure et par visiteur (« Trop de signalements envoyés : réessayez dans une heure. »).
- **Limite connue** : plusieurs clients derrière la même adresse IP (opérateur mobile) partagent la même clé anonyme : une vue d'un second client sur le même article dans les 10 minutes n'est pas comptée, et un second signalement du même article dans les 24 h est refusé. Un robot qui change sans cesse d'adresse IP n'est limité que par les plafonds globaux.
- Sans `VISITEURS_SECRET` (ou sans son empreinte en base) : les mesures sont ignorées et le signalement affiche « Le signalement n’est pas disponible pour le moment. Réessayez plus tard. ».

## Crédits des images

| Fichier (`public/images/accueil/`) | Origine | Auteur | Licence | Source |
| --- | --- | --- | --- | --- |
| `accueil-santa-cruz.webp` | photo réelle (fort de Santa Cruz sur le Murdjadjo, au-dessus du port d'Oran, 8 juillet 2017), **recadrée (5:6), redimensionnée, saturation +10 % et compressée en WebP** par OranPromo | Bachounda | **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:Santa_cruz_Oran.jpg |
| `univers-femme.webp`, `univers-homme.webp`, `univers-enfant.webp`, `univers-beaute.webp`, `cat-robes.webp`, `cat-abayas-djellabas-kamis.webp`, `cat-tshirts-polos.webp`, `cat-pantalons-jeans.webp`, `cat-chaussures.webp`, `cat-parfums.webp` | images **générées par IA pour OranPromo** (octobre 2026), recadrées en carré | OranPromo | propriété du projet, aucun droit de tiers | originaux 1280 × 720 hors dépôt (`visuels-oranpromo`) |

Règles :
- **CC BY-SA 4.0** : le crédit (auteur, licence avec lien, source avec lien) doit rester visible à côté de la photo (`CREDIT_GRANDE_PHOTO` dans `lib/accueil.ts`, affiché sur l'accueil). La photo modifiée (`accueil-santa-cruz.webp`) reste sous CC BY-SA 4.0 ; cela ne concerne pas le reste du site. Ne pas retirer le crédit, ne pas utiliser cette photo dans une publicité qui laisserait croire que l'auteur soutient OranPromo.
- Images IA : pas de crédit obligatoire ; ne pas les présenter comme des photos de vraies boutiques ou de vrais articles.
- Toute nouvelle image : licence libre autorisant l'usage commercial (CC0, CC BY, CC BY-SA, domaine public ; jamais NC ni ND), ajoutée à ce tableau.

## Variables d'environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navigateur et serveur | connexion à Supabase (clé publique) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODELE` | serveur | IA (US-14, US-15) |
| `NEXT_PUBLIC_SITE_URL` | serveur | adresse publique du site ; base des liens de boutique et des QR codes (US-22) : à régler sur le vrai domaine avant d'imprimer des affiches |
| `WHATSAPP_FOURNISSEUR` | serveur | `meta` (par défaut) ; prévu pour `twilio` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | serveur | WhatsApp Cloud API (Meta) ; vides = aucun envoi |
| `WHATSAPP_LANGUE` | serveur | langue des modèles Meta (`fr` par défaut) |
| `WHATSAPP_API_VERSION` | serveur | version de l'API Graph de Meta (`v23.0` par défaut) |
| `CRON_SECRET` | serveur | secret de la tâche d'envoi des messages en attente (empreinte `jeton_notifications`) |
| `VISITEURS_SECRET` | serveur | secret des mesures et signalements (limites par visiteur) ; sert aussi à l'empreinte HMAC des adresses IP ; empreinte SHA-256 dans `prive.reglages`, clé `jeton_visiteurs` ; vide = mesures ignorées, signalements refusés |
| `CONFIRMATION_SECRET` | serveur | signature des liens « Confirmer » des messages WhatsApp (US-20.6) ; empreinte SHA-256 dans `prive.reglages`, clé `jeton_confirmation` ; vide = messages sans bouton, page du lien « pas disponible » |
| `CODES_TELEPHONE_SECRET` | serveur | jeton serveur des limites d'envoi des codes (US-21, relecture n°4), distinct de `CRON_SECRET` ; empreinte SHA-256 dans `prive.reglages`, clé `jeton_codes_telephone` ; vide = aucun code envoyé |
| `CONNEXION_CLIENT` | serveur | `email` (par défaut) ou `telephone` : connexion des clients (US-21) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | navigateur | clé de site (publique) Cloudflare Turnstile ; vide = pas de widget (la clé secrète va seulement dans Supabase) |

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

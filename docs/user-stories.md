# User stories — MVP OranPromo

Source : document « OranPromo — Cadrage du projet », onglet Spécifications détaillées.
Une story = une tâche pour un agent. Chaque critère d'acceptation doit être vérifié avant de dire « terminé ».

**Définition de « terminé »** (toutes les stories) :
- tous les critères d'acceptation sont vérifiés ;
- l'écran fonctionne sur un téléphone (largeur 375 px) ;
- `npm run build` et `npm test` passent ;
- le code est commité avec un message qui cite la story : `US-07 Réserver un article sur WhatsApp`.

---

## Module 1 — Vitrine et fiche article

### US-01 — Voir la vitrine d'une boutique (page `/b/[slug]`)
En tant que client, je veux voir la page d'une boutique, afin de savoir où elle est et ce qu'elle vend.
- Étant donné une boutique validée, quand j'ouvre son lien, alors je vois son nom, son quartier, son adresse, ses horaires et un bouton WhatsApp.
- La page affiche une carte avec un lien « Itinéraire » qui ouvre l'application de cartes du téléphone.
- La page liste les articles disponibles de la boutique, promos en premier.
- Les articles vendus ou masqués n'apparaissent pas.
- Une boutique non validée ou suspendue affiche « Boutique indisponible ».

### US-02 — Voir la fiche d'un article (page `/a/[id]`)
En tant que client, je veux voir le détail d'un article, afin de décider si je le réserve.
- La fiche affiche les photos (1 à 5, défilables), le titre, la description, le prix et les tailles disponibles.
- Étant donné un article en promo, alors le prix initial est barré, le prix promo est mis en avant et la date de fin est affichée.
- La fiche affiche le nom et le quartier de la boutique, avec un lien vers sa vitrine.
- Étant donné un article vendu, quand j'ouvre son lien, alors je vois « Article plus disponible » et d'autres articles de la boutique.

### US-03 — Partager un lien avec aperçu
En tant que commerçant ou client, je veux partager un article ou une boutique, afin que mes contacts voient tout de suite de quoi il s'agit.
- Chaque fiche et chaque vitrine a une adresse courte et stable (`/a/<id>`, `/b/<slug>`).
- Étant donné un lien collé dans WhatsApp ou Facebook, alors l'aperçu montre la photo principale, le titre et le prix (ou le nom de la boutique). → `generateMetadata` de Next.js (balises Open Graph).
- Un bouton « Partager » ouvre le menu de partage du téléphone (`navigator.share`, avec copie du lien en secours).

## Module 2 — Catalogue et promos

### US-04 — Voir les promos du moment (page `/`)
En tant que client, je veux voir sur la page d'accueil les promos en cours à Oran, afin de repérer vite les bonnes affaires.
- La page d'accueil affiche les articles en promo active, les plus récentes d'abord.
- Chaque carte affiche photo, titre, prix barré, prix promo, badge de réduction et quartier de la boutique.
- Étant donné une promo dont la date de fin est passée, alors elle n'apparaît plus et l'article revient à son prix normal.
- Les articles s'affichent par pages de 20, avec chargement de la suite au défilement.
- En haut : les univers Femme · Homme · Enfant · Beauté, chacun vers le catalogue filtré (`/catalogue?univers=…`).
- Une grande photo d'accueil avec la phrase « Les promos d'Oran » et un bouton « Voir les promos » (`/catalogue?promo=1`) ; sans article, un bloc noir uni.
- Des tuiles carrées (image + mot) pour les univers et les pièces phares ; image = miniature du dernier article visible, sinon tuile noire unie avec le mot. Aucune image externe (maquette `docs/maquettes/Accueil.dc.html`).

### US-05 — Filtrer le catalogue (page `/catalogue`)
En tant que client, je veux filtrer les articles de toutes les boutiques, afin de trouver ce qui me correspond.
- Filtres : univers (Femme, Homme, Enfant, Beauté), catégorie (groupée Mode / Beauté), taille ou contenance, genre (homme, femme, enfant, mixte), fourchette de prix, quartier, « en promo seulement ».
- Univers : Femme et Homme = articles de mode de ce genre ou mixtes ; Enfant = mode enfant ; Beauté = les 5 catégories beauté (`/catalogue?univers=beaute`).
- Étant donné plusieurs filtres choisis, alors seuls les articles qui les respectent tous s'affichent.
- Le nombre de résultats est affiché ; aucun résultat affiche un message et un bouton « Effacer les filtres ».
- Les filtres sont gardés dans l'adresse de la page (paramètres d'URL), pour qu'une recherche puisse être partagée.

### US-06 — Rechercher par mot-clé
En tant que client, je veux taper un mot (« polo », « jean »), afin de trouver un article précis.
- La recherche porte sur le titre, la description et la catégorie.
- Elle ignore les majuscules et les accents.
- Elle se combine avec les filtres de US-05.

## Module 3 — Réservation WhatsApp

### US-07 — Réserver un article sur WhatsApp
> Remplacée par la commande enregistrée (US-20.2) : le bouton de la fiche devient « Ajouter au panier ». Le lien WhatsApp vers la boutique reste disponible pour poser une question.

En tant que client, je veux réserver un article en un clic, afin que la boutique le mette de côté pour moi.
- La fiche demande de choisir une taille avant d'activer le bouton « Réserver sur WhatsApp » (sauf article en taille unique).
- Étant donné une taille choisie, quand je clique, alors WhatsApp s'ouvre vers le numéro de la boutique avec un message pré-rempli. → utiliser `lienReservation()` de `lib/whatsapp.ts`.
- Le message contient le titre, la taille, le prix affiché, le lien de la fiche et la mention « vu sur OranPromo », par exemple : « Bonjour, je souhaite réserver : Polo bleu marine, taille M, 3 500 DA. https://oranpromo.com/a/1234 (vu sur OranPromo) ».
- Le lien fonctionne sur téléphone (application WhatsApp) et sur ordinateur (WhatsApp Web).
- Sous le bouton, un texte rappelle : « La boutique confirme la disponibilité sur WhatsApp. Paiement en boutique. »

### US-08 — Compter les demandes de réservation
En tant que commerçant, je veux savoir combien de clients ont cliqué sur « Réserver », afin de mesurer ce qu'OranPromo m'apporte.
- Chaque clic sur le bouton est enregistré (table `evenements`, type `clic_reserver`) avec l'article, la taille et la date, sans donnée personnelle du client.
- Ces clics alimentent les statistiques de US-13.

Le site ne voit pas la conversation WhatsApp : la confirmation, la mise de côté et la vente se passent entre le client et la boutique.

## Module 4 — Espace commerçant

### US-09 — Se connecter (page `/espace/connexion`)
En tant que commerçant, je veux me connecter sans mot de passe, afin de n'avoir rien à retenir.

> **Provisoire (MVP) : connexion par lien envoyé par e-mail.** La connexion par SMS demande un fournisseur SMS payant (Twilio…) ; elle sera branchée avant la mise en ligne. Le code doit isoler l'envoi dans une fonction pour pouvoir passer au SMS sans tout réécrire.

- Je saisis mon adresse e-mail ; un e-mail invalide affiche un message en français sous le champ.
- Étant donné une adresse valide, quand je valide, alors je vois « Un lien de connexion vous a été envoyé par e-mail » et je reçois un lien. → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <origine>/auth/callback?suite=/espace } })`.
- Le lien ouvre `/auth/callback`, qui échange le code contre une session (`exchangeCodeForSession`) puis redirige vers `/espace`. Un lien expiré ou déjà utilisé renvoie vers `/espace/connexion` avec un message en français.
- Toute page sous `/espace` (sauf `/espace/connexion`) redirige vers `/espace/connexion` si je ne suis pas connecté.
- Je reste connecté sur le même appareil (session rafraîchie automatiquement par le proxy/middleware Next.js).
- Un bouton « Se déconnecter » ferme la session.

### US-10 — Ajouter un article (page `/espace/articles/nouveau`)
En tant que commerçant, je veux ajouter un article depuis mon téléphone, afin de le rendre visible en ligne.
- Je peux prendre une photo avec l'appareil ou en choisir dans ma galerie (1 à 5 photos).
- Champs obligatoires : au moins une photo, titre, catégorie, genre (sauf beauté : facultatif, enregistré « mixte »), prix en DA, au moins une taille (beauté : une contenance en ml, ou « Unique »).
- Catégories (liste fixe, `lib/article.ts`, vérifiée aussi par la base) :
  - Mode (Femme / Homme / Enfant) : T-shirts et polos, Chemises, Pulls et sweats, Vestes et manteaux, Pantalons et jeans, Survêtements et ensembles, Robes, Jupes, Abayas, djellabas, kamis, Tenues traditionnelles, Hijabs et foulards, Chaussures, Sacs, Accessoires.
  - Beauté : Parfums, Maquillage, Soins visage et corps, Cheveux, Hammam et traditionnel.
- Étant donné un champ obligatoire vide, quand je valide, alors un message en français s'affiche sous ce champ.
- Étant donné un formulaire complet, quand je valide, alors l'article est en ligne et je vois son lien à partager.
- Les photos sont compressées avant envoi. Chemin de stockage imposé : `photos/<boutique_id>/<article_id>/<fichier>`.

### US-11 — Gérer mes articles (page `/espace`)
En tant que commerçant, je veux voir et mettre à jour mes articles, afin que ma vitrine reste juste.
- Je vois la liste de mes articles avec leur statut : disponible, réservé, vendu, masqué.
- Je change le statut en un geste depuis la liste.
- Je peux modifier ou supprimer un article ; une suppression demande confirmation.
- Je peux retirer une taille vendue sans retirer l'article.
- Toute modification remet `derniere_confirmation` à maintenant.

### US-12 — Créer une promo
En tant que commerçant, je veux mettre un article en promo, afin d'attirer des clients.
- Je saisis le prix promo ou un pourcentage ; l'autre valeur est calculée.
- Le prix promo doit être inférieur au prix normal, sinon un message s'affiche.
- Je choisis une date de fin (obligatoire) ; la promo s'arrête automatiquement après cette date.
- Je peux choisir un badge : « −X % » (par défaut) ou « Promo flash ».

### US-13 — Voir mes statistiques (page `/espace/statistiques`)
En tant que commerçant, je veux voir combien de personnes ont vu mes articles et cliqué sur « Réserver », afin de juger ce que m'apporte OranPromo.
- Je vois, sur 7 jours et 30 jours : vues de la vitrine, vues des articles, clics « Réserver ».
- Je vois mes 5 articles les plus consultés.
- Les chiffres s'affichent en gros, lisibles sur téléphone, sans graphique complexe.

## Module 5 — Fiche produit par l'IA

### US-14 — Pré-remplir une fiche à partir d'une photo (route `POST /api/ia/fiche`)
En tant que commerçant ou ambassadeur, je veux que l'IA remplisse la fiche à partir de la photo, afin de créer un article en quelques secondes.
- Étant donné une première photo ajoutée (US-10), alors l'IA propose en moins de 10 secondes : titre, description courte, catégorie, genre, couleur principale.
- Les champs proposés sont pré-remplis et modifiables ; un repère indique « proposé par l'IA » (`propose_par_ia = true`).
- Le prix, les tailles et les contenances ne sont jamais proposés par l'IA : le commerçant les saisit.
- L'IA choisit la catégorie dans la liste officielle (mode et beauté).
- La description ne mentionne ni marque ni authenticité, même si un logo est visible.
- Étant donné une photo qui ne montre ni un article de mode (vêtement, chaussure, sac, accessoire) ni un produit de beauté, ou floue, alors l'IA ne remplit rien et un message demande une autre photo.
- Étant donné l'IA indisponible, alors le formulaire reste utilisable à la main.
- Rien n'est publié sans validation du commerçant.

### US-15 — Description en arabe (route `POST /api/ia/traduire`)
En tant que commerçant, je veux une version en arabe de la description, afin de toucher tous les clients.
- Un bouton « Générer en arabe » traduit le titre et la description français.
- Le texte arabe s'affiche de droite à gauche (`dir="rtl"`) et reste modifiable.
- Cette story peut glisser en V2.

## Module 6 — Administration

### US-16 — Créer et valider une boutique (page `/admin/boutiques`)
En tant qu'administrateur ou ambassadeur, je veux créer une boutique pour un commerçant, afin de l'installer sur place.
- Je saisis : nom, quartier, adresse, position sur la carte, horaires, numéro WhatsApp, liens réseaux.
- Le commerçant se connecte avec son e-mail (US-09) ; un administrateur rattache ensuite son compte à la boutique (`profils.boutique_id`).
- Une boutique créée par un ambassadeur reste « en attente » jusqu'à validation par un administrateur.
- Seules les boutiques validées sont visibles des clients.

### US-17 — Signaler un article
En tant que client, je veux signaler un article (contrefaçon, contenu inapproprié, arnaque), afin de garder le site sûr.
- Un lien « Signaler » sur chaque fiche ouvre un choix de motif et un commentaire facultatif.
- Le signalement arrive dans la file de modération ; le client voit « Merci, nous allons vérifier ».

### US-18 — Modérer (page `/admin/moderation`)
En tant qu'administrateur, je veux traiter les signalements, afin d'appliquer les règles de la plateforme.
- Je vois la liste des signalements avec l'article, le motif et le nombre de signalements.
- Je peux masquer l'article, avertir la boutique, suspendre la boutique ou classer le signalement.
- Chaque décision est enregistrée avec la date et son auteur (table `decisions`).

### US-19 — Suivre l'activité (page `/admin`)
En tant qu'administrateur, je veux un tableau de bord simple, afin de suivre le lancement.
- Je vois : boutiques actives, articles en ligne, promos en cours, clics « Réserver » sur 7 et 30 jours.
- Je vois les boutiques sans mise à jour depuis 3 semaines, pour les relancer.

## Module 7 — Commandes avec statut et suivi (après le MVP)

Source : carte Trello « Commandes · Objet commande avec statut et suivi client » (décisions du propriétaire du 9 octobre 2026). Tables, colonnes et règles : `docs/architecture.md`, section « Commandes ».

### US-20 — Commander et suivre sa commande (vue d'ensemble)
En tant que client, je veux commander plusieurs articles d'une boutique et suivre ma commande, afin de savoir quand elle est prête et de venir la chercher.
La réservation par simple message WhatsApp (US-07) est remplacée par une vraie commande enregistrée, découpée en 5 sous-stories livrées dans cet ordre :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-20.1 | Stock par article et par taille | `/espace` (Mes articles) |
| US-20.2 | Compte client, panier, commande, « Mes commandes » avec la frise | `/a/[id]`, `/panier`, `/compte`, `/compte/commandes`, `/compte/commandes/[id]` |
| US-20.3 | Commandes reçues par la boutique et changements de statut | `/espace/commandes` |
| US-20.4 | Expiration après 24 h, « Client pas venu » déclaré par la boutique, no-shows et blocage | `/espace/commandes`, `/admin/clients` |
| US-20.5 | Messages WhatsApp automatiques (API WhatsApp Business) | aucun écran |

**Statuts d'une commande** (règles dans la base) :

| Statut | Signification | Qui le donne | Depuis |
| --- | --- | --- | --- |
| `demandee` | le client a envoyé la commande | client | — |
| `confirmee` | la boutique a les articles : **le stock baisse** | boutique | `demandee` |
| `prete` | préparée : le client a **24 h** pour venir | boutique | `confirmee` |
| `recuperee` | venu et payé en boutique (fin) | boutique | `prete` |
| `annulee` | annulée avec un motif (fin) ; le stock revient si elle était confirmée ou prête | client (`demandee`, `confirmee`) ou boutique (`demandee`, `confirmee`, `prete`) | |
| `expiree` | pas venu sous 24 h (fin) ; le stock revient ; **pas de no-show automatique** : la boutique peut ensuite signaler « Client pas venu » | automatique | `prete` |

Chaque changement de statut est enregistré (statut, date, auteur, note) et affiché au client comme une frise.

### US-20.1 — Gérer le stock par taille (page `/espace`)
En tant que commerçant, je veux indiquer combien il me reste de pièces par taille, afin que les clients ne commandent que ce que j'ai.
- Chaque taille d'un article a une quantité (0 à 999). Un nouvel article a 1 pièce par taille choisie.
- Dans « Mes articles », chaque taille affiche sa quantité avec des boutons « − » et « + » (zones de 44 px) ; un appui enregistre tout de suite.
- Une taille à 0 est « épuisée » : barrée sur la fiche, non commandable, absente du filtre de taille du catalogue.
- Quand toutes les tailles d'un article tombent à 0, l'article passe automatiquement « Vendu » (il sort des listes, sa fiche affiche « Article plus disponible ») ; quand une taille repasse au-dessus de 0, il redevient « Disponible ». Règle dans la base.
- Retirer une taille dans la modification de l'article la met à 0 ; la rajouter lui redonne au moins 1 pièce.
- Le stock reste indicatif (la boutique vend aussi en direct) : la boutique vérifie à la confirmation (US-20.3).
- Maquette : `docs/maquettes/MesArticles.dc.html`.

### US-20.2 — Commander en tant que client (pages `/a/[id]`, `/panier`, `/compte`)
En tant que client, je veux mettre des articles d'une même boutique dans un panier et les commander, afin que la boutique me les prépare.
- Sur la fiche, je choisis une taille (sauf taille unique) et une quantité (1 à 10, au plus le stock), puis « Ajouter au panier ». Le clic est compté comme un `clic_reserver` (statistiques US-08 / US-13 inchangées).
- Le panier (`/panier`, gardé dans le téléphone) ne contient que des articles d'**une seule boutique** ; ajouter un article d'une autre boutique demande de remplacer le panier.
- Dans le panier, je modifie les quantités, retire une ligne, ajoute une note pour la boutique (300 caractères au plus) et vois le total en DA (prix promo actif compris).
- « Commander » demande d'être connecté : connexion par lien e-mail (`/compte/connexion`, en attendant le SMS), puis retour au panier. Un nouveau compte a le rôle `client`.
- À la première commande, je saisis mon nom et mon numéro de téléphone (format algérien, WhatsApp), gardés dans mon profil (`/compte`). Le nom : lettres (latines avec accents, ou arabes), espaces, apostrophe, tiret, 2 à 60 caractères ; ni chiffres ni lien (il est repris dans les messages WhatsApp).
- La base recalcule les prix et refuse : un article non visible, une taille épuisée, une quantité au-delà du stock, plus de 10 lignes, un client bloqué, plus de 5 commandes en cours ou plus de 10 commandes par heure. Le message d'erreur est en français.
- Après la commande, le panier est vidé et j'arrive sur le suivi de ma commande.
- « Mes commandes » (`/compte/commandes`) liste mes commandes, les plus récentes d'abord, avec boutique, date, total et statut.
- Le suivi (`/compte/commandes/[id]`) affiche les lignes, le total, la boutique (adresse, lien WhatsApp), la **frise** des statuts (date, heure, note) et, quand elle est prête, l'heure limite de retrait.
- Je peux annuler ma commande tant qu'elle est `demandee` ou `confirmee`.
- Je ne vois que mes commandes (règle dans la base).
- Un lien discret « Une question ? Écrire à la boutique » sur la fiche ouvre WhatsApp sans passer commande.
- Maquettes : `Fiche.dc.html`, `Panier.dc.html`, `MesCommandes.dc.html`, `SuiviCommande.dc.html`.

### US-20.3 — Traiter les commandes reçues (page `/espace/commandes`)
En tant que commerçant, je veux voir les commandes de ma boutique et changer leur statut, afin que le client sache où en est sa commande.
- Je vois les commandes « En cours » (demandée, confirmée, prête) puis « Terminées », avec numéro, date, nom et téléphone du client (lien WhatsApp), lignes (titre, taille, quantité, prix) et total.
- Boutons selon le statut : `demandee` → « Confirmer » ou « Annuler » ; `confirmee` → « Prête » ou « Annuler » ; `prete` → « Récupérée » ou « Annuler ».
- Annuler demande un motif : « Plus en stock », « Boutique indisponible » ou « Autre » ; une note facultative est montrée au client.
- Confirmer baisse le stock de chaque ligne. Si une ligne dépasse le stock (vente en direct), la confirmation est refusée avec « Stock insuffisant pour « article » en taille … » et un lien vers « Mes articles » : la boutique corrige son stock ou annule avec le motif « Plus en stock ». Annuler une commande confirmée ou prête remet le stock.
- Sur une commande expirée (ou prête depuis plus de 24 h), le bouton « Client pas venu » (avec confirmation) compte un no-show au client, une seule fois par commande (US-20.4).
- Après une annulation « Plus en stock », un lien mène à « Mes articles » pour corriger les quantités.
- La base refuse toute transition non prévue, et toute commande d'une autre boutique (règle dans la base).
- La navigation de l'espace affiche « Commandes » avec le nombre de commandes à confirmer.
- Maquette : `CommandesRecues.dc.html`.

### US-20.4 — Expiration, no-shows et blocage (page `/admin/clients`)
En tant que propriétaire de la plateforme, je veux repérer les clients qui ne viennent pas chercher leurs commandes, afin de protéger les boutiques.
- Une commande `prete` depuis 24 h passe automatiquement `expiree` (tâche planifiée toutes les 15 minutes dans la base, `pg_cron`) ; le stock revient ; le client reçoit un simple rappel. **Aucun no-show n'est compté automatiquement** (décision du propriétaire : une boutique pourrait sinon marquer « prête » trop tôt et faire compter un no-show au client).
- La boutique signale « Client pas venu » sur une commande expirée, ou prête depuis plus de 24 h (`/espace/commandes`) : c'est ce qui compte 1 no-show, une seule fois par commande, et seulement par la boutique de la commande. Le client est averti (WhatsApp, US-20.5, et sur `/compte`) du nombre d'essais restants.
- Les no-shows suivent le compte **et** le numéro de téléphone : un nouveau compte avec le même numéro les reprend, et un compte bloqué ne peut pas changer de numéro.
- Au 5e no-show, le compte est bloqué automatiquement : il ne peut plus commander, et `/compte` l'explique.
- `/admin/clients` (admin seulement) liste les clients bloqués puis ceux qui ont des no-shows (nom, téléphone, no-shows, date de blocage), avec les commandes signalées ; « Annuler » sur un no-show baisse le compteur (et débloque sous 5) ; « Débloquer » remet le compteur à 0.
- Maquette : `ClientsBloques.dc.html`.

### US-20.5 — Messages WhatsApp automatiques
En tant que boutique et client, je veux être prévenu sur WhatsApp, afin de ne pas rater une commande.
- Messages : nouvelle commande → boutique ; commande prête → client (avec l'heure limite) ; commande expirée → client (rappel ferme mais poli) ; client pas venu, signalé par la boutique → client (avertissement + essais restants) ; compte bloqué → client.
- Chaque message est d'abord enregistré dans la base (`messages_whatsapp`, statut `a_envoyer`), créé par la base au changement de statut, puis envoyé côté serveur par l'API WhatsApp Business (Meta Cloud API) avec des modèles de message approuvés par Meta.
- Sans configuration (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` vides), rien n'est envoyé : les messages restent `a_envoyer`.
- Un envoi raté est retenté (5 essais au plus), puis marqué `echec`. Une panne WhatsApp ne bloque jamais une commande.
- Le fournisseur est isolé (`lib/notifications/`) pour pouvoir passer à Twilio sans toucher au reste.

## Module 8 — Numéro de téléphone vérifié (après le MVP)

Source : carte Trello « V2 · Connexion par SMS » (remplacée par cette story, décisions du propriétaire du 9 octobre 2026). Conception : `docs/architecture.md`, section « Connexion des clients par téléphone (US-21) ».

### US-21 — Vérifier le numéro de téléphone du client (vue d'ensemble)
En tant que propriétaire de la plateforme, je veux que chaque client prouve que son numéro de téléphone est bien le sien, afin que les boutiques le joignent à coup sûr et que les no-shows suivent vraiment la personne.
Livrée en 4 sous-stories, dans cet ordre :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-21.1 | Base : numéro vérifié, règles anti-abus, commande refusée sans numéro vérifié (mode téléphone) | aucun écran |
| US-21.2 | Connexion du client par numéro et code à 6 chiffres (WhatsApp, puis SMS en secours) ; vérification du numéro d'un compte existant | `/compte/connexion`, `/compte`, `/panier` |
| US-21.3 | Blocage par numéro vérifié ; un numéro vérifié = un seul compte ; fin de la section « numéro partagé » | `/admin/clients` |
| US-21.4 | Mise en service : liste de ce que le propriétaire configure (Twilio, Supabase, Cloudflare, Vercel, Meta) | aucun écran |

**Deux modes**, choisis par la variable serveur `CONNEXION_CLIENT` :
- `email` (par défaut, tant que Twilio n'est pas configuré) : tout reste comme aujourd'hui pour le client (lien e-mail, numéro saisi à la main, pas de vérification forcée, pas de blocage par numéro sauf numéro déjà vérifié) ;
- `telephone` : le client se connecte par son numéro et ne commande qu'avec un numéro vérifié.
Les commerçants et l'admin se connectent toujours par lien e-mail (`/espace/connexion`), dans les deux modes.

### US-21.1 — Numéro vérifié dans la base (aucun écran)
En tant que propriétaire, je veux que la base sache quel numéro est vérifié et l'impose, afin que la règle ne dépende pas de l'écran.
- Un numéro client valide est **algérien mobile uniquement** : `+213` puis `5`, `6` ou `7`, puis 8 chiffres. Tout autre numéro est refusé par la base (création de compte ou changement de numéro par code refusés), par le serveur et par l'écran.
- Quand Supabase confirme un numéro par code, la base le recopie dans `profils.telephone` et date la vérification (`profils.telephone_verifie_le`). Personne ne peut écrire cette date à la main.
- Un numéro vérifié ne se modifie plus à la main (règle dans la base) : changer de numéro = vérifier le nouveau par code.
- En mode téléphone (réglage de la base `connexion_client` = `telephone`), la base refuse la commande d'un compte sans numéro vérifié avec un message en français ; en mode e-mail, rien ne change.
- Chaque commande garde si le numéro était vérifié au moment de la commande (`commandes.telephone_verifie`).
- Envoi des codes limité côté serveur : **1 code par minute et 5 par heure pour un même numéro** (table privée, vérifiée avant l'envoi). Au-delà, message clair : « Attendez une minute avant de demander un nouveau code. » / « Trop de codes demandés pour ce numéro : réessayez dans une heure. »
- Tests SQL : format, recopie après confirmation, numéro non modifiable, commande refusée en mode téléphone, limites d'envoi.

### US-21.2 — Se connecter avec son numéro (pages `/compte/connexion`, `/compte`, `/panier`)
En tant que client, je veux me connecter avec mon numéro et un code reçu sur WhatsApp, afin de ne pas avoir besoin d'e-mail.
- En mode téléphone, `/compte/connexion` demande le numéro. J'accepte `0555 12 34 56`, `0555123456`, `+213 555 12 34 56`, `00213…`, `0213…` (espaces, points, tirets ignorés) ; un numéro non algérien ou fixe est refusé tout de suite (« Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres. »).
- Avant l'envoi, je passe le contrôle anti-robot Cloudflare Turnstile ; sans contrôle réussi, le bouton d'envoi reste désactivé.
- « Recevoir le code sur WhatsApp » envoie un code à 6 chiffres sur WhatsApp ; « Recevoir par SMS » l'envoie par SMS (secours).
- Je saisis le code (6 chiffres) : s'il est bon, je suis connecté et je reviens au panier ou à mon compte ; sinon « Code incorrect ou expiré. ». Je peux redemander un code (limites ci-dessus).
- Un lien « Se connecter avec un e-mail » reste disponible (comptes déjà créés par e-mail, commerçants).
- Un nouveau compte créé par numéro a le rôle `client` et son numéro déjà vérifié ; il ne saisit que son nom avant la première commande.
- Compte existant (créé par e-mail) en mode téléphone : `/compte` et `/panier` affichent « Vérifiez votre numéro pour commander » avec le même parcours (numéro, WhatsApp ou SMS, code). Tant que le numéro n'est pas vérifié, « Commander » est remplacé par ce parcours, et la base refuse la commande de toute façon.
- Un numéro déjà vérifié s'affiche sans champ modifiable, avec « Changer de numéro » qui relance la vérification du nouveau numéro.
- Un numéro déjà utilisé par un autre compte est refusé : « Ce numéro est déjà utilisé par un autre compte : connectez-vous avec ce numéro. »
- En mode e-mail : écrans inchangés.
- Tests Vitest : normalisation du numéro, messages d'erreur, actions serveur (limites, captcha, canal, code), composants.

### US-21.3 — Bloquer par numéro vérifié (page `/admin/clients`)
En tant que propriétaire, je veux qu'un client bloqué ne puisse pas recommencer avec un autre compte sur le même numéro, afin de protéger les boutiques.
- Le blocage par numéro est activé, mais **seulement sur les numéros vérifiés** : un no-show compte pour le numéro seulement si la commande a été passée avec ce numéro vérifié, et seulement pour le compte qui a vérifié ce numéro. Un numéro saisi à la main ne fait jamais bloquer personne d'autre.
- Un numéro vérifié n'appartient qu'à un seul compte (index unique dans la base) ; les anciens numéros saisis à la main, même en double, restent possibles tant qu'ils ne sont pas vérifiés.
- La section « Numéro partagé par plusieurs comptes » disparaît de `/admin/clients` (plus utile : un numéro vérifié = un compte). Le blocage et le déblocage manuels par l'admin et le traitement des contestations restent.
- Débloquer un client annule aussi les no-shows passés avec son numéro vérifié.
- Tests SQL et Vitest.

### US-21.4 — Mise en service (aucun écran)
En tant que propriétaire, je veux une liste claire de ce que je dois configurer, afin d'activer la connexion par téléphone sans aide.
- `docs/ETAT.md` liste les étapes : Twilio (compte, service Verify, expéditeur WhatsApp approuvé par Meta, SMS), Supabase (fournisseur Phone = Twilio Verify, protection anti-robot Turnstile), Cloudflare Turnstile (site et clé secrète), Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `CONNEXION_CLIENT`), réglage de la base, et les coûts connus avec leur source.
- **Aucune clé** Twilio, Turnstile (secrète) ou Supabase (service) dans le code, `.env.example` ou un commit : elles se saisissent dans le tableau de bord Supabase.

## Module 9 — Faire connaître sa boutique (après le MVP)

Source : carte Trello « Parcours · Connexion par code WhatsApp, arabe/darja, lien boutique » (partie « lien boutique » ; la connexion par code est la US-21). Conception : `docs/architecture.md`, section « Lien de boutique à partager (US-22) ».

### US-22 — Partager le lien de ma boutique (pages `/espace`, `/espace/affiche`, `/b/[slug]`)
En tant que commerçant, je veux un lien court et lisible vers ma vitrine, à mettre dans la bio Instagram, TikTok ou Facebook, à envoyer sur WhatsApp et à afficher en boutique avec un QR code, afin que mes clientes trouvent mes articles en un clic.
- Chaque boutique a une adresse courte, lisible et stable : `https://<site>/b/<slug>`, avec un slug tiré du nom (`Boutique Nour` → `boutique-nour`). Format imposé par la base : minuscules sans accents, chiffres, tirets simples entre les mots (ni au début, ni à la fin, ni doublés), 2 à 60 caractères ; unique. Un nom déjà pris donne `-2`, `-3`… ; un nom sans lettre latine (arabe seul) donne `boutique`, `boutique-2`…
- Le slug ne change plus une fois la boutique publiée (seul un admin peut le changer : règle existante) : le lien imprimé ou mis en bio reste valable.
- Seule une boutique **validée** est joignable par son lien ; en attente ou suspendue → « Boutique indisponible », sans aperçu, non indexée.
- Le lien collé dans WhatsApp, Facebook, Instagram ou X affiche un aperçu : nom de la boutique, quartier et nombre d'articles disponibles, et une image (grande photo du dernier article disponible ; sans article, une image générée en noir et blanc avec le nom de la boutique et « OranPromo »). Balises Open Graph et Twitter (`summary_large_image`), adresse canonique.
- Dans `/espace`, un bloc « Partager ma boutique » montre le lien et propose : « Copier le lien » (message « Lien copié »), « Partager sur WhatsApp » (`https://wa.me/?text=…` avec un message pré-rempli et le lien), le QR code du lien, « Télécharger le QR code » (fichier SVG) et « Imprimer l'affiche ».
- `/espace/affiche` : affiche à imprimer (A4, noir et blanc) avec le nom de la boutique, le QR code, le lien et « Scannez pour voir nos articles et nos promos » ; bouton « Imprimer » (masqué à l'impression). Réservée au commerçant de la boutique.
- Le QR code est généré côté serveur, sans service externe ni payant.
- Boutique pas encore validée : le bloc affiche « Votre lien sera actif dès que votre boutique sera validée par OranPromo. » sans bouton de partage ni QR code ; boutique suspendue : « Votre boutique est suspendue : son lien affiche « Boutique indisponible ». ».
- Tests Vitest : slug (format, suffixe, nom arabe), lien absolu, message et lien WhatsApp, description de l'aperçu, QR code, bloc de partage selon le statut, métadonnées de la vitrine ; tests SQL : format du slug refusé par la base.


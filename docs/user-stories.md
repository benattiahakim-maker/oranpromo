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
- Une grande photo d'accueil avec la phrase « Les promos d'Oran » et un bouton « Voir les promos » (`/catalogue?promo=1`) : photo réelle d'Oran (fort de Santa Cruz au-dessus du port) sous licence libre, avec voile sombre et crédit visible (auteur, licence, source, avec liens).
- Des tuiles carrées (image + mot) pour les univers et les pièces phares ; image = visuel couleur de la marque (images générées par IA pour OranPromo), mot en dessous sur fond blanc. Images servies par le site (`public/images/accueil/`), jamais chargées depuis un autre site (maquette `docs/maquettes/Accueil.dc.html` pour la mise en page ; décision du propriétaire du 9 octobre 2026 : des images couleur inspirées d'Oran plutôt que les photos d'articles).

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

> **Provisoire (MVP) : connexion par lien envoyé par e-mail.** La connexion par SMS demande un fournisseur SMS payant (Twilio…) ; elle sera branchée avant la mise en ligne. Le code doit isoler l'envoi dans une fonction pour pouvoir passer au SMS sans tout réécrire. *(Remplacé par US-21 : code reçu sur WhatsApp, sans SMS.)*

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
- « Commander » demande d'être connecté : connexion par lien e-mail (`/compte/connexion` ; en mode téléphone, aussi par code WhatsApp, US-21), puis retour au panier. Un nouveau compte a le rôle `client`.
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

### US-20.6 — Confirmer une commande depuis WhatsApp (message « nouvelle commande », page `/confirmer/[jeton]`)
En tant que boutique, je veux confirmer une nouvelle commande directement depuis le message WhatsApp, sans ouvrir mon espace ni me connecter, afin de répondre vite au client.
- Le message « nouvelle commande » reçu par la boutique a un bouton **« Confirmer »** (bouton lien du modèle WhatsApp). Le texte reste le même, avec en plus : « Touchez Confirmer, ou confirmez-la dans votre espace OranPromo, rubrique Commandes. »
- Le bouton ouvre une page du site **sans connexion** : `/confirmer/<lien>`. Elle montre la commande (numéro, prénom du client, articles avec taille et quantité, total, note du client) et **un seul gros bouton « Confirmer la commande »**, puis « Commande confirmée : le stock est mis à jour. Pensez à la préparer. » et un lien vers l'espace (« Voir mes commandes »). Pas de numéro de téléphone du client sur cette page.
- Ouvrir la page **ne confirme rien** : seule la touche « Confirmer la commande » confirme (2 touches en tout depuis WhatsApp). Raison : des applications (aperçus de liens, antivirus, navigateur de WhatsApp) ouvrent parfois un lien toutes seules ; une confirmation à l'ouverture pourrait se faire sans la boutique.
- **Mêmes règles que le bouton « Confirmer » du site** : seulement une commande « demandée » ; le stock baisse ; refus « Stock insuffisant pour … » si une taille ne suffit plus (la page propose alors d'ouvrir l'espace pour corriger le stock ou annuler). Le suivi de la commande indique « Confirmée depuis WhatsApp » (auteur : la boutique).
- **Le lien** : propre à **une commande** et à **sa boutique** (il ne peut rien faire d'autre que confirmer cette commande), **signé** par le serveur (impossible à deviner ou à modifier), **valable 24 heures** après l'envoi du message, et **à usage unique** (une fois la commande confirmée, il ne sert plus à rien). Il n'est enregistré nulle part en clair.
- Cas particuliers (message clair, jamais d'erreur technique) :
  - commande déjà confirmée (par le lien ou dans l'espace), prête ou récupérée : « Cette commande est déjà confirmée. » ;
  - commande annulée (par le client ou la boutique) : « Cette commande a été annulée : il n'y a rien à confirmer. » ;
  - commande expirée : « Cette commande a expiré : il n'y a rien à confirmer. » ;
  - lien de plus de 24 heures : « Ce lien a expiré. Confirmez la commande dans votre espace OranPromo, rubrique Commandes. » ;
  - lien abîmé, modifié ou inconnu : « Ce lien n'est pas valide. » (même message, qu'il s'agisse d'une commande qui n'existe pas ou d'une signature fausse).
- Si la boutique est connectée à son espace sur ce téléphone, rien ne change (le lien suffit).
- Choix « sans connexion » proposé et codé ; le propriétaire peut le remettre en cause à la relecture (analyse dans `docs/architecture.md`, « Confirmer depuis WhatsApp (US-20.6) »).
- **Mise en service** : nouveau modèle WhatsApp `oranpromo_nouvelle_commande_confirmer` à **faire approuver par Meta** (bouton lien avec l'adresse définitive du site) ; tant qu'il n'est pas approuvé et activé, l'ancien message sans bouton continue de partir (aucun message perdu).
- Maquettes : `docs/maquettes/WhatsAppConfirmer.dc.html` (message reçu) et `docs/maquettes/ConfirmerCommande.dc.html` (page du lien, avec les autres états).
- Tests prévus : lien signé et vérifié (modifié, expiré, autre commande : refus), page sans effet à l'ouverture, confirmation qui baisse le stock comme dans l'espace, une seule confirmation (deuxième touche : « déjà confirmée »), commandes annulée, expirée, stock insuffisant, appel direct à la base sans le secret du serveur refusé, bouton ajouté au message seulement quand le nouveau modèle est activé.

## Module 8 — Numéro de téléphone vérifié (après le MVP)

Source : carte Trello « V2 · Connexion par SMS » (remplacée par cette story, décisions du propriétaire du 9 octobre 2026). Conception : `docs/architecture.md`, section « Connexion des clients par téléphone (US-21) ».

### US-21 — Vérifier le numéro de téléphone du client (vue d'ensemble)
En tant que propriétaire de la plateforme, je veux que chaque client prouve que son numéro de téléphone est bien le sien, afin que les boutiques le joignent à coup sûr et que les no-shows suivent vraiment la personne.
Livrée en 5 sous-stories, dans cet ordre :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-21.1 | Base : numéro vérifié, règles anti-abus, commande refusée sans numéro vérifié (mode téléphone) | aucun écran |
| US-21.2 | Connexion du client par numéro et code à 6 chiffres reçu sur WhatsApp (pas de SMS, US-21.5) ; vérification du numéro d'un compte existant | `/compte/connexion`, `/compte`, `/panier` |
| US-21.3 | Blocage par numéro vérifié ; un numéro vérifié = un seul compte ; fin de la section « numéro partagé » | `/admin/clients` |
| US-21.4 | Mise en service : liste de ce que le propriétaire configure (Twilio, Supabase, Cloudflare, Vercel, Meta) | aucun écran |
| US-21.5 | Code par WhatsApp uniquement : le secours « Recevoir par SMS » est supprimé (SMS trop cher, décision du propriétaire) | `/compte/connexion`, `/compte`, `/panier` |

**Deux modes**, choisis par la variable serveur `CONNEXION_CLIENT` :
- `email` (par défaut, tant que Twilio n'est pas configuré) : tout reste comme aujourd'hui pour le client (lien e-mail, numéro saisi à la main, pas de vérification forcée, pas de blocage par numéro sauf numéro déjà vérifié) ;
- `telephone` : le client se connecte par son numéro (code WhatsApp) **ou** toujours par lien e-mail, mais ne commande qu'avec un numéro vérifié par code WhatsApp. Ce qui empêche les comptes multiples : la commande exige un numéro vérifié, et un numéro vérifié n'appartient qu'à un seul compte.
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
- « Recevoir le code sur WhatsApp » envoie un code à 6 chiffres sur WhatsApp. Il n'y a pas d'envoi par SMS (US-21.5) : un numéro sans WhatsApp ne peut pas être vérifié.
- Je saisis le code (6 chiffres) : s'il est bon, je suis connecté et je reviens au panier ou à mon compte ; sinon « Code incorrect ou expiré. ». Je peux redemander un code (limites ci-dessus).
- Un lien « Se connecter avec un e-mail » reste disponible (comptes déjà créés par e-mail, commerçants).
- Un nouveau compte créé par numéro a le rôle `client` et son numéro déjà vérifié ; il ne saisit que son nom avant la première commande.
- Compte existant (créé par e-mail) en mode téléphone : `/compte` et `/panier` affichent « Vérifiez votre numéro pour commander » avec le même parcours (numéro, code WhatsApp). Tant que le numéro n'est pas vérifié, « Commander » est remplacé par ce parcours, et la base refuse la commande de toute façon.
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
- `docs/ETAT.md` liste les étapes : Twilio (compte, service Verify, expéditeur WhatsApp approuvé par Meta ; canal WhatsApp seulement), Supabase (fournisseur Phone = Twilio Verify, protection anti-robot Turnstile), Cloudflare Turnstile (site et clé secrète), Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `CONNEXION_CLIENT`), réglage de la base, et les coûts connus avec leur source.
- **Aucune clé** Twilio, Turnstile (secrète) ou Supabase (service) dans le code, `.env.example` ou un commit : elles se saisissent dans le tableau de bord Supabase.

### US-21.5 — Code par WhatsApp uniquement (pages `/compte/connexion`, `/compte`, `/panier`)
En tant que propriétaire, je veux que le code parte uniquement sur WhatsApp, afin de ne pas payer de SMS (0,273 $ par SMS vers l'Algérie, contre environ 0,004 $ pour WhatsApp).
- Le bouton « Recevoir par SMS » disparaît partout ; les textes ne parlent plus de SMS.
- Le serveur envoie toujours le code avec le canal WhatsApp, quoi qu'envoie le navigateur (les actions serveur n'ont plus de paramètre « canal »).
- La connexion par lien e-mail reste possible pour les clients, dans les deux modes. En mode téléphone, un client connecté par e-mail doit vérifier son numéro par code WhatsApp avant de commander (règle de la base, inchangée).
- Tant que Meta n'a pas approuvé l'expéditeur WhatsApp, aucun code ne part : les clients peuvent se connecter par e-mail mais pas commander en mode téléphone. Il faut donc garder `CONNEXION_CLIENT=email` jusqu'à l'approbation.
- Aucune migration. Tests Vitest : canal toujours WhatsApp (connexion et vérification), pas de bouton SMS.

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

## Module 10 — Langues (après le MVP)

### US-23 — Voir le site en arabe (parcours client) — **à valider par le propriétaire avant tout code**
En tant que cliente d'Oran qui lit plus facilement l'arabe, je veux choisir l'arabe sur le site et que ce choix soit gardé, afin de comprendre les boutons, les erreurs et les messages WhatsApp sans effort.
- **Français par défaut** ; l'arabe est la seconde langue. Pas de détection automatique de la langue du téléphone : tout le monde arrive en français et choisit l'arabe d'un geste.
- Arabe **simple et lisible**, avec des mots de **darja oranaise** quand ils sont plus naturels (ex. « زيد للسلة », « الحانوت »). Les 10 textes ci-dessous sont à valider (ou à corriger) par le propriétaire avant le code ; le reste des textes suivra le même ton.
- **Sélecteur de langue visible sur téléphone**, dans l'en-tête de toutes les pages publiques et client : « FR | عربي », chaque langue écrite dans sa propre langue, zone de toucher d'au moins 44 px. Le choix est gardé dans un **cookie `langue`** (`fr` ou `ar`, 1 an) : il est retrouvé à la visite suivante, connecté ou non. Il marche aussi sans JavaScript (formulaire).
- En arabe, la page est **de droite à gauche** (`<html lang="ar" dir="rtl">`) : menus, grilles des tailles, flèche retour (à droite, tournée vers la droite), marges et alignements inversés. Les nombres restent en chiffres 0-9 (comme en Algérie), les prix s'écrivent « 3 500 دج », les numéros de téléphone et les références restent de gauche à droite.
- **Polices** : les polices actuelles (Bodoni Moda pour les titres, Jost pour le texte) n'ont pas de lettres arabes. On ajoute **Noto Naskh Arabic** (titres, contraste proche de Bodoni) et **Tajawal** (texte, géométrique comme Jost), par `next/font`. En arabe, pas de capitales ni d'espacement des lettres (il casserait les liaisons) : la classe `etiquette` passe en taille normale sans espacement.
- **Traduit** : tous les textes de l'interface du parcours client (accueil, catalogue, fiche, vitrine, panier, commandes, compte, connexion par code, no-shows et contestation, pages d'erreur), les listes fixes (catégories, genres, couleurs, quartiers, statuts de commande), les **messages d'erreur**, les dates (« السبت 18 أكتوبر »), et les **messages WhatsApp envoyés à la cliente** (commande prête, commande expirée, no-show, compte bloqué) dans la langue choisie au moment de la commande. Le message du **code de connexion** est envoyé par Supabase Auth et Twilio Verify : sa langue dépend de leurs réglages, à vérifier au moment du code (il reste en français sinon).
- **Messages WhatsApp en arabe** : ce sont de **nouveaux modèles Meta** (langue `ar`) à créer et à faire **approuver par Meta** avant usage ; tant qu'un modèle arabe n'est pas approuvé, le message part en français (aucun message perdu).
- **Pas traduit** : ce que saisit la boutique (nom de la boutique, titre de l'article, description) ; la **description arabe** déjà saisie par le commerçant (US-15) est montrée en premier quand la langue est l'arabe, et la description française reste en dessous. Pas traduits non plus dans cette story : l'espace commerçant, l'administration, les e-mails de connexion et l'aperçu des liens partagés (US-22), qui restent en français (story à part si besoin).
- Les adresses ne changent pas (pas de `/ar/…`) : les liens et QR codes déjà imprimés (US-22) restent valables.
- Maquette : `docs/maquettes/FicheArabe.dc.html` (fiche article en arabe avec le sélecteur). Conception technique : `docs/architecture.md`, « Arabe et darja (US-23) ».

**Les 10 textes à valider** (les mots en gras de la colonne darja sont de la darja oranaise ; la dernière colonne donne une version en arabe standard si le propriétaire la préfère) :

| # | Où | Français (texte actuel du site) | Arabe proposé | Mots en darja | Variante en arabe standard (si la darja ne convient pas) |
| --- | --- | --- | --- | --- | --- |
| 1 | Accueil, bouton | Voir les promos | شوف التخفيضات | **شوف** (regarde) | اعرض التخفيضات |
| 2 | Fiche article, bouton | Ajouter au panier | زيد للسلة | **زيد** (ajoute) | أضف إلى السلة |
| 3 | Panier, bouton | Commander | اطلب | — | اطلب |
| 4 | Fiche et panier, mention | Paiement en boutique | الخلاص في الحانوت | **الخلاص** (le paiement), **الحانوت** (la boutique) | الدفع في المحل |
| 5 | Suivi de commande | Votre commande est prête | طلبك راهو واجد | **راهو** (il est), **واجد** (prêt) | طلبك جاهز |
| 6 | Mon compte, no-show | Contester | اعترض | — | اعترض |
| 7 | Fiche article, erreur | Article plus disponible | هاد السلعة ما بقاتش | **هاد** (cet), **السلعة** (l'article), **ما بقاتش** (n'est plus là) | هذا المنتج لم يعد متوفراً |
| 8 | Connexion, erreur | Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code. | الكود غالط ولا فات وقتو. شوف الأرقام الستة ولا اطلب كود جديد. | **الكود** (le code), **غالط** (faux), **ولا** (ou), **فات وقتو** (a expiré), **شوف** (vérifie) | الرمز غير صحيح أو انتهت صلاحيته. تحقق من الأرقام الستة أو اطلب رمزاً جديداً. |
| 9 | Erreur générale, titre et bouton | Une erreur est survenue · Réessayer | كاين مشكل · عاود جرّب | **كاين** (il y a), **عاود** (encore) | حدث خطأ · أعد المحاولة |
| 10 | Message WhatsApp « commande prête » (modèle `oranpromo_commande_prete`) | Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu'au {{4}}. | السلام {{1}}، الطلب رقم {{2}} راهو واجد عند {{3}}. تقدر تجي تدّيه حتى {{4}}. | **راهو**, **واجد**, **تجي تدّيه** (venir le prendre) | مرحباً {{1}}، طلبك رقم {{2}} جاهز لدى {{3}}. يمكنك استلامه حتى {{4}}. |

- Tests prévus (quand le code sera fait) : dictionnaire arabe complet (même clés que le français, vérifié par TypeScript et par un test), cookie lu et écrit, `lang`/`dir` de la page, sélecteur présent sur mobile, prix et numéros bien orientés, choix du modèle WhatsApp `ar` avec retour au français si non approuvé.

## Module 11 — Carte des boutiques (après le MVP)

Source : carte Trello « Carte · Carte des boutiques » (demande du propriétaire du 9 octobre 2026). À coder **après l'arabe (US-23)**, et seulement après validation des maquettes par le propriétaire. Conception : `docs/architecture.md`, section « Carte des boutiques (US-24) ». Maquettes : `docs/maquettes/Carte.dc.html` et `docs/maquettes/PositionBoutique.dc.html`.

### US-24 — Trouver les boutiques sur une carte (vue d'ensemble) — **à valider par le propriétaire avant tout code**
En tant que cliente à Oran, je veux voir sur une carte où sont les boutiques OranPromo, et lesquelles sont près de moi, afin d'aller essayer sans chercher l'adresse.
Livrée en 3 sous-stories, dans cet ordre (une PR chacune) :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-24.1 | Base : position limitée à la wilaya d'Oran, position protégée après validation, fonction de lecture des épingles `boutiques_carte()` | aucun écran |
| US-24.2 | Saisie de la position : « Je suis dans la boutique », lien Google Maps, épingle déplaçable | `/admin/boutiques`, `/espace` |
| US-24.3 | Page publique `/carte` : épingles, mini-fiche, « Autour de moi », filtre par univers, liste « sans position », liens depuis l'en-tête et l'accueil | `/carte`, `/` |

### US-24.1 — Position de la boutique dans la base (aucun écran)
En tant que propriétaire, je veux que la base refuse une position fausse ou déplacée sans accord, afin que la carte reste fiable.
- La position reste dans les colonnes existantes `boutiques.latitude` et `boutiques.longitude` (degrés décimaux, déjà lues par la vitrine). **Les deux ou aucune** : une latitude sans longitude (ou l'inverse) est refusée.
- La base refuse une position **hors de la wilaya d'Oran** : latitude entre **35,33** et **35,92**, longitude entre **−1,15** et **−0,10** (rectangle qui englobe la wilaya, source et limites dans `docs/architecture.md`). Message : « La position doit être dans la wilaya d'Oran. » (même message à l'écran, sur le serveur et dans la base). Les 2 boutiques actuelles sont dedans (vérifié en lecture le 9/10).
- Une fois la boutique **publiée** (validée ou suspendue), seul un **admin** change ou retire sa position : même règle que le nom, le WhatsApp, le slug et les liens (`prive.proteger_coordonnees_boutique`, message « Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, la position ou les liens. »). Tant qu'elle est « en attente », le commerçant rattaché peut la régler.
- Une seule lecture légère pour la carte : la fonction `boutiques_carte()` renvoie, pour chaque boutique **validée** (mêmes règles que le catalogue), l'identifiant, le slug, le nom, le quartier, la position (vide si aucune), le **nombre de promos en cours** et les couples catégorie / genre de ses articles visibles (pour le filtre par univers). Ni photo, ni WhatsApp, ni adresse, ni rien sur les commandes. Au plus 500 boutiques, triées par nom.
- Tests SQL : position hors d'Oran refusée (y compris `NaN` et l'infini), une seule coordonnée refusée, positions limites acceptées, commerçant d'une boutique en attente : position modifiable, boutique validée : refus pour le commerçant et l'ambassadeur, accepté pour l'admin ; `boutiques_carte()` : boutique en attente ou suspendue absente (même pour un admin connecté), article masqué, vendu ou non confirmé depuis 21 jours non compté, promo expirée non comptée, boutique sans position présente avec une position vide, limite de 500 ; appel anonyme permis.

### US-24.2 — Placer ma boutique sur la carte (pages `/admin/boutiques`, `/espace`)
En tant qu'admin, ambassadeur ou commerçant, je veux placer la boutique sur la carte en quelques secondes depuis la boutique, afin que les clientes la trouvent.
- Le bloc « Position sur la carte » apparaît **à la création** d'une boutique (`/admin/boutiques`, admin et ambassadeur) et **en modification** : admin sur chaque boutique de `/admin/boutiques` (bouton « Position ») ; commerçant dans `/espace` tant que sa boutique est en attente. Il remplace les deux champs « Latitude / Longitude » actuels (gardés dans « Saisir les coordonnées à la main », pour qui n'a pas de carte).
- Bouton **« Je suis dans la boutique : utiliser ma position »** : le navigateur demande l'autorisation ; la position trouvée s'affiche avec sa **précision** (« Position trouvée · précision ± 12 m »). Au-delà de 100 m : avertissement « Position peu précise (± 350 m) : activez la localisation précise ou le GPS, approchez-vous de la porte, ou déplacez l'épingle. ». Refus : « Vous avez refusé la localisation. Collez un lien Google Maps ou placez l'épingle. ». Rien n'est enregistré avant la touche « Enregistrer la position » (ou « Créer la boutique »).
- Ou **coller un lien Google Maps** : le navigateur lit les coordonnées dans les liens longs (`…/@35.69712,-0.63375,17z…`, `…!3d35.69712!4d-0.63375…` — priorité à ce dernier, qui est l'épingle du lieu, `@` n'étant que le centre de la vue —, `?q=35.69712,-0.63375`, `?ll=`, `query=`, `destination=`) ou des coordonnées collées seules (`35.69712, -0.63375`). Aucun lien n'est ouvert, ni par le site ni par le serveur.
- **Liens courts** (`maps.app.goo.gl/…`, `goo.gl/maps/…`) : **jamais suivis**, ni côté serveur (un serveur qui suit un lien envoyé par un utilisateur peut être dirigé vers n'importe quelle adresse : risque SSRF), ni dans le navigateur. Message : « Ce lien court ne contient pas la position. Ouvrez-le dans Google Maps, puis copiez l'adresse complète depuis la barre du navigateur (elle contient « @35,… »), ou utilisez « Je suis dans la boutique ». ». Lien non reconnu : « Coordonnées introuvables dans ce lien. ».
- Une **petite carte** (environ 200 px de haut) montre l'épingle ; on la **déplace du doigt** pour ajuster ; les coordonnées s'affichent sous la carte (6 décimales, environ 10 cm). « Retirer la position » vide les deux champs (la boutique passe dans « sans position »).
- Position hors de la wilaya d'Oran : refusée tout de suite à l'écran, puis par le serveur et la base, avec « La position doit être dans la wilaya d'Oran. ».
- Boutique publiée, côté commerçant : position en lecture seule, avec « Pour déplacer votre boutique sur la carte, contactez OranPromo. ».
- Textes en français seulement : l'espace commerçant et l'administration ne sont pas traduits (US-23). La maquette montre quand même le bloc en arabe, prêt pour une future story.
- Tests Vitest : lecture des liens Google Maps (formats longs, `!3d!4d` prioritaire sur `@`, liens courts refusés sans aucun appel réseau, texte quelconque, coordonnées hors d'Oran), validation de la position (`lib/boutique.ts`), messages, bloc de position (géolocalisation acceptée, précision affichée, avertissement > 100 m, refus), actions serveur (position enregistrée, retirée, refus de la base traduit en message).

### US-24.3 — Voir les boutiques sur la carte (pages `/carte`, `/`)
En tant que cliente, je veux une carte des boutiques avec celles qui sont près de moi, afin de choisir où aller.
- Page publique **`/carte`** : une **épingle par boutique validée ayant une position** (même visibilité que le catalogue : une boutique en attente ou suspendue n'apparaît jamais, même pour un admin connecté). L'épingle porte le nombre de promos en cours (vide s'il n'y en a pas). Au départ, la carte montre toutes les épingles (sinon le centre d'Oran).
- **Toucher une épingle** ouvre une **mini-fiche** en bas de la carte : nom, quartier, « 3 promos en cours » (« Aucune promo en cours » sinon), la distance si « Autour de moi » est actif, et deux boutons : **« Voir la boutique »** (`/b/<slug>`) et **« Itinéraire »** (lien Google Maps existant de la vitrine, construit avec `positionBoutique()` de `lib/vitrine.ts`, sans la position de la cliente).
- **« Autour de moi »** : la localisation n'est demandée **qu'au toucher du bouton**, jamais à l'ouverture de la page. Si la cliente accepte : un point « Vous » sur la carte, la carte se recadre sur elle et les boutiques les plus proches, et la **liste sous la carte est triée par distance** (« 850 m », « 2,4 km »). Si elle refuse : « Localisation refusée : la liste reste triée par nom. Vous pouvez l'autoriser dans les réglages du navigateur. ». Position introuvable ou trop lente (15 s) : « Position introuvable pour le moment. Réessayez dehors ou près d'une fenêtre. ».
- **La position de la cliente n'est jamais envoyée au serveur ni enregistrée** : distances calculées dans le téléphone, rien dans l'adresse de la page, ni dans un cookie, ni dans le stockage du navigateur, ni dans les statistiques. Une phrase le dit sous le bouton : « Votre position reste sur votre téléphone : elle n'est ni envoyée ni enregistrée. ».
- **Filtre par univers** : Tous · Femme · Homme · Enfant · Beauté (mêmes règles que le catalogue : une boutique est dans un univers si elle a au moins un article visible de cet univers ; une boutique sans article n'apparaît que dans « Tous »). Le choix est gardé dans l'adresse (`/carte?univers=femme`) pour être partagé. Aucun résultat : « Aucune boutique de cet univers pour le moment. ».
- **Liste sous la carte** : toutes les boutiques du filtre (nom, quartier, promos en cours, distance si connue), chacune vers `/b/<slug>` ; elle s'affiche aussi sans JavaScript et sans carte (lecteurs d'écran, connexions lentes).
- **Boutique sans position** : pas d'épingle, mais elle reste dans la section « Sans position sur la carte » en bas de la liste.
- **Attribution** obligatoire toujours visible sur la carte : « © OpenStreetMap contributors » (lien vers openstreetmap.org/copyright), et celle du fournisseur de fonds de carte choisi (« © CARTO »).
- **Liens vers `/carte`** : dans l'en-tête public (« Carte », à côté de « Rechercher » ; pour que tout tienne sur 375 px avec le sélecteur « FR | عربي » de US-23, « Panier (2) » devient une icône de sac avec le nombre d'articles, `aria-label` « Panier, 2 articles » — à valider) et sur l'accueil (bloc « Les boutiques sur la carte » sous les univers). La carte n'est chargée que sur `/carte` (et dans le bloc de position) : l'accueil et le catalogue ne téléchargent rien de plus.
- En arabe (US-23) : page de droite à gauche (en-tête, filtres, liste, mini-fiche) ; la carte elle-même ne se retourne pas (le nord reste en haut) ; distances « 850 م », « 2,4 كم » en chiffres 0-9 ; nom des boutiques jamais traduit ; univers et quartiers traduits.
- Tests Vitest : distance entre deux points (valeurs connues), tri par distance, format des distances (fr, ar), univers d'une boutique (réutilise `articleDansUnivers`), lien d'itinéraire, page `/carte` (épingles seulement pour les boutiques avec position, liste « sans position », filtre dans l'adresse), bouton « Autour de moi » (aucune demande de localisation avant le toucher, refus, erreur, aucun appel réseau ni action serveur avec la position — `fetch` et actions espionnés), attribution présente, lien « Carte » dans l'en-tête et sur l'accueil, aucune importation de `leaflet` depuis l'accueil ou le catalogue.

**Textes de la carte en français et en arabe** (même ton que US-23 ; darja en gras ; à valider avec les 10 textes de US-23) :

| # | Où | Français | Arabe proposé | Variante en arabe standard |
| --- | --- | --- | --- | --- |
| 1 | En-tête, lien | Carte | الخريطة | الخريطة |
| 2 | `/carte`, titre | Les boutiques sur la carte | **الحوانت** في الخريطة | المحلات على الخريطة |
| 3 | `/carte`, bouton | Autour de moi | **قريب ليّا** | بالقرب مني |
| 4 | `/carte`, sous le bouton | Votre position reste sur votre téléphone : elle n'est ni envoyée ni enregistrée. | **البلاصة** نتاعك تبقى في التيليفون نتاعك: **ما تتبعثش** و**ما تتسجّلش**. | موقعك يبقى في هاتفك: لا يُرسَل ولا يُحفَظ. |
| 5 | Mini-fiche | 3 promos en cours | 3 تخفيضات **دابا** | 3 تخفيضات جارية |
| 6 | Mini-fiche, bouton | Voir la boutique | **شوف الحانوت** | اعرض المحل |
| 7 | Mini-fiche, bouton | Itinéraire | الطريق | الاتجاهات |
| 8 | Liste, distance | à 850 m · à 2,4 km | على بعد 850 م · على بعد 2,4 كم | (identique) |
| 9 | Liste, section | Sans position sur la carte | **ما عندهمش بلاصة** في الخريطة | بدون موقع على الخريطة |
| 10 | Erreur | Localisation refusée : la liste reste triée par nom. | **ما عطيتش** الإذن بالموقع: القائمة تبقى مرتّبة بالاسم. | تم رفض تحديد الموقع: تبقى القائمة مرتبة حسب الاسم. |
| 11 | Filtre | Tous · Femme · Homme · Enfant · Beauté | الكل · نسا · رجال · **ذراري** · تجميل | الكل · نساء · رجال · أطفال · تجميل |
| 12 | Accueil, bloc | Les boutiques sur la carte · Voir la carte | **الحوانت** في الخريطة · **شوف** الخريطة | المحلات على الخريطة · اعرض الخريطة |

## Module 12 — Univers Beauté (après le MVP)

Source : élément « Beauté » du backlog (demande du propriétaire du 9 octobre 2026, avec une boutique de démonstration de parfums). À coder **seulement après validation de la maquette par le propriétaire**. Conception : `docs/architecture.md`, section « Univers Beauté (US-25) ». Maquette : `docs/maquettes/Beaute.dc.html`. Données de démonstration : `supabase/scripts/demo_parfumerie.sql` (préparé, **pas lancé**).

**Déjà en place (audit du 9 octobre 2026)** : les 5 catégories beauté et leur contrôle dans la base (`prive.verifier_categorie_article`), l'univers « Beauté » (`critereUnivers`, `articleDansUnivers`), les contenances en ml côté commerçant (formulaire, aide à la saisie, stock par contenance), le genre facultatif (enregistré « mixte »), la tuile « Beauté » et la pièce phare « Parfums » de l'accueil, le choix « Beauté » dans le catalogue et dans le filtre de `/carte`, les noms arabes des catégories, la fiche IA qui sait décrire un produit de beauté. **Il manque** surtout le côté cliente : le mot « Contenance » à la place de « Taille », un filtre de contenance trié par volume, la place des parfums mixtes dans le filtre de genre, et la boutique de démonstration.

### US-25 — Acheter des produits de beauté (parfums, maquillage, soins) — **à valider par le propriétaire avant tout code**
En tant que cliente, je veux trouver les parfums, le maquillage et les soins des boutiques d'Oran, choisir la contenance (50 ml, 100 ml) et commander comme pour un vêtement, afin d'acheter ma beauté au même endroit.
Livrée en 3 sous-stories, dans cet ordre (une PR chacune) :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-25.1 | « Contenance » au lieu de « Taille » pour la beauté, partout où la cliente et le commerçant le lisent | fiche article, panier, commandes, message WhatsApp |
| US-25.2 | Catalogue Beauté : filtre de contenance trié par volume, genre « Pour elle / Pour lui / Mixte » avec les mixtes inclus, raccourcis de catégories | `/catalogue?univers=beaute` |
| US-25.3 | Boutique de démonstration « Parfumerie Démo » (5 parfums), lancée par le propriétaire dans Supabase | `/carte`, `/b/parfumerie-demo`, catalogue |

**Catégories** (inchangées, déjà contrôlées par la base) : Parfums · Maquillage · Soins visage et corps · Cheveux · Hammam et traditionnel. Ajouts possibles selon la réponse du propriétaire (question 1) : « Bakhour et encens », « Ongles ». Un ajout de catégorie = une **nouvelle migration** (liste de la base) + `lib/article.ts` + les noms arabes.

**Contenances et stock** (règle déjà en place, rappelée ici) : un produit de beauté n'a pas de S/M/L mais une **contenance en ml** (5, 10, 15, 30, 50, 75, 100, 150, 200, 250, 500, 1000 ml) ou « Unique » (rouge à lèvres, palette, savon). Chaque contenance a **son stock** (table `tailles`, colonne `libelle` = « 50 ml » : pas de nouvelle colonne) ; une contenance à 0 s'affiche « épuisée » ; l'article passe « vendu » quand toutes sont à 0, comme un vêtement. **Un seul prix par article** : un 50 ml et un 100 ml à des prix différents sont deux articles (question 2).

### US-25.1 — « Contenance » pour les produits de beauté (aucune migration)
- Sur la **fiche article** d'un produit de beauté : légende « Contenance » au lieu de « Taille », boutons « 50 ml », « 100 ml » ; « 100 ml, épuisée » ; « Choisissez une contenance pour commander. » ; « Aucune contenance disponible. ». Taille unique : rien ne s'affiche (comme aujourd'hui).
- **Panier** : « 100 ml · 4 900 DA » (le nombre en ml dit déjà ce que c'est : pas de mot « Taille » devant) ; boutons accessibles « Eau de parfum oud boisé 100 ml : une pièce de moins ».
- **Commandes** (`/mes-commandes`, `/espace/commandes`) et **message WhatsApp** de réservation : « Eau de parfum oud boisé, 100 ml, 4 900 DA » au lieu de « taille 100 ml ».
- Règle : on choisit le mot avec `estCategorieBeaute(categorie)` (déjà utilisé côté commerçant par `libelleTaille`), jamais d'après le texte « ml ». Les commandes enregistrent déjà la catégorie via l'article ; une ligne dont l'article a été retiré garde « Taille ».
- **Arabe** : « الحجم » (contenance) au lieu de « المقاس » ; « 100 مل » ; « 100 مل، ما بقاش ». Unités « ml » / « مل » écrites par l'application, le nombre reste en chiffres 0-9.
- Tests Vitest : libellés fr / ar (mêmes clés et variables, `textes.test.ts`), fiche d'un parfum (« Contenance », « 100 ml, épuisée »), fiche d'un vêtement inchangée (« Taille »), panier, message WhatsApp avec et sans contenance.

### US-25.2 — Catalogue Beauté (`/catalogue?univers=beaute`)
- **Raccourcis de catégories** sous le titre quand l'univers Beauté est choisi : Tout · Parfums · Maquillage · Soins · Cheveux · Hammam (liens vers `?univers=beaute&categorie=…`, ligne qui défile horizontalement, catégorie choisie en noir plein). Une catégorie sans article visible n'est pas affichée.
- **Filtre « Contenance »** (au lieu de « Taille ») quand l'univers est Beauté ou la catégorie est une catégorie beauté : options **triées par volume** (5 ml, 10 ml, 50 ml, 100 ml, Unique en dernier), sans S/M/L. Dans les autres cas, le filtre « Taille » ne montre que les tailles de vêtements, triées XS → XXL puis les pointures (aujourd'hui, ordre alphabétique et ml mélangés).
- **Genre dans Beauté** : « Pour elle », « Pour lui », « Mixte » ; **« Pour elle » inclut les mixtes** (et « Pour lui » aussi), comme les univers Femme / Homme : un parfum mixte doit sortir pour une cliente qui cherche « pour elle ». « Enfant » n'est pas proposé dans Beauté. Hors Beauté, le filtre de genre ne change pas.
- **Tuile de l'accueil** : la tuile « Beauté » existante est gardée (photo `univers-beaute.webp`, lien `/catalogue?univers=beaute`) ; la pièce phare « Parfums » aussi. Rien à ajouter tant qu'il y a peu d'articles beauté (question 6).
- Rien ne change pour les univers Femme, Homme, Enfant, ni pour `/carte` (le filtre Beauté y est déjà).
- Tests Vitest : tri des contenances (numérique, « Unique » à la fin, valeurs inconnues gardées), tri des tailles de vêtements, filtre de genre Beauté avec mixtes (requête Supabase espionnée : `in("genre", ["femme", "mixte"])`), raccourcis masqués pour une catégorie vide, `?univers=femme` inchangé.

### US-25.3 — Boutique de démonstration « Parfumerie Démo » (après validation)
- Le propriétaire lance `supabase/scripts/demo_parfumerie.sql` dans l'éditeur SQL de Supabase **après** avoir validé cette conception (si une catégorie est ajoutée ou un article change, le script est mis à jour d'abord). Grok Bot ne le lance pas sans son accord.
- Boutique validée « Parfumerie Démo » (`/b/parfumerie-demo`), quartier Gambetta, position dans la wilaya d'Oran (apparaît sur `/carte` avec « 4 promos en cours »), WhatsApp de test volontairement invalide `+213000000003` (aucun message ne peut partir). Aucun compte commerçant.
- 5 parfums génériques (aucune marque, aucun nom de parfum existant), photos d'exemple placehold.co comme la démo actuelle :

| Article | Genre | Contenances (stock) | Prix | Prix promo |
| --- | --- | --- | --- | --- |
| Eau de parfum oud boisé | mixte | 100 ml (3) | 6 500 DA | 4 900 DA |
| Eau de parfum rose et musc | femme | 50 ml (4), 100 ml (épuisée) | 4 800 DA | 3 900 DA (« Promo flash ») |
| Eau de toilette agrumes frais | homme | 100 ml (5) | 3 900 DA | 2 900 DA |
| Huile parfumée musc blanc | mixte | 10 ml (10) | 1 500 DA | 1 200 DA |
| Eau de parfum ambre et vanille | femme | 75 ml (2) | 5 500 DA | — (sans promo) |

- Promos valables 30 jours à partir du lancement. Retrait le jour de la mise en ligne : `supabase/scripts/retirer_donnees_demo.sql` (boutique et articles dans sa liste, testé).

**Textes en français et en arabe** (simple, darja d'Oran en gras, masculin générique ; à valider) :

| # | Où | Français | Arabe proposé | Variante en arabe standard |
| --- | --- | --- | --- | --- |
| 1 | Univers | Beauté | تجميل | تجميل |
| 2 | Fiche, légende | Contenance | الحجم | الحجم |
| 3 | Fiche, bouton | 100 ml | 100 مل | 100 مل |
| 4 | Fiche, épuisée | 100 ml, épuisée | 100 مل، **ما بقاش** | 100 مل، نفد |
| 5 | Fiche, consigne | Choisissez une contenance pour commander. | **ختار** الحجم باش **تطلب**. | اختر الحجم للطلب. |
| 6 | Fiche, aucune | Aucune contenance disponible. | **ما كاين** حتى حجم. | لا يوجد حجم متوفر. |
| 7 | Catalogue, filtre | Contenance · Toutes | الحجم · **كامل** | الحجم · الكل |
| 8 | Catalogue, genre | Pour elle · Pour lui · Mixte | **ليها** · **ليه** · للجوج | للنساء · للرجال · للجنسين |
| 9 | Catalogue, raccourcis | Tout · Parfums · Maquillage · Soins · Cheveux · Hammam | **كامل** · عطور · ماكياج · العناية · الشعر · حمّام | الكل · عطور · مكياج · العناية · الشعر · حمّام |
| 10 | Panier | 100 ml · 4 900 DA | 100 مل · 4 900 دج | (identique) |
| 11 | Catalogue Beauté, vide | Aucun produit de beauté pour le moment. | **ما كاين** حتى منتوج تجميل **دابا**. | لا توجد منتجات تجميل حاليًا. |

**Questions au propriétaire** (avant le code) :
1. Catégories : garder les 5 actuelles, ou ajouter « Bakhour et encens » et « Ongles » (vernis, faux ongles) ? Les accessoires (trousses, pinceaux) vont-ils dans « Maquillage » ?
2. Prix par contenance : un seul prix par article (50 ml et 100 ml = deux articles, rien à changer dans la base), ou un prix par contenance (nouvelle migration, panier et commandes à revoir) ?
3. Mot arabe pour « Contenance » : « الحجم » (proposé) ou « القد » / « السعة » ?
4. Authenticité : faut-il une règle pour les commerçants (« pas de copie vendue comme original », signalement « contrefaçon ») et une mention sur les fiches parfum ?
5. Décants (5 ml / 10 ml reconditionnés) et date de péremption : autorisés ? à afficher ?
6. Accueil : la tuile « Beauté » actuelle suffit-elle, ou voulez-vous un bloc « Parfums en promo » quand il y aura assez d'articles ?
7. Genre dans Beauté : « Pour elle / Pour lui / Mixte » avec les mixtes inclus partout (proposé), ou pas de filtre de genre dans Beauté ?
8. Boutique de démonstration : noms, prix et quartier (Gambetta) des 5 parfums vous conviennent ? Je lance le script seulement après votre accord.

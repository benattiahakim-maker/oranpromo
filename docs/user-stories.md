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

Source : élément « Beauté » du backlog (demande du propriétaire du 9 octobre 2026, avec une boutique de démonstration de parfums). Maquette **validée par le propriétaire le 9/10** (décisions en fin de module). Conception : `docs/architecture.md`, section « Univers Beauté (US-25) ». Maquette : `docs/maquettes/Beaute.dc.html`. Données de démonstration : `supabase/scripts/demo_parfumerie.sql`.

**Déjà en place (audit du 9 octobre 2026)** : les 5 catégories beauté et leur contrôle dans la base (`prive.verifier_categorie_article`), l'univers « Beauté » (`critereUnivers`, `articleDansUnivers`), les contenances en ml côté commerçant (formulaire, aide à la saisie, stock par contenance), le genre facultatif (enregistré « mixte »), la tuile « Beauté » et la pièce phare « Parfums » de l'accueil, le choix « Beauté » dans le catalogue et dans le filtre de `/carte`, les noms arabes des catégories, la fiche IA qui sait décrire un produit de beauté. **Il manque** surtout le côté cliente : le mot « Contenance » à la place de « Taille », un filtre de contenance trié par volume, la place des parfums mixtes dans le filtre de genre, et la boutique de démonstration.

### US-25 — Acheter des produits de beauté (parfums, maquillage, soins) — **validée par le propriétaire le 9/10**
En tant que cliente, je veux trouver les parfums, le maquillage et les soins des boutiques d'Oran, choisir la contenance (50 ml, 100 ml) et commander comme pour un vêtement, afin d'acheter ma beauté au même endroit.
Livrée en 3 sous-stories, dans cet ordre (une PR chacune) :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-25.1 | « Contenance » au lieu de « Taille » pour la beauté, partout où la cliente et le commerçant le lisent | fiche article, panier, commandes, message WhatsApp |
| US-25.2 | Catalogue Beauté : filtre de contenance trié par volume, genre « Pour elle / Pour lui / Mixte » avec les mixtes inclus, raccourcis de catégories | `/catalogue?univers=beaute` |
| US-25.3 | Boutique de démonstration « Parfumerie Démo » (5 parfums), lancée en production le 9/10 après validation | `/carte`, `/b/parfumerie-demo`, catalogue |

**Catégories** (inchangées, déjà contrôlées par la base) : Parfums · Maquillage · Soins visage et corps · Cheveux · Hammam et traditionnel. Décision du propriétaire : pas d'autre catégorie ; les accessoires de beauté vont dans « Maquillage ».

**Contenances et stock** (règle déjà en place, rappelée ici) : un produit de beauté n'a pas de S/M/L mais une **contenance en ml** (5, 10, 15, 30, 50, 75, 100, 150, 200, 250, 500, 1000 ml) ou « Unique » (rouge à lèvres, palette, savon). Chaque contenance a **son stock** (table `tailles`, colonne `libelle` = « 50 ml » : pas de nouvelle colonne) ; une contenance à 0 s'affiche « épuisée » ; l'article passe « vendu » quand toutes sont à 0, comme un vêtement. **Un seul prix par article** (décision du propriétaire) : un 50 ml et un 100 ml à des prix différents sont deux articles. Les décants sont permis s'ils sont présentés comme tels ; pas de date de péremption.

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
- **Tuile de l'accueil** : la tuile « Beauté » existante est gardée (photo `univers-beaute.webp`, lien `/catalogue?univers=beaute`) ; la pièce phare « Parfums » aussi. Rien à ajouter (décision du propriétaire).
- Rien ne change pour les univers Femme, Homme, Enfant, ni pour `/carte` (le filtre Beauté y est déjà).
- Tests Vitest : tri des contenances (numérique, « Unique » à la fin, valeurs inconnues gardées), tri des tailles de vêtements, filtre de genre Beauté avec mixtes (requête Supabase espionnée : `in("genre", ["femme", "mixte"])`), raccourcis masqués pour une catégorie vide, `?univers=femme` inchangé.

### US-25.3 — Boutique de démonstration « Parfumerie Démo » (après validation)
- `supabase/scripts/demo_parfumerie.sql` est lancé en production (requête SQL, **pas** une migration) après la validation du propriétaire du 9/10, puis vérifié : boutique visible dans le catalogue (mêmes règles que le public) et dans `boutiques_carte()`.
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

### US-25.4 — Messages de la base avec « contenance » pour la beauté (accord du propriétaire du 9/10)
En tant que cliente ou commerçant, je veux que les refus de la base parlent de « contenance » pour un parfum, afin que le message soit juste.
- `passer_commande` : « Il ne reste que 1 pièce(s) en contenance 100 ml pour « … ». », « La contenance 30 ml de « … » n'existe plus : retirez-la du panier. », « Le même article et la même contenance apparaissent deux fois dans le panier. » ; confirmation (`prive.retirer_stock`) : « Stock insuffisant pour « … » en contenance 100 ml : … ». La mode garde « taille ». Le mot est choisi d'après la **catégorie** de l'article (5 catégories beauté).
- Migration `20261011090000_messages_contenance.sql` : les deux fonctions reprises à l'identique de la production, seuls ces 4 messages changent (aucune règle de connexion, de numéro vérifié, de blocage ni de no-show touchée).
- Arabe (`lib/textes/messages.ts`) : « بقاو غير 1 في الحجم 100 ml لـ « … ». », « الحجم 30 ml تاع « … » ما بقاش: نحّيه من السلة. », « نفس السلعة بنفس الحجم كاينة جوج مرات في السلة. ».

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

**Décisions du propriétaire (9 octobre 2026, 18 h 46)** — maquette et boutique de démonstration validées :
1. **Catégories** : on garde les 5 ; les accessoires de beauté (trousses, pinceaux) vont dans « Maquillage ». Aucune migration.
2. **Prix** : un seul prix par article (un 50 ml et un 100 ml à des prix différents = deux articles). Pas de prix par contenance.
3. **Arabe** : « Contenance » = « الحجم ».
4. **Authenticité** : **aucune** règle, aucun motif de signalement « contrefaçon », aucune mention sur les fiches. Sujet abandonné.
5. **Décants** (5 ml / 10 ml reconditionnés) : autorisés s'ils sont présentés comme tels dans le titre ou la description (« Décant 10 ml de… ») ; **aucune date de péremption** affichée. Rien à coder.
6. **Accueil** : la tuile « Beauté » actuelle suffit.
7. **Genre dans Beauté** : « Pour elle / Pour lui / Mixte », les mixtes inclus dans « Pour elle » et « Pour lui ».
8. **Boutique de démonstration** : validée telle quelle ; script lancé en production (US-25.3).

## Module 13 — Retrait par QR code (après le MVP)

Idée du propriétaire (9 octobre 2026), inspirée de Too Good To Go. Conception : `docs/architecture.md`, section « Retrait par QR code (US-26) ». Maquette : `docs/maquettes/RetraitQR.dc.html`.

### US-26 — Retirer sa commande en montrant un QR code (vue d'ensemble) — **validée par le propriétaire le 9/10** (décisions en fin de module)
En tant que client, je veux montrer un QR code au vendeur quand je viens chercher ma commande (ou l'envoyer à un proche qui y va à ma place), et en tant que commerçant, je veux le scanner avec mon téléphone pour voir tout de suite quoi remettre et combien encaisser, afin que le retrait soit rapide et sans erreur de commande.

Livrée en 4 sous-stories, dans cet ordre (une PR chacune), après validation :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-26.1 | Jeton de retrait et code à 4 chiffres dans la base, fonctions de lecture et de remise, limite d'essais | aucun |
| US-26.2 | QR code et code côté client, lien à partager, page du proche | `/compte/commandes/[id]`, `/retrait/[jeton]` |
| US-26.3 | Scanner côté boutique (caméra + saisie du code), résumé, « Remis au client » | `/espace/commandes`, `/espace/scanner`, `/espace/retrait/[jeton]` |
| US-26.4 | Bouton « Mon QR code » dans le message WhatsApp « commande prête » (modèle Meta à faire approuver) | message WhatsApp |

**Parcours** :
1. La boutique passe la commande « Prête » (comme aujourd'hui). À ce moment, la base crée un **jeton de retrait** (QR code) et un **code à 4 chiffres** pour cette commande.
2. Le client voit dans « Mes commandes » (`/compte/commandes/[id]`) un bloc **« Mon QR code de retrait »** : le QR code (grand, noir sur blanc), le code à 4 chiffres en dessous (« Pas de caméra ? Donnez ce code »), le **montant à payer en espèces**, la date limite, et « Montez la luminosité de l'écran ». Le message WhatsApp « commande prête » a un bouton **« Mon QR code »** qui ouvre la même chose (page `/retrait/<jeton>`, sans connexion).
3. **Un proche peut y aller** : « Envoyer à un proche (WhatsApp) » et « Copier le lien » partagent l'adresse `/retrait/<jeton>`. Avertissement affiché : « Toute personne qui a ce lien peut récupérer la commande : ne l'envoyez qu'à quelqu'un de confiance. » La page du proche montre la boutique (nom, adresse, lien carte), le numéro de commande, la date limite, les articles avec taille ou contenance, le total à payer, le QR code et le code ; **ni le nom ni le téléphone du client**.
4. En boutique, le commerçant ouvre son espace, rubrique Commandes, touche **« Scanner un QR code client »** : la caméra arrière s'ouvre dans la page (« Placez le QR code du client dans le cadre »). Si la caméra ne marche pas : il tape le **code à 4 chiffres** dans la même page.
5. Il voit le **résumé** : numéro, prénom du client, articles (titre, taille ou contenance, quantité, prix), **« À encaisser en espèces : 6 300 DA »** en grand, date limite, et « Vérifiez les articles avec le client avant de remettre. Un proche peut venir à sa place : c'est normal. »
6. Il touche **« Remis au client »** : la commande passe « Récupérée » (même règle qu'aujourd'hui : seulement depuis « Prête »), le suivi indique « Remise par QR code » ou « Remise par code ». Écran « Commande remise » + « Scanner une autre commande ».

**Règles du jeton et du code** (détail technique dans l'architecture) :
- Jeton **aléatoire** (128 bits, impossible à deviner), **un par commande**, créé au passage « Prête ».
- **Usage unique** : une fois la commande « Récupérée », le QR code ne fait plus rien (« Déjà remise le … »).
- **Valable seulement pour la boutique de la commande**, connectée à son espace : le QR code d'une autre boutique, abîmé ou inconnu donne le même message « Ce QR code n'est pas valide pour votre boutique. » (on ne dit jamais qu'une commande existe ailleurs).
- **Invisible pour la boutique avant le scan** : ni le jeton ni le code n'apparaissent dans l'espace commerçant, la liste des commandes ou les données que la boutique peut lire.
- **Expire avec la commande** : seulement tant que la commande est « Prête » et avant sa date limite (24 h). Annulée ou expirée : « Cette commande a été annulée. » / « Cette commande a expiré : elle n'est plus à remettre. »
- Le **code à 4 chiffres** n'est valable que pour les commandes prêtes **de la boutique connectée** ; deux commandes prêtes d'une même boutique n'ont jamais le même code.
- **Pas de blocage de la boutique** sur des QR codes ou codes faux (décision du propriétaire : un compte par numéro WhatsApp, on ne bloque pas les boutiques) : chaque erreur donne le même message, sans limite d'essais. La sécurité tient au jeton de 128 bits et au code limité aux commandes prêtes de la boutique connectée.
- **Mode de remise enregistré** par la base sur la commande (`qr`, `code` ou `manuel`), impossible à modifier ensuite : il servira au parrainage (US-27 : le premier retrait du filleul doit être validé par QR code ou code à 4 chiffres).
- Ouvrir la page du QR code (client ou proche) **ne change rien** ; scanner **ne remet rien** : seule la touche « Remis au client » remet la commande.

**Bouton manuel « Récupérée »** (proposition) : il **reste**, renommé « Remis sans QR code », derrière une confirmation (« Le client n'a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez. »). Raisons : téléphone du client déchargé ou sans internet, client âgé, scanner en panne ; le supprimer bloquerait des remises réelles. Le suivi indique « Remise sans QR code ». Dans la carte de la commande, le texte guide vers le scan : « Remise : scannez le QR code du client. »

**No-show et contestation** (description seulement : **aucune règle de blocage, de no-show ni de numéro vérifié ne change**) :
- Une commande remise par QR code ou par code est « Récupérée » : elle ne peut pas être déclarée « Client pas venu » (règle actuelle : seulement « Prête » depuis plus de 24 h ou « Expirée »).
- Le suivi garde **comment** la commande a été remise (QR code, code, sans QR code) : l'admin le voit quand il traite une contestation, ce qui l'aide à juger ; rien n'est automatique.
- Un client qui conteste un no-show en disant « je suis venu » n'est pas cru ou démenti automatiquement par l'absence de scan (la boutique a pu oublier de scanner ou utiliser le bouton sans QR code).
- Un proche qui récupère avec le lien partagé : la commande est remise au compte du client ; c'est le client qui a choisi de partager.

**Textes en français et en arabe** (simple, darja d'Oran en gras, masculin générique ; à valider) :

| # | Où | Français | Arabe proposé | Variante en arabe standard |
| --- | --- | --- | --- | --- |
| 1 | Client, titre du bloc | Mon QR code de retrait | QR تاع الاستلام | رمز QR للاستلام |
| 2 | Client, consigne | Montrez ce QR code au vendeur, dans la boutique. Vous payez sur place, en espèces. | **ورّي** هاد QR للبيّاع في الحانوت. **تخلّص** تمّا، كاش. | أظهر رمز QR للبائع في المحل. الدفع في المحل نقدًا. |
| 3 | Client, code | Pas de caméra ? Donnez ce code : | **ما خدمتش** الكاميرا؟ **عطيه** هاد الرقم: | الكاميرا لا تعمل؟ أعطه هذا الرمز: |
| 4 | Client, montant | À payer en espèces | **تخلّص** كاش | المبلغ المطلوب نقدًا |
| 5 | Client, luminosité | Montez la luminosité de l'écran pour que le QR code se lise bien. | **طلّع** الضو تاع التيليفون باش يتقرا مليح. | ارفع إضاءة الشاشة لقراءة الرمز جيدًا. |
| 6 | Client, partage | Envoyer à un proche (WhatsApp) | **ابعثو** لواحد من **دارك** (واتساب) | أرسله إلى أحد أقاربك (واتساب) |
| 7 | Client, copier | Copier le lien | **كوبي** الرابط | انسخ الرابط |
| 8 | Client, avertissement | Toute personne qui a ce lien peut récupérer la commande : ne l'envoyez qu'à quelqu'un de confiance. | **أي واحد** عندو هاد الرابط **يقدر يدّي** الطلبية: ما **تبعثوش** غير لواحد **تثيق** فيه. | كل من لديه هذا الرابط يمكنه استلام الطلب: لا ترسله إلا لشخص تثق به. |
| 9 | Proche, titre | Commande n° 128 à récupérer chez … | الطلبية رقم 128 **تدّيها** من … | الطلب رقم 128 للاستلام من … |
| 10 | Proche, consigne | Montrez ce QR code au vendeur, ou donnez-lui le code : | **ورّي** هاد QR للبيّاع، **ولا عطيه** الرقم: | أظهر الرمز للبائع أو أعطه الرقم: |
| 11 | Boutique, bouton | Scanner un QR code client | **سكاني** QR تاع الزبون | امسح رمز QR للزبون |
| 12 | Boutique, consigne | Placez le QR code du client dans le cadre. | **حط** QR تاع الزبون وسط الكادر. | ضع رمز الزبون داخل الإطار. |
| 13 | Boutique, code | La caméra ne marche pas ? Tapez le code à 4 chiffres | **ما خدمتش** الكاميرا؟ **اكتب** الرقم تاع 4 أرقام | الكاميرا لا تعمل؟ أدخل الرمز المكوّن من 4 أرقام |
| 14 | Boutique, montant | À encaisser en espèces | **اقبض** كاش | المبلغ الواجب تحصيله نقدًا |
| 15 | Boutique, bouton | Remis au client | **سلّمت** الطلبية للزبون | تم التسليم للزبون |
| 16 | Boutique, succès | Commande remise | الطلبية **تسلّمت** | تم تسليم الطلب |
| 17 | Boutique, autre boutique | Ce QR code n'est pas valide pour votre boutique. | هاد QR **ماشي** صالح لحانوتك. | هذا الرمز غير صالح لمحلك. |
| 18 | Boutique, déjà remise | Déjà remise le 10/10 à 17 h 05. | **تسلّمت** من قبل، نهار 10/10 على 17:05. | تم تسليمه سابقًا يوم 10/10 على 17:05. |
| 19 | Boutique, expirée | Cette commande a expiré : elle n'est plus à remettre. | الطلبية **فات** وقتها: **ما تسلّمهاش**. | انتهت صلاحية الطلب: لا تسلّمه. |
| 20 | Boutique, code faux | Code faux. Vérifiez les 4 chiffres avec le client. | الرقم **غالط**. **عاود شوف** الـ4 أرقام مع الزبون. | الرمز خاطئ. تحقّق من الأرقام الأربعة مع الزبون. |
| 21 | ~~Boutique, trop d'essais~~ | (supprimé : pas de limite d'essais, décision 6) | | |
| 22 | Boutique, caméra bloquée | La caméra est bloquée. Autorisez-la dans les réglages du navigateur (cadenas à côté de l'adresse), ou tapez le code. | الكاميرا **مبلوكية**. **حلّها** من الإعدادات تاع المتصفح (القفل حدا العنوان)، ولا **اكتب** الرقم. | الكاميرا محظورة. اسمح بها من إعدادات المتصفح أو أدخل الرمز. |

L'espace commerçant est aujourd'hui en français seulement (US-23) : les textes 11 à 22 en arabe serviront quand tout l'espace passera en arabe (décision 4) ; le scanner est en français pour l'instant.

**Questions posées au propriétaire** (réponses : « Décisions du propriétaire » ci-dessous) :
1. **Lecteur de QR code sur iPhone** : le lecteur intégré au navigateur (`BarcodeDetector`) marche sur Chrome et Samsung Internet pour Android, **pas sur iPhone** (Safari, et Chrome sur iPhone qui utilise Safari). Proposition **A** (recommandée) : ajouter la petite bibliothèque **jsQR** (gratuite, Apache-2.0, environ 46 Ko compressés, chargée seulement sur un téléphone qui n'a pas le lecteur intégré). Proposition **B** : aucune bibliothèque ; sur iPhone, le commerçant scanne avec l'appareil photo de l'iPhone (le QR code ouvre directement la page de la commande dans son espace) ou tape le code. Laquelle ?
2. **Bouton manuel** : garder « Remis sans QR code » derrière une confirmation (proposé), ou le supprimer (QR code ou code obligatoire) ?
3. **Prénom du client sur le résumé** de la boutique : le garder (proposé, la boutique le voit déjà dans sa liste) ? Faut-il en plus que le proche dise un nom ?
4. **Arabe dans le scanner** : l'espace commerçant est en français ; faut-il le scanner (et les messages 11 à 22) en arabe dès US-26.3, ou plus tard avec tout l'espace ?
5. **Message WhatsApp** : faire approuver un nouveau modèle « commande prête » avec le bouton « Mon QR code » (proposé, même méthode que le bouton « Confirmer » de US-20.6), ou laisser le message actuel (le client ouvre « Mes commandes ») ?
6. **Limite d'essais** : 5 erreurs en 15 minutes par boutique vous convient ?
7. **Lien du proche** : la page `/retrait/<jeton>` montre les articles et le montant (proposé, pour que le proche sache quoi prendre et combien apporter). D'accord ?

**Ce qui ne change pas** : statuts et transitions des commandes, expiration à 24 h, no-shows, contestation, blocage, vérification du numéro, stock (déjà retiré à la confirmation).

**Décisions du propriétaire (9 octobre 2026, 19 h 16)** — conception validée :
1. **iPhone** : on ajoute **jsqr**, chargée seulement quand le lecteur intégré (`BarcodeDetector`) manque.
2. **« Remis sans QR code »** gardé, derrière une confirmation.
3. La boutique voit le **prénom** du client ; le proche ne donne aucun nom.
4. **Scanner en français** pour l'instant ; l'arabe viendra avec tout l'espace commerçant.
5. **Nouveau modèle Meta** « commande prête » avec le bouton « Mon QR code », **désactivé par un réglage** (`bouton_retrait`) tant que Meta ne l'a pas approuvé.
6. **Changement** : **aucune limite d'essais, aucun blocage de la boutique** sur des codes ou QR codes faux (un compte par numéro WhatsApp, on ne bloque pas les boutiques). On garde le message unique (« Ce QR code n'est pas valide pour votre boutique. » / « Code faux… »), le jeton de 128 bits et le code limité aux commandes prêtes de la boutique.
7. La page du proche montre les **articles et le montant**, jamais le nom ni le téléphone du client.
8. **Parrainage (US-27)** : le premier retrait du filleul devra être validé par QR code ou code à 4 chiffres : le **mode de remise** est enregistré de façon fiable par la base (`commandes.mode_remise`).

### US-26.1 — Jeton de retrait dans la base (aucun écran)
En tant que propriétaire, je veux que chaque commande prête ait un QR code et un code à 4 chiffres sûrs, et que la base retienne comment elle a été remise.
- Jeton (128 bits) et code (unique parmi les commandes prêtes de la boutique) créés au passage « Prête », invisibles pour la boutique ; fonctions `retrait_client`, `retrait_par_lien`, `retrait_boutique`, `remettre_commande` ; `commandes.mode_remise` (`qr`, `code`, `manuel`) posé par la base, jamais modifiable.
- Tests SQL : voir `docs/architecture.md`.

### US-26.2 — Mon QR code de retrait (pages `/compte/commandes/[id]`, `/retrait/[jeton]`)
En tant que client, je veux voir mon QR code et mon code quand ma commande est prête, et pouvoir les envoyer à un proche.
- Bloc « Mon QR code de retrait » (maquette ①), page du proche sans connexion (maquette ③), français et arabe.

### US-26.3 — Scanner et remettre (pages `/espace/commandes`, `/espace/scanner`, `/espace/retrait/[jeton]`)
En tant que commerçant, je veux scanner le QR code du client (ou taper son code) pour voir quoi remettre et combien encaisser, puis toucher « Remis au client ».
- Maquette ④ à ⑧ (sauf « Trop d'essais »), en français.

### US-26.4 — Bouton « Mon QR code » dans le message « commande prête »
En tant que client, je veux ouvrir mon QR code depuis le message WhatsApp « commande prête ».
- Modèle `oranpromo_commande_prete_retrait` à faire approuver par Meta ; réglage `bouton_retrait` à `on` ensuite. Sans le réglage, l'ancien message part, inchangé.

## Module 14 — Parrainage (après le MVP)

Source : demande du propriétaire du 9 octobre 2026 (« une section ou une page pour promouvoir le parrainage ; à l'inscription, un client peut donner le numéro WhatsApp de son parrain pour gagner des promos »). Conception (PR #67) puis **décisions du propriétaire du 9/10 à 19 h 16** (ci-dessous) : récompense **A, bon OranPromo de 300 DA**. Conception technique : `docs/architecture.md`, section « Parrainage (US-27) ». Maquette : `docs/maquettes/Parrainage.dc.html`. (Le module 13 est le retrait par QR code, US-26.)

**Ordre** : US-27 se code **après US-26** (retrait par QR code), car le parrainage n'est validé, et un bon n'est remboursé, que sur une commande remise par **QR code ou code à 4 chiffres**. Rien n'est codé pour l'instant.

**Décisions du propriétaire (9 octobre 2026, 19 h 16)** :
1. **Récompense : option A**. Un **bon OranPromo de 300 DA** pour le parrain **et** un pour le filleul, déduit **en caisse** sur une commande suivante, puis **remboursé chaque mois par OranPromo à la boutique**. Les options B (bon offert par la boutique) et C (Club) sont abandonnées.
2. Le parrain se donne **dans les 7 jours** après l'inscription et **avant la première commande**.
3. Le premier retrait du filleul doit avoir lieu **dans les 60 jours** après son inscription.
4. Au plus **5 parrainages récompensés par parrain et par mois**.
5. La première commande du filleul doit faire **au moins 2 000 DA**.
6. **Pas de message WhatsApp** au parrain : tout se voit dans `/compte`.
7. La première commande du filleul doit être **remise par QR code ou par code à 4 chiffres** (US-26). Une remise « Remis sans QR code » ne valide pas le parrainage.
8. Le parrain voit le **prénom et l'initiale** du filleul validé.
9. On garde le **tutoiement** sur les pages du parrainage.
10. Textes arabes : **validés tels que proposés** (les textes du bon, n° 15 à 24, sont nouveaux : à relire).

### US-27 — Parrainer un ami et être parrainé (vue d'ensemble) — **décisions prises le 9/10, en cours de code (US-26 fusionnée)**
En tant que client, je veux inviter mes amis sur OranPromo avec mon lien ou mon numéro WhatsApp, et qu'on reçoive chacun un bon de 300 DA quand ils viennent chercher leur première commande, afin de faire connaître le site autour de moi.
En tant que propriétaire, je veux que le parrainage fasse venir de **vrais clients qui viennent en boutique**, avec une **dépense plafonnée**, des boutiques **remboursées sans erreur**, et sans révéler qui est inscrit.

Livrée en 5 sous-stories, dans cet ordre (une PR chacune) :

| Story | Contenu | Écrans |
| --- | --- | --- |
| US-27.1 | Base : code de parrainage, table `parrainages`, choix du parrain sans révéler si un numéro existe, validation au premier retrait par QR code ou code, plafonds, budget, table `bons`, interrupteur `parrainage` | aucun écran |
| US-27.2 | Saisie du parrain (numéro WhatsApp ou code) avant la première commande ou dans `/compte` ; lien d'invitation `/p/<code>` | `/compte`, `/panier`, `/p/[code]` |
| US-27.3 | Page `/parrainage`, bloc « Mon parrainage » et « Mes bons » dans `/compte`, bloc d'accueil, invitation après un retrait | `/parrainage`, `/compte`, `/`, `/compte/commandes/[id]` |
| US-27.4 | Bon dans la commande : choix au panier, montant à payer, bon visible par la boutique et sur le QR code, appliqué à la remise | `/panier`, `/compte/commandes/[id]`, `/retrait/[jeton]`, `/espace/commandes`, `/espace/retrait/[jeton]`, `/espace/scanner` |
| US-27.5 | Admin : parrainages et signaux, relevés mensuels par boutique, export CSV, « Marquer comme payé », budget mensuel ; bloc « Bons à rembourser » de la boutique | `/admin/parrainages`, `/admin/remboursements`, `/espace` |

**Ce qui ne change pas** : les règles de blocage, de no-show, de contestation et de vérification du numéro (US-20.4, US-21) restent **exactement** les mêmes, ainsi que `passer_commande` et `changer_statut_commande`. Le parrainage **lit** le numéro vérifié et la remise par QR code (US-26) ; il ne débloque personne, ne retire aucun no-show et ne donne aucune commande en plus.

**Règles** :
- **Qui peut parrainer** : un compte `client` avec un **numéro vérifié par code** (US-21), non bloqué, non exclu du parrainage. Commerçants, ambassadeurs et admin : jamais.
- **Qui peut être parrainé** : un **nouveau** compte client avec un numéro vérifié, inscrit depuis **7 jours au plus**, **sans aucune commande**, dont le numéro vérifié n'a **jamais** servi à un autre filleul.
- **Un seul parrain par compte**. On peut corriger sa saisie **2 fois** (3 saisies au plus) tant qu'aucune commande n'est passée ; ensuite c'est figé (l'admin peut corriger).
- **Refusés** : son propre numéro ou son propre code (« C'est ton propre numéro : choisis le numéro d'un ami. ») ; un parrain qui est le filleul de son filleul (boucle A ↔ B) : refus **silencieux**.
- **Pas d'énumération** : la réponse est **la même** que le numéro soit celui d'un client ou non : « C'est noté. Si ce numéro est celui d'un client OranPromo, il deviendra ton parrain après ton premier retrait en boutique. ». Un numéro qui ne correspond à aucun parrain possible **n'est pas enregistré**. OranPromo **n'écrit jamais** au numéro saisi.
- **Validation** : seule la **première commande récupérée** du filleul compte. Le parrainage est **validé** si elle est remise **par QR code ou par code à 4 chiffres** (US-26, `commandes.mode_remise` = `qr` ou `code` ; `manuel` = « Remis sans QR code »), avec un **total d'au moins 2 000 DA**, au plus **60 jours** après l'inscription. Si cette première commande récupérée ne remplit pas ces conditions (remise « sans QR code », moins de 2 000 DA, après 60 jours), le parrainage passe `non_valide` : une commande suivante ne le rattrape pas. Une commande annulée ou expirée ne compte pas (le parrainage reste en attente tant que le délai de 60 jours court). Inscription seule : rien.
- **Récompense** : à la validation, la base crée **un bon de 300 DA pour le filleul** et **un bon de 300 DA pour le parrain**, sauf :
  - parrain au **plafond** (5 parrainages récompensés ce mois civil, heure d'Alger) : bon du filleul seulement, statut `plafond` ;
  - parrain bloqué ou exclu au moment de la validation : bon du filleul seulement, statut `refuse` ;
  - **budget du mois** atteint : les bons attendent (statut `en_file`) et sont créés **le 1er du mois suivant**, dans l'ordre des validations, tant que le nouveau budget le permet ; le client voit « Ton bon arrive le 1er novembre (budget du mois atteint). ».
- **Interrupteur** : réglage `parrainage` dans `prive.reglages`, désactivé par défaut ; il ne sert qu'en mode téléphone (US-21). Budget à 0 = aucun nouveau bon (les parrainages restent comptés et les bons en file).

**Le bon de 300 DA** (règles, détail dans `docs/architecture.md`) :
- **Valable 60 jours** après sa création, dans **toutes les boutiques** OranPromo validées (sauf une boutique que l'admin a retirée des bons), **attaché au compte** (pas transférable, pas de code à recopier : il ne s'utilise que sur une commande passée par ce compte).
- **Un seul bon par commande**, sur une commande d'au moins **1 000 DA** (proposition, voir « Question restante ») ; jamais de monnaie rendue ni de reste : 300 DA de moins sur le total, c'est tout. Pas de bon sur sa première commande (le filleul n'en a pas encore).
- **Choisi au panier** : « Utiliser mon bon parrainage (−300 DA) », coché par défaut quand le client a un bon et que le total atteint 1 000 DA ; le panier affiche « Total 3 500 DA · Bon parrainage −300 DA · À payer en boutique 3 200 DA ». Le bon le plus proche de sa fin est utilisé en premier.
- **Réservé** dès la commande (il ne peut pas servir deux fois en même temps) ; **rendu** au client si la commande est annulée ou expire (avec au moins 7 jours de validité restante : sa fin est repoussée si besoin) ; **utilisé** seulement quand la commande est remise **par QR code ou code**.
- **Commande remise « sans QR code »** : le bon **ne s'applique pas** ; la confirmation le dit à la boutique (« Sans QR code ni code, le bon ne s'applique pas : encaissez 3 500 DA. Le bon reste au client. ») ; le bon est rendu au client ; rien à rembourser.
- La boutique voit le bon **partout où elle voit la commande** : liste des commandes (« Bon parrainage −300 DA · à encaisser 3 200 DA »), résumé du scan (« Sous-total 3 500 DA · Bon parrainage OranPromo −300 DA · **À encaisser en espèces : 3 200 DA** » et « Ces 300 DA vous sont remboursés par OranPromo sur le relevé de novembre. »). Le client et le proche le voient sur le QR code (« À payer en espèces : 3 200 DA (bon −300 DA déduit) »).
- **Remboursement** : chaque bon utilisé devient une ligne du **relevé mensuel** de la boutique (mois de la remise, heure d'Alger). Le 1er du mois, le relevé du mois passé est **clôturé** ; l'admin l'exporte en CSV, fait le virement (CCP, BaridiMob, en dehors du site), puis **« Marquer comme payé »** avec la référence du virement. La boutique voit ses relevés dans `/espace`. Objectif : payé avant le 10 du mois.
- Messages WhatsApp : **aucun nouveau modèle**. Le message « nouvelle commande » à la boutique (modèle existant, Utilitaire) garde son texte ; son 4e paramètre (le total) devient « 3 200 DA à encaisser (bon parrainage −300 DA) » pour une commande avec bon : information sur la commande, pas de promotion.

### US-27.1 — Parrainage et bons dans la base (aucun écran) — **codée** (migration `20261012090000_parrainage.sql`)
En tant que propriétaire, je veux que les règles du parrainage et des bons soient dans la base, afin qu'un bug d'écran ou un appel direct ne puisse pas les contourner.
- Code de parrainage de 6 caractères (sans 0/O, 1/I/L), unique, créé à la première demande ; ni numéro ni nom dedans.
- `choisir_parrain(saisie)` : numéro algérien (formats de US-21) **ou** code ; toutes les règles ci-dessus ; réponse `enregistre` identique qu'un parrain soit trouvé ou non ; erreurs seulement sur le filleul lui-même (numéro mal écrit, son propre numéro, délai passé, commande déjà passée, numéro non vérifié, 3 saisies).
- Validation par déclencheur au passage `prete → recuperee` de la **première commande récupérée** du filleul, d'après `commandes.mode_remise` (US-26, décision 8 : `qr` ou `code`) : contrôles (2 000 DA, 60 jours, plafond, parrain bloqué ou exclu, budget) puis création des bons (ou mise en file). Une première commande récupérée « sans QR code » (`mode_remise = 'manuel'`) → `non_valide`.
- Bons : `utiliser_bon(commande)` (client de la commande, juste après `passer_commande`, commande `demandee`, sans bon, total ≥ 1 000 DA), rendu automatique à l'annulation et à l'expiration, utilisation à la remise par QR code ou code, rendu à la remise sans QR code.
- Budget : `regler_budget_parrainage(montant)` (admin), lecture du budget utilisé ; tâche `pg_cron` du 1er du mois (bons en file, clôture des relevés) et quotidienne (bons expirés, parrainages `en_attente` de plus de 60 jours → `expire`).
- Tests SQL : énumération (même résultat pour numéro inconnu, de commerçant, compte bloqué, client valide), propre numéro, boucle, un seul parrain, 3 saisies, 7 jours, commande déjà passée, numéro déjà filleul ; validation seulement à la remise par QR code ou code de la **première** commande ≥ 2 000 DA (pas à `prete`, pas « sans QR code », pas < 2 000 DA, pas après 60 jours) ; plafond de 5 ; budget (file, création le 1er dans l'ordre) ; un bon par commande, 1 000 DA minimum, bon d'un autre compte refusé, bon réservé non réutilisable, rendu à l'annulation / expiration / remise sans QR code, expiré non utilisable ; ligne de relevé créée seulement à la remise par QR code ou code ; relevé payé non modifiable ; `passer_commande`, `changer_statut_commande` et toutes les règles de blocage / no-show / vérification **inchangées** (définitions comparées par `pg_get_functiondef`).

### US-27.2 — Donner le numéro de mon parrain (pages `/compte`, `/panier`, `/p/[code]`) — **codée**
En tant que nouveau client, je veux indiquer le numéro WhatsApp (ou le code) de l'ami qui m'a fait connaître OranPromo, afin qu'on reçoive chacun un bon.
- Champ **« Ton parrain (facultatif) : son numéro WhatsApp ou son code »** sur le formulaire « Nom » demandé avant la première commande (`/panier`) et dans `/compte` (bloc « Ton parrain ») tant que les règles le permettent (7 jours, aucune commande) ; ensuite le bloc disparaît.
- Lien **`/p/<code>`** : cookie `parrain` (code seul, 30 jours), puis `/parrainage` avec « Un ami t'invite sur OranPromo » ; champ pré-rempli, le client touche quand même « Valider ». Code inconnu ou mal formé : même page.
- Après « Valider » : toujours « C'est noté… » ; « Parrain enregistré » et « Modifier » (2 fois au plus, avant la première commande).
- Rappel sous le champ : « Ton bon et celui de ton parrain arrivent après ta première commande d'au moins 2 000 DA, récupérée en boutique avec ton QR code. »
- Tests Vitest : normalisation numéro / code, cookie de `/p/<code>`, champ pré-rempli, même message pour tout numéro valide, bloc masqué après une commande.

### US-27.3 — Page « Parrainage », mes filleuls et mes bons (pages `/parrainage`, `/compte`, `/`, `/compte/commandes/[id]`) — **codée**
En tant que client, je veux comprendre le parrainage en 10 secondes, partager mon lien sur WhatsApp et voir mes bons, afin d'inviter mes amis et d'utiliser ce que j'ai gagné.
- **`/parrainage`** (publique) : « Parraine tes amis », les 3 étapes (1. Partage ton lien ; 2. Ton ami s'inscrit avec son numéro WhatsApp et te choisit comme parrain ; 3. Quand il récupère sa première commande d'au moins 2 000 DA en boutique avec son QR code, **vous recevez chacun un bon de 300 DA**), les règles courtes (numéro vérifié, pas soi-même, 5 amis récompensés par mois, bon valable 60 jours, un bon par commande d'au moins 1 000 DA, à déduire en boutique). Connecté avec un numéro vérifié : code, lien `/p/<code>`, « Copier le lien », « Partager sur WhatsApp » (`wa.me/?text=…` sans numéro), QR code du lien. Non connecté : « Connecte-toi pour avoir ton lien ».
- **`/compte`, « Mon parrainage »** : code, Copier / Partager, compteurs (« 2 amis ont fait leur premier retrait · 1 en attente »), liste des parrainages validés (« Samir B. · 12 oct. · bon de 300 DA ») ; « plafond du mois atteint » quand c'est le cas.
- **`/compte`, « Mes bons »** : chaque bon (« Bon parrainage · 300 DA · valable jusqu'au 11 décembre »), état (disponible, réservé pour la commande n° 128, utilisé le … chez …, expiré), bons en file (« arrive le 1er novembre ») ; phrase : « À utiliser au panier : 300 DA de moins, payés par OranPromo à la boutique. ».
- **Accueil** : bloc texte « Parraine tes amis · 300 DA chacun » sous « Les boutiques sur la carte ».
- **Après un retrait** : encadré « Merci ! Fais découvrir OranPromo à un ami : 300 DA chacun » sur le suivi d'une commande récupérée. Rien dans les messages WhatsApp.
- En arabe (US-23) : textes du tableau ci-dessous, de droite à gauche.
- Tests Vitest : lien et message de partage, code seulement pour un numéro vérifié, compteurs, liste sans numéro, « Mes bons » (états, dates), bloc d'accueil, encadré seulement sur une commande récupérée, textes fr / ar (mêmes clés).

### US-27.4 — Utiliser mon bon et le faire déduire en boutique (pages `/panier`, `/compte/commandes/[id]`, `/retrait/[jeton]`, `/espace/commandes`, `/espace/retrait/[jeton]`, `/espace/scanner`) — **codée** (client et boutique)
En tant que client, je veux que mon bon soit déduit sans rien avoir à dire en caisse ; en tant que commerçant, je veux voir clairement combien encaisser et savoir que les 300 DA me seront remboursés.
- **Panier** : case « Utiliser mon bon parrainage (−300 DA) » (cochée par défaut si un bon est disponible et le total ≥ 1 000 DA ; absente sinon, avec « Ton bon s'utilise dès 1 000 DA d'achat. » si le total est plus bas). Lignes « Total », « Bon parrainage −300 DA », « **À payer en boutique** ». À la commande, l'action serveur appelle `passer_commande` puis `utiliser_bon` ; si le bon n'a pas pu être appliqué (expiré entre-temps…), la commande reste valable au prix plein et le suivi l'affiche (« Bon non appliqué : il a expiré. ») — le client peut annuler s'il le souhaite.
- **Suivi de commande et QR code** (client et proche, US-26) : « Bon parrainage −300 DA » et « À payer en espèces : 3 200 DA ».
- **Boutique, liste des commandes** : sous le total, « Bon parrainage −300 DA · à encaisser 3 200 DA ».
- **Boutique, résumé du scan** (US-26.3) : lignes, « Sous-total 3 500 DA », « Bon parrainage OranPromo −300 DA », **« À encaisser en espèces : 3 200 DA »** en grand, et « Ces 300 DA vous sont remboursés par OranPromo (relevé de novembre). ». « Remis au client » : le bon est utilisé, la ligne de relevé est créée.
- **Boutique, « Remis sans QR code »** sur une commande avec bon : confirmation propre : « Sans QR code ni code, le bon ne s'applique pas : encaissez 3 500 DA. Le bon reste au client. » ; après la remise, le bon est rendu au client.
- Tests Vitest : case du panier (cochée, absente, sous 1 000 DA), montants, appel `utiliser_bon` après `passer_commande` (et commande gardée si le bon échoue), affichage client / proche / boutique / scan, confirmation « sans QR code ».

### US-27.5 — Rembourser les boutiques et suivre le parrainage (pages `/admin/parrainages`, `/admin/remboursements`, `/espace`)
En tant qu'admin, je veux savoir chaque mois combien rembourser à chaque boutique, l'exporter, noter que c'est payé, et repérer la triche ; en tant que commerçant, je veux voir ce qu'OranPromo me doit.
- **`/admin/remboursements`** : choix du mois ; une ligne par boutique : nombre de bons, montant (« 4 bons · 1 200 DA »), état (`en_cours` pour le mois courant, `a_payer` après clôture le 1er, `paye` avec date et référence), signaux. Détail d'un relevé : commandes (n°, date de remise, QR code ou code, client prénom + initiale, total, bon). Boutons :
  - **« Exporter CSV »** (un mois, toutes les boutiques ou une seule) ;
  - **« Marquer comme payé »** (référence du virement obligatoire, date ; confirmation ; un relevé payé n'est plus modifiable) ;
  - **« Mettre de côté »** une ligne suspecte (motif) : elle sort du relevé à payer et attend une décision (« Rembourser » la remet sur le relevé suivant, « Refuser » la retire, motif gardé).
- **Budget du mois** (en haut de `/admin/remboursements` et de `/admin/parrainages`) : « Budget d'octobre : 9 600 DA émis sur 30 000 DA » ; champ « Budget mensuel (DA) » + « Enregistrer » (admin) ; 0 = plus de nouveau bon. Les bons émis comptent (pas seulement les bons utilisés) : c'est le plafond de ce qu'OranPromo peut avoir à payer.
- **`/admin/parrainages`** : liste (parrain et filleul : nom, numéro masqué ; inscription, validation ; boutique, total, mode de remise ; statut `en_attente`, `valide`, `plafond`, `en_file`, `non_valide`, `expire`, `refuse`, `annule`), signaux, actions « Annuler les bons » (seulement s'ils ne sont pas utilisés ; motif), « Exclure du parrainage », « Retirer la boutique des bons » (ses nouvelles commandes ne peuvent plus porter de bon ; elle est prévenue par l'admin hors du site).
- **`/espace`, bloc « Bons parrainage à rembourser »** (commerçant) : mois en cours (« 4 bons · 1 200 DA »), relevés passés (« Septembre : 2 400 DA · payé le 05/10, réf. … » ou « à payer avant le 10/10 »), lien vers le détail (commandes de sa boutique seulement).
- Tests Vitest et SQL : relevé = somme des bons utilisés du mois par boutique (heure d'Alger), clôture le 1er, CSV (colonnes, séparateur, montants), « Marquer comme payé » réservé à l'admin et définitif, ligne mise de côté hors du total, budget (lecture, réglage admin seulement), bloc commerçant limité à sa boutique.

**Textes en français et en arabe** (arabe simple avec des mots de darja d'Oran en gras, masculin générique ; n° 1 à 4 et 6 à 12, 14 **validés** ; 5, 13 et 15 à 24 **nouveaux** avec le bon : à relire) :

| # | Où | Français | Arabe | Variante en arabe standard |
| --- | --- | --- | --- | --- |
| 1 | Page, titre | Parraine tes amis | **عرّض** صحابك | ادعُ أصدقاءك |
| 2 | Étape 1 | Partage ton lien sur WhatsApp. | **ابعث** الرابط **نتاعك** لصحابك على واتساب. | أرسل رابطك إلى أصدقائك عبر واتساب. |
| 3 | Étape 2 | Ton ami s'inscrit avec son numéro et te choisit comme parrain. | صاحبك يتسجّل **بنمرتو** ويكتب **نمرتك** ولا الكود **نتاعك**. | يسجّل صديقك برقمه ويختارك عرّابًا. |
| 4 | Étape 3 | Quand il récupère sa première commande en boutique, vous gagnez tous les deux. | **كي يدّي** أول طلب من **الحانوت**، **تربحو بجوج**. | عندما يستلم أول طلب من المحل، تربحان معًا. |
| 5 | Récompense (nouveau) | Un bon de 300 DA chacun, à déduire en boutique. | **بون** تاع 300 دج لكل واحد، **ينقص** من **الخلاص** في **الحانوت**. | قسيمة بقيمة 300 دج لكل واحد، تُخصم في المحل. |
| 6 | Bouton | Partager sur WhatsApp | **ابعث** على واتساب | شارك عبر واتساب |
| 7 | Bouton | Copier le lien | انسخ الرابط | انسخ الرابط |
| 8 | Champ | Ton parrain (facultatif) : son numéro WhatsApp ou son code | **اللي عرضك** (**إلا حبيت**): **النمرة** نتاع الواتساب **ولا** الكود | العرّاب (اختياري): رقم واتساب أو الرمز |
| 9 | Après « Valider » | C'est noté. Si ce numéro est celui d'un client OranPromo, il deviendra ton parrain après ton premier retrait en boutique. | **تسجّلت**. **إلا** كانت هاد **النمرة** نتاع زبون في OranPromo، **يولّي** هو **اللي عرضك** من بعد أول طلب **تدّيه** من **الحانوت**. | تم التسجيل. إذا كان هذا الرقم لزبون في OranPromo، فسيصبح عرّابك بعد أول استلام من المحل. |
| 10 | Erreur | C'est ton propre numéro : choisis le numéro d'un ami. | هادي **نمرتك** أنت: **ختار** **نمرة** صاحبك. | هذا رقمك أنت: اختر رقم صديقك. |
| 11 | `/compte` | 2 amis ont fait leur premier retrait · 1 en attente | 2 صحاب **دّاو** أول طلب · 1 **مازال** | صديقان استلما أول طلب · 1 في الانتظار |
| 12 | Invitation | Un ami t'invite sur OranPromo | صاحبك **عرضك** لـ OranPromo | صديقك يدعوك إلى OranPromo |
| 13 | Accueil, bloc (nouveau) | Parraine tes amis · 300 DA chacun | **عرّض** صحابك · 300 دج لكل واحد | ادعُ أصدقاءك · 300 دج لكل واحد |
| 14 | Après un retrait | Merci ! Fais découvrir OranPromo à un ami. | **يعطيك الصحة**! **عرّف** صاحبك بـ OranPromo. | شكرًا! عرّف صديقك على OranPromo. |
| 15 | `/compte`, titre | Mes bons | **البونات** نتاعي | قسائمي |
| 16 | Bon | Bon parrainage · 300 DA · valable jusqu'au 11 décembre | **بون** العرضة · 300 دج · صالح حتى 11 ديسمبر | قسيمة الدعوة · 300 دج · صالحة حتى 11 ديسمبر |
| 17 | Panier, case | Utiliser mon bon parrainage (−300 DA) | **خدم** بالبون نتاعي (−300 دج) | استعمل قسيمتي (−300 دج) |
| 18 | Panier, total | À payer en boutique | **تخلّص** في **الحانوت** | المبلغ المطلوب في المحل |
| 19 | Panier, sous 1 000 DA | Ton bon s'utilise dès 1 000 DA d'achat. | البون **يخدم** من 1000 دج **وفوق**. | تُستعمل القسيمة ابتداءً من 1000 دج. |
| 20 | Bon en file | Ton bon arrive le 1er novembre (budget du mois atteint). | البون نتاعك **يجيك** نهار 1 نوفمبر (**الميزانية** تاع الشهر **كملت**). | ستصلك القسيمة يوم 1 نوفمبر (ميزانية الشهر نفدت). |
| 21 | Bon, réservé | Réservé pour la commande n° 128 | **محجوز** للطلب رقم 128 | محجوزة للطلب رقم 128 |
| 22 | Bon, utilisé | Utilisé le 12/10 chez Boutique Nour | **تخدم** نهار 12/10 عند Boutique Nour | استُعملت يوم 12/10 لدى Boutique Nour |
| 23 | Bon, expiré | Expiré le 11/12 | **فات وقتو** نهار 11/12 | انتهت صلاحيتها يوم 11/12 |
| 24 | Rappel sous le champ du parrain | Ton bon et celui de ton parrain arrivent après ta première commande d'au moins 2 000 DA, récupérée en boutique avec ton QR code. | البون نتاعك ونتاع **اللي عرضك** **يجيو** من بعد أول طلب تاع 2000 دج **وفوق**، **تدّيه** من **الحانوت** بالـ QR نتاعك. | تصل قسيمتك وقسيمة عرّابك بعد أول طلب بقيمة 2000 دج على الأقل، تستلمه من المحل برمز QR. |

L'espace commerçant et l'administration restent en français (US-23).

**Questions restantes** — **réponses du propriétaire (9/10, 19 h 38) : les réponses par défaut** (1 000 DA ; 30 000 DA ; aucune donnée bancaire dans la base ; accord écrit avec les boutiques à signer par le propriétaire avant d'activer `parrainage`). Questions d'origine :
1. Montant minimum d'une commande pour **utiliser** un bon : 1 000 DA (proposé) ?
2. Budget mensuel de départ : combien ? (proposé : **30 000 DA**, soit 50 parrainages complets par mois ; à 0, aucun bon n'est créé)
3. Coordonnées de virement des boutiques (CCP, RIB, BaridiMob) : gardées **hors du site** par le propriétaire au lancement (proposé : aucune donnée bancaire dans la base) ?
4. Accord écrit avec chaque boutique (elle accepte les bons, OranPromo rembourse avant le 10 du mois suivant, OranPromo peut refuser une ligne suspecte) : à préparer par le propriétaire avant d'activer `parrainage` (proposé).

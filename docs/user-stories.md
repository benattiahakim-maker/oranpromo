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
| US-20.4 | Expiration après 24 h, no-shows et blocage | `/admin/clients` |
| US-20.5 | Messages WhatsApp automatiques (API WhatsApp Business) | aucun écran |

**Statuts d'une commande** (règles dans la base) :

| Statut | Signification | Qui le donne | Depuis |
| --- | --- | --- | --- |
| `demandee` | le client a envoyé la commande | client | — |
| `confirmee` | la boutique a les articles : **le stock baisse** | boutique | `demandee` |
| `prete` | préparée : le client a **24 h** pour venir | boutique | `confirmee` |
| `recuperee` | venu et payé en boutique (fin) | boutique | `prete` |
| `annulee` | annulée avec un motif (fin) ; le stock revient si elle était confirmée ou prête | client (`demandee`, `confirmee`) ou boutique (`demandee`, `confirmee`, `prete`) | |
| `expiree` | pas venu sous 24 h (fin) ; le stock revient, +1 no-show | automatique | `prete` |

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
- À la première commande, je saisis mon nom et mon numéro de téléphone (format algérien, WhatsApp), gardés dans mon profil (`/compte`).
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
- Confirmer baisse le stock de chaque ligne (jamais sous 0) ; annuler une commande confirmée ou prête remet le stock.
- Après une annulation « Plus en stock », un lien mène à « Mes articles » pour corriger les quantités.
- La base refuse toute transition non prévue, et toute commande d'une autre boutique (règle dans la base).
- La navigation de l'espace affiche « Commandes » avec le nombre de commandes à confirmer.
- Maquette : `CommandesRecues.dc.html`.

### US-20.4 — Expiration, no-shows et blocage (page `/admin/clients`)
En tant que propriétaire de la plateforme, je veux repérer les clients qui ne viennent pas chercher leurs commandes, afin de protéger les boutiques.
- Une commande `prete` depuis 24 h passe automatiquement `expiree` (tâche planifiée toutes les 15 minutes dans la base, `pg_cron`) ; le stock revient.
- Chaque commande expirée ajoute 1 no-show au client. Il est averti à chaque fois (WhatsApp, US-20.5, et sur `/compte`) du nombre d'essais restants.
- Au 5e no-show, le compte est bloqué automatiquement : il ne peut plus commander, et `/compte` l'explique.
- `/admin/clients` (admin seulement) liste les clients bloqués puis ceux qui ont des no-shows (nom, téléphone, no-shows, date de blocage) ; « Débloquer » remet le compteur à 0.
- Maquette : `ClientsBloques.dc.html`.

### US-20.5 — Messages WhatsApp automatiques
En tant que boutique et client, je veux être prévenu sur WhatsApp, afin de ne pas rater une commande.
- Messages : nouvelle commande → boutique ; commande prête → client (avec l'heure limite) ; commande expirée → client (rappel ferme mais poli + essais restants) ; compte bloqué → client.
- Chaque message est d'abord enregistré dans la base (`messages_whatsapp`, statut `a_envoyer`), créé par la base au changement de statut, puis envoyé côté serveur par l'API WhatsApp Business (Meta Cloud API) avec des modèles de message approuvés par Meta.
- Sans configuration (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` vides), rien n'est envoyé : les messages restent `a_envoyer`.
- Un envoi raté est retenté (5 essais au plus), puis marqué `echec`. Une panne WhatsApp ne bloque jamais une commande.
- Le fournisseur est isolé (`lib/notifications/`) pour pouvoir passer à Twilio sans toucher au reste.

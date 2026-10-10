# Tests manuels de BleDeal, fonction par fonction

Scénarios de test à suivre **avant la mise en ligne**, et après chaque grosse modification.

**Où tester** : sur l'adresse fixe de la preview, `https://test.bledeal.com` (`docs/guide-mise-en-ligne.md`, étape 1.5). Tant que `bledeal.com` n'est pas acheté, remplacez-la par l'adresse de preview donnée par le développeur.

**Comment noter** :
- cochez `- [ ]` → `- [x]` quand le résultat attendu est constaté ;
- si un résultat diffère, notez la date, l'heure, le compte, le numéro de commande, et faites une capture.

> ⚠️ **La preview et la production partagent la même base Supabase.** Tout ce que vous créez ici existe aussi en production : comptes, commandes, no-shows, signalements, parrainages, bons.
> - Utilisez uniquement des comptes et une boutique **de test**.
> - Faites le ménage à la fin (section 8).
> - Les réglages de la base (`connexion_client`, `bouton_confirmer`, `bouton_retrait`, `modeles_arabes`, `parrainage`) et l'ouverture des villes valent **aussi pour la production**.

Ne copiez jamais de secret (clé, jeton, mot de passe) dans ce fichier ni dans un message. Utilisez uniquement des emplacements comme `<CRON_SECRET>`.

Les noms techniques `oranpromo_*` (modèles WhatsApp) sont **voulus** : ils ne se voient pas côté client.

---

## 0. Préparation

- [ ] **Configuration faite.** Étapes 1 à 12 du guide de mise en ligne terminées, et dernier déploiement de la preview **après** le dernier changement de variable.
- [ ] **Empreintes vérifiées.** Dans Supabase › SQL Editor : `select cle, length(valeur) from prive.reglages where cle like 'jeton_%' order by cle;`
  - Attendu : `jeton_codes_telephone`, `jeton_confirmation`, `jeton_notifications`, `jeton_visiteurs`, chacune de longueur 64.
  - ⚠️ Sans **`jeton_notifications`** (empreinte de `CRON_SECRET`, **absente au 10/10**), **aucun message WhatsApp ne part**. Tous les tests WhatsApp ci-dessous échoueront : faire d'abord l'étape 3 du guide.
- [ ] **État des interrupteurs.** `select cle, valeur from prive.reglages where cle in ('connexion_client','bouton_confirmer','bouton_retrait','modeles_arabes','parrainage','parrainage_budget_mois');`
  - Noter le résultat. Plusieurs tests en dépendent.
- [ ] **Comptes de test.** Préparer :
  - **Admin** : votre compte administrateur.
  - **Boutique T** : un compte commerçant avec une boutique de test **validée, à Oran, avec une position sur la carte**. Au moins 4 articles en stock : un en promo, un avec 1 seule pièce, un avec plusieurs tailles, un à 2 000 DA ou plus (pour le parrainage).
  - **Client A** et **Client B** : deux comptes clients, chacun avec un numéro de mobile algérien (05/06/07) **différent**, sur lequel vous recevez WhatsApp.
  - **Pour la limite « 20 par heure »** (section 5.2) : jusqu'à 7 comptes clients. Test **lourd et facultatif**.
- [ ] **Deux appareils.** Un téléphone (client) et un ordinateur (boutique ou admin), ou deux navigateurs dont un en navigation privée.
  - Pour le scanner (2.4) : un **Android** et un **iPhone**.
- [ ] **Accès Supabase.** **Table Editor** pour suivre `commandes`, `messages_whatsapp`, `evenements`, `signalements`, `parrainages`, `bons`.

---

## 1. Parcours client

### 1.1 BleDeal, villes et accueil (US-29, US-30)

- [ ] **Redirection vers la ville.** Ouvrir `https://test.bledeal.com/` sur téléphone.
  - Attendu : on arrive sur `https://test.bledeal.com/oran` (Oran est la seule ville ouverte).
  - Attendu : le logo **« BleDeal »**, le titre « Les promos d’Oran », la ligne « Réservez sur WhatsApp · Payez en boutique » et le bouton « Voir les promos ».
  - Attendu : les rubriques « En ce moment » / « Tout voir », « Les boutiques sur la carte » / « Voir la carte » et le lien « Espace commerçant ».
- [ ] **Anciennes adresses.** Ouvrir `/catalogue?univers=beaute`, puis `/carte`.
  - Attendu : redirection vers `/oran/catalogue?…` et `/oran/carte`, filtres gardés.
- [ ] **Ville fermée ou inconnue.** Ouvrir `/tlemcen`, puis `/xyz`.
  - Attendu : page `/villes` avec « Cette ville n’est pas encore sur BleDeal. ».
- [ ] **Page des villes.** Ouvrir `/villes`.
  - Attendu : « Choisissez votre ville », seule **Oran** proposée, avec son nombre de boutiques.
  - Choisir Oran → retour sur `/oran`.
- [ ] **Me localiser (facultatif).** Toucher « Me localiser ».
  - Attendu : « Vous êtes près de Oran. » (à Oran), ou « Pas encore de boutiques BleDeal près de vous… ».
  - Attendu : la phrase « Votre position reste sur votre téléphone… » est affichée.
- [ ] **Pas de bouton de ville.** Avec une seule ville ouverte, l'en-tête n'affiche **pas** « Oran ▾ ».
- [ ] **Redirection fermée (sécurité).** Ouvrir `/villes?retour=//exemple.com`, puis choisir Oran.
  - Attendu : on reste sur `test.bledeal.com` (page `/oran`), jamais sur `exemple.com`.
- [ ] **Liens.** « Voir les promos » puis « Tout voir ».
  - Attendu : le catalogue `/oran/catalogue` s'ouvre, promos en premier.
- [ ] **Affichage mobile.** En mode portrait :
  - Attendu : rien ne déborde. Dans l'en-tête, le lien « Carte » et l'**icône de sac** du panier (avec le nombre d'articles).

### 1.2 Vitrine et fiche article

- [ ] **Vitrine.** Ouvrir `https://test.bledeal.com/b/<slug-boutique-T>`.
  - Attendu : nom de la boutique, boutons « WhatsApp » et « Itinéraire », titre « Articles disponibles · promos en premier ».
- [ ] **Boutique non validée ou suspendue.** Ouvrir sa vitrine.
  - Attendu : « Boutique indisponible » et « Retour à l’accueil ».
- [ ] **Fiche article.** Ouvrir une fiche.
  - Attendu : photos, prix (barré si promo), « Taille », « Quantité », « Ajouter au panier ».
  - Attendu : « La boutique confirme votre commande. Paiement en boutique. » et « Une question ? WhatsApp ».
- [ ] **Message WhatsApp pré-rempli.** Toucher « Une question ? WhatsApp ».
  - Attendu : le message se termine par « (vu sur BleDeal) ».
- [ ] **Article vendu.** Ouvrir un article à 0.
  - Attendu : « Article plus disponible » ou « Cet article a été vendu », sans bouton de commande.

### 1.3 Vues, clics et « Signaler » (`VISITEURS_SECRET`) — urgent

> Sans `VISITEURS_SECRET` et l'empreinte `jeton_visiteurs`, rien n'est enregistré, et « Signaler » répond « pas disponible ».

- [ ] **Vue enregistrée.** En navigation privée, ouvrir la vitrine T puis une fiche.
  - Attendu : une ligne dans `evenements` en moins d'une minute.
- [ ] **Clic « Ajouter au panier ».** Choisir taille et quantité, puis « Ajouter au panier ».
  - Attendu : une nouvelle ligne dans `evenements`. C'est le chiffre « Clics « Réserver » » de l'espace boutique.
- [ ] **Pas de double comptage.** Recharger 3 fois la même fiche en moins de 10 minutes.
  - Attendu : une seule vue par visiteur toutes les 10 minutes.
- [ ] **Statistiques.** Compte Boutique T, `/espace/statistiques`, 7 puis 30 jours.
  - Attendu : « Vues de la vitrine », « Vues des articles », « Clics « Réserver » » ont augmenté.
  - Attendu : l'article figure dans « Les 5 articles les plus vus ».
- [ ] **Signaler.** Fiche › « Signaler cet article » › motif « Autre » › commentaire › « Envoyer le signalement ».
  - Attendu : « Merci, nous allons vérifier. ».
  - Échec typique : « Le signalement n’est pas disponible pour le moment. Réessayez plus tard. ». `VISITEURS_SECRET` ou `jeton_visiteurs` absent ou différent.
- [ ] **Sans motif.** Envoyer sans choisir de motif.
  - Attendu : « Choisissez un motif. »
- [ ] **En double.** Resignaler le même article depuis le même appareil.
  - Attendu : « Vous avez déjà signalé cet article, merci… »
- [ ] **Trop de signalements (facultatif).** 6 articles différents en moins d'une heure.
  - Attendu : le 6e est refusé, « Trop de signalements envoyés : réessayez dans une heure. »

### 1.4 Arabe (US-23)

- [ ] **Changer de langue.** Sur `/oran`, toucher « عربي » dans l'en-tête.
  - Attendu : la page passe en arabe, de **droite à gauche**, avec une police arabe.
  - Attendu : le bouton devient « FR » ; le logo reste « BleDeal » en lettres latines.
- [ ] **Choix gardé.** Fermer l'onglet, rouvrir le site.
  - Attendu : toujours en arabe (cookie `langue`, 1 an).
- [ ] **Pages traduites.** En arabe, parcourir accueil, catalogue, fiche, vitrine, panier, connexion, compte, mes commandes, suivi, carte.
  - Attendu : libellés en arabe, prix en « دج », dates en arabe.
  - Ne sont **pas** traduits : noms de boutiques, quartiers, titres et descriptions d'articles.
- [ ] **Description arabe.** Fiche d'un article qui a une description arabe.
  - Attendu : la description arabe passe en premier.
- [ ] **Messages d'erreur.** En arabe, provoquer une erreur : numéro invalide, ou panier d'une autre boutique.
  - Attendu : le message s'affiche en arabe. Un message inconnu reste en français, jamais vide.
- [ ] **Galerie et retour.** En arabe, ouvrir une fiche.
  - Attendu : la galerie photo défile toujours de gauche à droite.
  - Attendu : la flèche « retour » est retournée.
- [ ] **WhatsApp en arabe** (seulement si `modeles_arabes` = `on`, guide étape 15.3).
  - Passer une commande avec le site en arabe (Client A), puis la boutique la met « Prête ».
  - Attendu : le client reçoit `oranpromo_commande_prete_ar` en arabe, et `messages_whatsapp.modele` vaut `oranpromo_commande_prete_ar`.
  - Le message à la boutique reste en français.
- [ ] **Repli en français.** Si `modeles_arabes` n'est pas à `on` :
  - Attendu : la même commande en arabe reçoit le message **français**.
- [ ] **Commande en français.** Passer une commande avec le site en français.
  - Attendu : messages en français, même avec `modeles_arabes` = `on`.

### 1.5 Carte des boutiques (US-24)

- [ ] **Fond CARTO.** Ouvrir `/oran/carte`.
  - Attendu : fond gris clair, avec la mention « © OpenStreetMap contributors, © CARTO » visible.
  - Si la mention ne cite que OpenStreetMap, `NEXT_PUBLIC_CARTO_CLE` manque (guide, étape 6).
  - Si les tuiles sont vides, le domaine n'est pas autorisé dans la clé CARTO.
- [ ] **Épingles.** Toucher l'épingle de la boutique T.
  - Attendu : épingle avec le nombre de promos en cours.
  - Attendu : mini-fiche avec « Voir la boutique » et « Itinéraire ».
- [ ] **Filtre.** Toucher « Femme », puis « Beauté ».
  - Attendu : l'adresse devient `/oran/carte?univers=femme`, et seules les boutiques de cet univers restent.
  - Sans boutique : « Aucune boutique de cet univers pour le moment. ».
- [ ] **Autour de moi.** Toucher « Autour de moi » et autoriser la localisation.
  - Attendu : liste « Les boutiques · les plus proches d’abord » avec les distances.
  - Refus : « Localisation refusée : la liste reste triée par nom… ».
  - La position n'est **jamais** envoyée : rien de nouveau dans les tables.
- [ ] **Liste sous la carte.** Les boutiques sans position apparaissent dans « Sans position sur la carte (n) ».

### 1.6 Univers Beauté (US-25)

> La boutique « Parfumerie Démo » sert à ces tests **tant que** le script de démonstration (section 7) n'est pas lancé. Ensuite, utiliser un article beauté de test.

- [ ] **Catalogue Beauté.** Ouvrir `/oran/catalogue?univers=beaute`.
  - Attendu : les parfums de la Parfumerie Démo, et les raccourcis Tout · Parfums · … (seulement les catégories qui ont des articles).
  - Attendu : un filtre « Contenance » trié par volume.
- [ ] **Pour elle.** Filtrer « Pour elle ».
  - Attendu : les parfums femme **et** les mixtes.
- [ ] **Fiche parfum.** Ouvrir un parfum.
  - Attendu : « Contenance » (pas « Taille »), et une contenance épuisée affichée « 100 ml, épuisée ».
- [ ] **Panier.** Ajouter un parfum au panier.
  - Attendu : ligne « 100 ml · 4 900 DA » (selon l'article).
  - Attendu : en arabe, « الحجم » et « 100 مل ».
- [ ] **Message de stock.** Confirmer une commande beauté dont la contenance n'a plus de stock.
  - Attendu : « Stock insuffisant … en contenance 100 ml … ».
- [ ] **Aucun produit.** S'il n'y a aucun produit beauté dans la ville :
  - Attendu : « Aucun produit de beauté pour le moment. ».

### 1.7 Connexion et vérification du numéro WhatsApp (US-21)

> Pendant l'essai du mode téléphone (guide, étape 13) ou après sa mise en service (étape 14). Sans `connexion_client`, seule la connexion par e-mail est proposée : le noter, puis passer à 1.8.

- [ ] **Page.** Ouvrir `/compte/connexion`.
  - Attendu : « Se connecter », « Pour commander et suivre vos commandes ».
  - Attendu : « Se connecter avec mon numéro de téléphone » et « Se connecter avec un e-mail (compte déjà créé par e-mail) ».
- [ ] **Numéro invalide.** Saisir `0412345678`.
  - Attendu : « Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres. »
- [ ] **Anti-robot.** Saisir un numéro valide.
  - Attendu : le contrôle Turnstile s'affiche et se valide.
- [ ] **Code par WhatsApp.** Toucher « Recevoir le code sur WhatsApp ».
  - Attendu : code à 6 chiffres sur WhatsApp en moins d'une minute, **aucun SMS**.
- [ ] **Mauvais code.** Saisir un code faux.
  - Attendu : « Code incorrect ou expiré… »
- [ ] **Bon code.** Saisir le bon code.
  - Attendu : connecté ; numéro vérifié dans « Mon compte ».
- [ ] **Changer de numéro.** Toucher « Changer de numéro ou recevoir un nouveau code ».
  - Attendu : retour à la saisie du numéro.
- [ ] **Codes trop rapprochés.** Redemander un code tout de suite.
  - Attendu : refus (1 par minute).
- [ ] **Trop de codes (facultatif).** 6 codes en une heure, à une minute d'écart.
  - Attendu : « Trop de codes demandés pour ce numéro : réessayez dans une heure. »
- [ ] **Numéro déjà pris.** Le Client B essaie le numéro du Client A.
  - Attendu : « Ce numéro est déjà utilisé par un autre compte… »
- [ ] **Pas configuré.** Sans `CODES_TELEPHONE_SECRET` :
  - Attendu : « La connexion par téléphone n’est pas encore configurée… ».
- [ ] **E-mail.** Se déconnecter › « Se connecter avec un e-mail ».
  - Attendu : l'e-mail arrive, expéditeur « BleDeal ».
  - Attendu : le lien ramène sur **`test.bledeal.com`**, ni sur la production ni sur `localhost`.

### 1.8 Panier et commande

- [ ] **Panier.** Ajouter un article, ouvrir `/panier`.
  - Attendu : « Mon panier », article, taille, quantité, « Total », « Note pour la boutique (facultative) ».
- [ ] **Autre boutique.** Ajouter un article d'une autre boutique.
  - Attendu : « Vider le panier et ajouter ».
- [ ] **Pas connecté.** Ouvrir le panier sans être connecté.
  - Attendu : « Se connecter pour commander ».
- [ ] **Numéro non vérifié** (si `connexion_client` est actif).
  - Attendu : « Vérifiez votre numéro pour commander ».
  - Une commande forcée répond « Vérifiez votre numéro de téléphone par code avant de commander. »
- [ ] **Commander.** Client A, avec une note.
  - Attendu : la commande apparaît dans « Mes commandes » (« Commande envoyée »), et le panier est vidé.
- [ ] **Sa propre boutique.** Compte Boutique T dans la boutique T.
  - Attendu : « Vous ne pouvez pas commander dans votre propre boutique. »
- [ ] **Suivi.** `/compte/commandes` › la commande.
  - Attendu : frise Commande envoyée → Confirmée par la boutique → Prête à récupérer → Récupérée.
  - Attendu : « Écrire à la boutique sur WhatsApp ».

### 1.9 QR code de retrait côté client (US-26)

> Prérequis : une commande du Client A passée « Prête » par la boutique (2.2).

- [ ] **Bloc « Mon QR code de retrait ».** `/compte/commandes/<id>` d'une commande prête.
  - Attendu : un QR code, et « Pas de caméra ? Donnez ce code à 6 chiffres : » avec un code à **6 chiffres**.
  - Attendu : « À payer en espèces » avec le montant, et l'invitation à monter la luminosité.
  - Attendu : « Envoyer à un proche (WhatsApp) » et « Copier le lien », avec l'avertissement « Toute personne qui a ce lien peut récupérer la commande… ».
- [ ] **Page du proche.** « Copier le lien », puis ouvrir le lien en navigation privée (`/retrait/<jeton>`, sans connexion).
  - Attendu : « Commande n° … à récupérer chez <boutique> », « Avant le … », QR code, code à 6 chiffres, articles, montant.
  - Attendu : **ni nom ni téléphone** du client.
- [ ] **États du lien.** Après remise, annulation ou expiration de la commande, rouvrir le lien.
  - Attendu, selon le cas :
    - « Cette commande a déjà été récupérée. »
    - « Cette commande a été annulée : il n’y a rien à récupérer. »
    - « Cette commande a expiré : elle n’est plus à récupérer. »
- [ ] **Lien modifié.** Changer un caractère de `/retrait/…`.
  - Attendu : « Ce lien n’est pas valide. »
- [ ] **Bouton WhatsApp « Mon QR code »** (seulement si `bouton_retrait` = `on`, guide étape 15.2).
  - Attendu : le message « commande prête » a un bouton « Mon QR code » qui ouvre `https://bledeal.com/retrait/…`.
  - Attendu : `messages_whatsapp.modele` = `oranpromo_commande_prete_retrait`.
  - Attendu : le message ne contient **pas** le code à 6 chiffres. C'est voulu.
  - Sans `bouton_retrait`, ou si le client est en arabe : message sans bouton ; le QR code reste dans « Mes commandes ».

### 1.10 Annulation par le client

- [ ] **Annuler.** Commande « Demandée » ou « Confirmée » › « Annuler ma commande » › mot facultatif › « Confirmer l’annulation ».
  - Attendu : « Annulée », motif « Annulée par le client ».
  - Attendu : si la commande était confirmée, le stock **remonte**.
- [ ] **Commande prête.**
  - Attendu : plus de bouton d'annulation.

### 1.11 Parrainage côté client (US-27)

> Seulement si `parrainage` = `on`. Fermé, `/parrainage` doit afficher « Le parrainage n’est pas encore ouvert. Reviens bientôt ! » : le cocher et passer.
> Le parrainage exige un **numéro vérifié par code** (1.7).

- [ ] **Page fermée** (si `parrainage` n'est pas à `on`). Ouvrir `/parrainage`.
  - Attendu : « Le parrainage n’est pas encore ouvert. Reviens bientôt ! ».
  - Attendu : aucun bloc « Parraine tes amis » sur l'accueil.
- [ ] **Page ouverte, visiteur.** Ouvrir `/parrainage` sans être connecté.
  - Attendu : « Parraine tes amis », les 3 étapes, les règles, et « Connecte-toi pour avoir ton lien ».
- [ ] **Lien du parrain.** Client A (vérifié), `/parrainage`.
  - Attendu : « Ton code », un lien `/p/<code>`, « Partager sur WhatsApp », « Copier le lien » et un QR code.
- [ ] **Invitation.** Ouvrir le lien `/p/<code>` en navigation privée.
  - Attendu : redirection vers `/parrainage?invite=1`, « Un ami t’invite sur BleDeal ».
- [ ] **Choisir son parrain.** Nouveau client C (inscrit depuis moins de 7 jours, sans commande), après le lien.
  - Attendu : le champ « Ton parrain » est pré-rempli dans `/compte`.
  - Après « Valider » : « C’est noté. Si ce numéro est celui d’un client BleDeal, il deviendra ton parrain après ton premier retrait en boutique. ».
- [ ] **Pas d'énumération.** Saisir un numéro qui n'est pas client.
  - Attendu : **le même** message, sans dire si le numéro existe.
- [ ] **Validation par QR code.** Le client C commande au moins 2 000 DA dans la boutique T. La boutique scanne **son QR code** (2.4).
  - Attendu : un bon de 300 DA pour C et pour A, dans `/compte` › « Mes bons » (« Disponible · valable jusqu’au … »).
  - Attendu : « Mon parrainage » de A compte un ami (« prénom + initiale »).
- [ ] **Pas de validation par code ni sans QR code.** Même scénario, remis par code à 6 chiffres ou par « Remis sans QR code ».
  - Attendu : **aucun bon**, parrainage non validé (relecture n°6).
- [ ] **Utiliser un bon.** Client A, panier d'au moins 1 000 DA.
  - Attendu : case « Utiliser mon bon parrainage (−300 DA) » cochée, « À payer en boutique » réduit de 300 DA.
  - Attendu : le suivi et la page de retrait affichent « Bon parrainage −300 DA ».
- [ ] **Minimum.** Panier de moins de 1 000 DA.
  - Attendu : « Ton bon s’utilise dès 1 000 DA d’achat. ».
- [ ] **Bon rendu.** Annuler une commande qui portait un bon.
  - Attendu : le bon redevient disponible.
- [ ] **Merci.** Commande récupérée.
  - Attendu : encadré « Merci ! » avec « Fais découvrir BleDeal à un ami… ».
- [ ] **7 jours et plafond (lourd / facultatif).**
  - Choisir un parrain après 7 jours ou après une 1re commande → refusé.
  - Un parrain au-delà de 5 amis dans le mois → « Plafond du mois atteint… ».

### 1.12 No-show et contestation

> Prérequis : la boutique a déclaré « Client pas venu » sur une commande du Client A (2.6).

- [ ] **Message WhatsApp.**
  - Attendu : le Client A reçoit `oranpromo_no_show` (ou `oranpromo_no_show_ar`, voir 1.4) dans les 5 minutes.
- [ ] **Liste.** `/compte`.
  - Attendu : « Commandes non récupérées (1) », bouton « Contester ».
- [ ] **Motif trop court.** Écrire « non ».
  - Attendu : « Expliquez en quelques mots pourquoi vous contestez (5 à 300 caractères). »
- [ ] **Contester.** Motif de 5 à 300 caractères › « Envoyer la contestation ».
  - Attendu : « Contestation en cours d’examen ».
- [ ] **Une à la fois.** Contester un 2e no-show pendant que le 1er est en attente.
  - Attendu : « Vous avez déjà une contestation en attente… »
- [ ] **Déjà contesté.** Après la décision de l'admin (3.2), recontester.
  - Attendu : « Vous avez déjà contesté ce no-show. »
- [ ] **7 jours (lourd / facultatif).**
  - Attendu : « Le délai pour contester est dépassé : un no-show se conteste dans les 7 jours. »

### 1.13 Blocage après 5 no-shows (lourd)

- [ ] **Blocage.** Au 5e « Client pas venu » non annulé :
  - Attendu : compte bloqué, et WhatsApp `oranpromo_compte_bloque` (ou `…_ar`).
- [ ] **Commande refusée.**
  - Attendu : « Votre compte est bloqué après 5 commandes non récupérées : contactez BleDeal pour le débloquer. »
- [ ] **Déblocage** (3.2).
  - Attendu : le client peut recommander.

---

## 2. Parcours boutique

### 2.1 Espace, partage, affiche et position

- [ ] **Espace.** Compte Boutique T › `/espace`.
  - Attendu : la navigation (Mes articles, Ajouter, Commandes, Statistiques…), « Ville : Oran » et « Partager ma boutique ».
- [ ] **Lien.** Copier le lien.
  - Attendu : « Lien copié ». L'adresse est `https://test.bledeal.com/b/<slug>` (en production : `https://bledeal.com/b/<slug>`).
- [ ] **Message de partage.**
  - Attendu : « Découvrez <boutique> sur BleDeal : nos articles et nos promos à Oran, à réserver sur WhatsApp. … ».
- [ ] **Aperçu du lien.** Coller le lien dans WhatsApp.
  - Attendu : aperçu « BleDeal », nom de la boutique, « quartier · Oran ».
  - Sur la preview protégée, l'aperçu peut manquer : refaire en production.
- [ ] **QR code.** « Télécharger le QR code ».
  - Attendu : fichier `bledeal-<slug>-qr.svg` ; scanné, il ouvre la vitrine.
- [ ] **Affiche.** « Imprimer l'affiche » (`/espace/affiche`).
  - Attendu : A4 avec « BleDeal · Oran », nom, QR code, « Scannez pour voir nos articles et nos promos ».
  - Attendu : le QR code imprimé se scanne.
- [ ] **Position, boutique en attente.** Avec une boutique de test **en attente**, `/espace` › « Position sur la carte ».
  - Attendu : « Je suis dans la boutique : utiliser ma position », « Coller un lien Google Maps », « Saisir les coordonnées à la main », « Enregistrer la position ».
- [ ] **Lien court Google Maps.** Coller un lien `maps.app.goo.gl/…`.
  - Attendu : refusé avec un message, et jamais ouvert.
- [ ] **Hors wilaya.** Saisir une position hors de la wilaya, par exemple 36,75 / 3,06 (Alger).
  - Attendu : « La position doit être dans la wilaya d'Oran. ».
- [ ] **Boutique validée.**
  - Attendu : la position est en lecture seule (« … seul BleDeal pourra la changer »).
- [ ] **Bons à rembourser** (si le parrainage a servi).
  - Attendu : le bloc « Bons parrainage à rembourser » apparaît dans `/espace` (seulement s'il existe un relevé).

### 2.2 Tableau des commandes (US-28)

- [ ] **Étapes.** `/espace/commandes`.
  - Attendu : 4 étapes avec compteurs, « À confirmer », « À préparer », « Prêtes », « Terminées ». La première étape non vide est ouverte.
  - Attendu : les plus urgentes en haut, en rouge au-delà de 30 min / 2 h / 3 h, avec le texte.
- [ ] **Affichage.** Sur téléphone : lignes serrées. Sur ordinateur : un tableau compact (N°, Prénom, Articles, À encaisser, Échéance).
- [ ] **Commande reçue.** Le Client A commande dans la boutique T.
  - Attendu : elle apparaît dans « À confirmer ». Dépliée : nom, téléphone (lien WhatsApp), lignes, total, note.
  - Attendu : la boutique reçoit le WhatsApp « nouvelle commande » en 5 minutes. Le modèle est `oranpromo_nouvelle_commande`, ou `…_confirmer` si `bouton_confirmer` = `on`.
- [ ] **Recherche.** Taper un n° ou le début d'un prénom dans « N° ou prénom ».
  - Attendu : seules les commandes correspondantes restent. Sinon : « Aucune commande ne correspond. ».
- [ ] **Confirmer.** Déplier la commande › « Confirmer ».
  - Attendu : elle passe dans « À préparer », le **stock baisse**, et la frise du client affiche « Confirmée par la boutique ».
- [ ] **Confirmer en groupe.** 2 ou 3 commandes dans « À confirmer » › cocher › « Confirmer les 2 ».
  - Attendu : un compte rendu commande par commande.
  - Une commande sans stock reste cochée avec « N° … non confirmée : Stock insuffisant pour « … » ».
- [ ] **Marquer prêtes.** Sur « À préparer » : « Tout cocher (n) » › « Marquer prêtes (n) ».
  - Attendu : elles passent dans « Prêtes ». Un WhatsApp « prête » part pour chacune.
  - Pas d'annulation ni de remise groupée.
- [ ] **Liste de préparation.** « À préparer » › « Liste de préparation » (`/espace/commandes/preparation`).
  - Attendu : les articles regroupés par article puis taille ou contenance, avec n° et prénoms et des cases à cocher.
  - Attendu : « Imprimer » donne un A4 noir et blanc sans photo.
- [ ] **Mise à jour automatique.** Laisser la page ouverte sur l'ordinateur ; le Client B commande sur son téléphone.
  - Attendu : en 20 s environ, le bandeau « Nouvelle commande n° … » avec « Voir », l'étiquette « Nouveau » et `(1)` dans le titre de l'onglet.
  - Attendu : la ligne « À jour · <heure> · Actualiser ».
- [ ] **Son.** « Activer le son », puis une nouvelle commande.
  - Attendu : bip (et vibration sur téléphone). Le choix est gardé sur l'appareil ; « Couper » l'arrête.
- [ ] **Connexion coupée.** Mettre le téléphone en mode avion 1 minute.
  - Attendu : « Connexion perdue, nouvel essai… ». La mise à jour reprend ensuite.
- [ ] **Vendu à 0.** Confirmer la dernière pièce d'un article.
  - Attendu : la fiche publique affiche « Article plus disponible » ou « Cet article a été vendu ».
- [ ] **Stock insuffisant.** Mettre le stock à 0 dans Mes articles, puis « Confirmer ».
  - Attendu : message de stock insuffisant et lien « Corriger le stock dans Mes articles ». La commande reste à confirmer.
- [ ] **Annuler par la boutique.** « Annuler » sans motif.
  - Attendu : « Choisissez le motif de l’annulation. »
- [ ] **Annuler avec motif.** « Plus en stock » › message › « Annuler la commande ».
  - Attendu : « Motif : Plus en stock », et le lien « Corriger le stock dans Mes articles ».
  - Attendu : si la commande était confirmée, le stock remonte.
- [ ] **Commande prête.** Déplier une commande « Prête ».
  - Attendu : « À récupérer jusqu’au … », « Remise : scannez le QR code du client. Scanner », et le lien « Remis sans QR code ».
  - Attendu : **plus de bouton « Récupérée » direct**.
- [ ] **Expiration (lourd / facultatif).** Une commande « Prête » non remise en 24 h.
  - Attendu : « Expirée », stock remonté, client prévenu par `oranpromo_commande_expiree`.

### 2.3 Confirmation depuis WhatsApp (US-20.6, `CONFIRMATION_SECRET`)

> Avec le vrai bouton : seulement si `oranpromo_nouvelle_commande_confirmer` est approuvé **et** `bouton_confirmer` = `on` (guide, étape 15.1).

- [ ] **Bouton.** Une nouvelle commande.
  - Attendu : « Nouvelle commande n° … sur BleDeal : … » avec le bouton **« Confirmer »**.
  - Sans bouton : réglage pas à `on`, ou modèle non approuvé (l'ancien message part).
- [ ] **Page.** Toucher « Confirmer ».
  - Attendu : `https://bledeal.com/confirmer/<jeton>` s'ouvre **sans connexion**, avec le résumé (sans le téléphone du client), « Le stock baisse à la confirmation. Lien valable 24 h. » et « Confirmer la commande ».
  - Attendu : ouvrir la page ne confirme rien.
- [ ] **Confirmer.** Toucher « Confirmer la commande ».
  - Attendu : « Commande confirmée : le stock est mis à jour. Pensez à la préparer. ».
- [ ] **Déjà confirmée.** Rouvrir le lien.
  - Attendu : « Cette commande est déjà confirmée. »
- [ ] **Commande annulée.**
  - Attendu : « Cette commande a été annulée : il n’y a rien à confirmer. »
- [ ] **Commande expirée (facultatif).**
  - Attendu : « Cette commande a expiré : il n’y a rien à confirmer. »
- [ ] **Stock à 0.**
  - Attendu : message de stock insuffisant et « Corriger le stock ou annuler ».
- [ ] **Lien modifié.**
  - Attendu : « Ce lien n’est pas valide. »
- [ ] **Plus de 24 h (lourd / facultatif).**
  - Attendu : « Ce lien a expiré. Confirmez la commande dans votre espace BleDeal, rubrique Commandes. »
- [ ] **Secret absent.**
  - Attendu : « La confirmation par lien n’est pas disponible pour le moment. Confirmez la commande dans votre espace BleDeal, rubrique Commandes. »

### 2.4 Scanner et remise (US-26)

> Prérequis : une commande « Prête » du Client A, avec son QR code ouvert sur le téléphone du client (1.9).

- [ ] **Scanner, Android.** Sur le téléphone de la boutique (Chrome), `/espace/commandes` › « Scanner » (`/espace/scanner`).
  - Attendu : la caméra arrière s'ouvre dans la page, avec « Placez le QR code du client dans le cadre. ».
  - Attendu : « Lampe » si le téléphone le permet.
- [ ] **Scanner, iPhone.** Même test dans Safari (lecteur `jsqr`).
  - Attendu : la lecture marche aussi.
- [ ] **Dans WhatsApp ou Instagram.** Ouvrir l'espace depuis le navigateur intégré de WhatsApp.
  - Attendu : « Dans WhatsApp ou Instagram, ouvrez votre espace dans Chrome ou Safari. » si la caméra n'y marche pas.
- [ ] **Résumé.** Scanner le QR code du client.
  - Attendu : `/espace/retrait/<jeton>`, avec le prénom, les articles, « À encaisser en espèces » et « Vérifiez les articles avec le client avant de remettre… ».
  - Attendu : scanner **ne remet rien**.
- [ ] **Remise.** Toucher « Remis au client ».
  - Attendu : « Commande remise ». La commande passe dans « Terminées » (Récupérée), et le client voit « Récupérée ».
- [ ] **Déjà remise.** Rescanner le même QR code.
  - Attendu : « Cette commande a déjà été remise. »
- [ ] **QR code étranger.** Scanner un autre QR code (vitrine, site web).
  - Attendu : « Ce n’est pas un QR code de retrait BleDeal. »
- [ ] **QR code d'une autre boutique.**
  - Attendu : « Ce QR code n’est pas valide pour votre boutique. »
- [ ] **Code à 6 chiffres.** « La caméra ne marche pas ? Tapez le code à 6 chiffres » › saisir le code du client.
  - Attendu : le même résumé. Si la commande a un bon : « Remise par code : ni bon parrainage ni parrainage BleDeal. Scannez plutôt le QR code du client. » et encaissement du total.
- [ ] **Code faux.**
  - Attendu : « Code faux. Vérifiez les 6 chiffres avec le client. »
- [ ] **Caméra refusée.** Refuser l'accès à la caméra.
  - Attendu : « La caméra est bloquée. Autorisez-la dans les réglages du navigateur (cadenas à côté de l’adresse), ou tapez le code. ».
  - Attendu : la saisie du code reste possible.
- [ ] **Limite par commande (facultatif).** 5 codes faux à **une faute de frappe** du code d'une commande prête (un chiffre faux, ou deux chiffres voisins inversés).
  - Attendu : « Trop de codes faux pour cette commande : son code est bloqué encore … min. Scannez le QR code du client. ».
  - Attendu : le QR code de cette commande marche toujours.
- [ ] **Limite par boutique (lourd / facultatif).** 20 codes faux au hasard en une heure.
  - Attendu : « Trop de codes faux (20 en une heure) : la saisie du code est bloquée encore … min. Scannez le QR code du client. ».
  - Attendu : le QR code et « Remis sans QR code » marchent toujours.
- [ ] **Remis sans QR code.** Sur une commande prête : « Remis sans QR code ».
  - Attendu : l'avertissement « Le client n’a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez. ».
  - Avec un bon, attendu : « Sans QR code ni code, le bon ne s’applique pas : encaissez <total>. Le bon reste au client. ».
  - Puis « Confirmer la remise » : la commande est récupérée, avec le suivi « Remise sans QR code ».
- [ ] **Bon au scan.** Commande avec bon, scannée par QR code.
  - Attendu : « Sous-total », « Bon parrainage BleDeal −300 DA », « À encaisser en espèces » réduit.
  - Attendu : « Ces 300 DA vous sont remboursés par BleDeal (relevé de <mois>) ».

### 2.5 Statistiques

- [ ] **Statistiques.** Voir 1.3. Sans aucune visite :
  - Attendu : « Aucune vue d’article sur cette période. »

### 2.6 Déclarer un client pas venu

- [ ] **Bouton.** Sur une commande « Expirée », ou « Prête » dont l'heure limite est passée : « Client pas venu ».
  - Il n'existe pas avant l'heure limite (attendre 24 h, ou demander l'aide d'un développeur).
  - Attendu : l'avertissement « … Il recevra un avertissement sur WhatsApp ; au 5e oubli, son compte est bloqué. ».
- [ ] **Confirmer.** « Confirmer : pas venu ».
  - Attendu : « Client pas venu · signalé le … », et le WhatsApp au client (1.12).
- [ ] **Retour.** « Client pas venu » › « Retour ».
  - Attendu : rien n'est enregistré.

---

## 3. Parcours admin

### 3.1 Accès, tableau de bord et boutiques

- [ ] **Accès refusé.** Un compte client ouvre `/admin`.
  - Attendu : « Accès réservé ».
- [ ] **Onglets.** Compte admin, `/admin`.
  - Attendu : « Tableau de bord », « Boutiques », « Modération », « Clients », « Parrainages », « Remboursements », « Villes ».
  - Attendu : « À relancer » / « Relancer sur WhatsApp ».
- [ ] **Filtre.** « Boutiques » › filtrer par statut.
  - Attendu : la liste suit le filtre. Une boutique **de test** suspendue affiche « Boutique indisponible » côté public.
- [ ] **Nouvelle boutique.** Créer une boutique de test.
  - Attendu : champ « Ville (wilaya) » avec Oran présélectionnée (villes fermées marquées « (fermée) »), et bloc « Position sur la carte ».
- [ ] **Position (admin).** Bouton « Position » sur une boutique validée.
  - Attendu : l'admin peut la déplacer. Une position hors wilaya est refusée.
- [ ] **Changer de ville.** « Changer de ville » sur une boutique de test.
  - Attendu : seule une position dans la nouvelle ville est acceptée. **Remettre Oran ensuite.**

### 3.2 Clients, no-shows et contestations

- [ ] **Contestations.** `/admin/clients` › « Contestations en attente ».
  - Attendu : la contestation du Client A, avec son motif.
- [ ] **Valider le no-show.**
  - Attendu : la contestation sort de la liste, le no-show compte.
- [ ] **Annuler le no-show.**
  - Attendu : le no-show ne compte plus ; côté boutique, « (annulé par BleDeal) ».
- [ ] **Bloquer / Débloquer** un client de test.
  - Attendu : commande refusée, puis de nouveau possible.

### 3.3 Modération

- [ ] **Signalement.** `/admin/moderation`.
  - Attendu : le signalement de 1.3, avec « Masquer l’article », « Avertir la boutique », « Suspendre la boutique », « Classer sans suite ».
- [ ] **Classer sans suite.**
  - Attendu : il quitte la liste (« Aucun signalement ouvert. »), et la décision est enregistrée.
- [ ] **Masquer** un article de test.
  - Attendu : il n'apparaît plus côté public.

### 3.4 Villes (US-29)

> ⚠️ Ouvrir une ville la rend visible **en production** (base commune). Ne l'ouvrir que pour le vrai lancement de cette ville.

- [ ] **Liste.** `/admin/villes`.
  - Attendu : les 9 villes (Oran, Mostaganem, Relizane, Tlemcen, Alger, Tizi Ouzou, Béjaïa, Annaba, Constantine), avec nom arabe, wilaya et comptes. Seule Oran est « Ouverte ».
- [ ] **Confirmation sans effet.** « Fermée » sur Mostaganem.
  - Attendu : la confirmation « Ouvrir Mostaganem ? … » apparaît. Toucher **« Annuler »** : rien ne change.
- [ ] **Ambassadeurs.** « Ville des ambassadeurs » : donner une ville à un ambassadeur de test.
  - Attendu : il ne peut créer de boutique que dans cette ville.

### 3.5 Parrainages et remboursements (US-27)

- [ ] **Budget.** `/admin/parrainages` › « Budget du mois ».
  - Attendu : le champ « Budget mensuel (DA) » (30 000 au départ) et « Les bons émis comptent… ».
  - Changer puis remettre la valeur.
- [ ] **Liste.** Après 1.11 :
  - Attendu : filleul et parrain (numéros masqués « 0555 •• •• 56 »), commande, boutique, mode de remise « QR code », bons, statut, signaux éventuels.
- [ ] **Actions (sur des comptes de test).**
  - « Annuler les bons » (avec motif) ;
  - « Exclure le parrain » / « Réadmettre le parrain » ;
  - « Retirer la boutique des bons » / « Réaccepter la boutique ».
  - Attendu : l'état change, et une boutique retirée refuse les bons au panier (« Bon non appliqué : cette boutique n’accepte pas les bons pour le moment… »).
- [ ] **Remboursements.** `/admin/remboursements?mois=AAAA-MM` (mois en cours).
  - Attendu : une ligne par boutique (« n bons · … DA »), son état, et le détail des commandes.
- [ ] **Mettre de côté.** « Mettre de côté » une ligne avec un motif.
  - Attendu : « Ligne mise de côté : elle sort du relevé à payer et attend une décision. ».
  - Puis « Rembourser » ou « Refuser ».
- [ ] **Export CSV.** Exporter le mois.
  - Attendu : un fichier `bledeal-bons-….csv` qui s'ouvre dans Excel, avec une ligne TOTAL par boutique et **aucun numéro de téléphone**.
  - En non-admin, l'adresse d'export répond « Page introuvable ».
- [ ] **Marquer comme payé (lourd, après le 1er du mois).** Sur un relevé clôturé, « Marquer comme payé » avec une référence.
  - Attendu : « Relevé marqué comme payé. Il n’est plus modifiable. ».
  - Sur le relevé du mois en cours : « Seul un relevé clôturé (à payer) peut être marqué comme payé. ».

---

## 4. Messages WhatsApp (file d'envoi et cron)

- [ ] **Empreinte présente.** `jeton_notifications` existe (section 0). Sinon, **stop** : rien ne partira.
- [ ] **File.** Après chaque événement, ouvrir `messages_whatsapp`.
  - Attendu : une ligne avec le bon `modele` et le bon `destinataire` (+213…).
  - Attendu : `statut` passe de `a_envoyer` à `envoye` en moins de 5 minutes.
- [ ] **Les 11 modèles.** Cocher chacun quand il a été reçu une fois :
  - [ ] `oranpromo_nouvelle_commande`
  - [ ] `oranpromo_nouvelle_commande_confirmer` (`bouton_confirmer`)
  - [ ] `oranpromo_commande_prete`
  - [ ] `oranpromo_commande_prete_retrait` (`bouton_retrait`)
  - [ ] `oranpromo_commande_expiree`
  - [ ] `oranpromo_no_show`
  - [ ] `oranpromo_compte_bloque`
  - [ ] `oranpromo_commande_prete_ar` (`modeles_arabes`)
  - [ ] `oranpromo_commande_expiree_ar` (`modeles_arabes`)
  - [ ] `oranpromo_no_show_ar` (`modeles_arabes`)
  - [ ] `oranpromo_compte_bloque_ar` (`modeles_arabes`)
- [ ] **Textes.** Sur le téléphone :
  - Attendu : les messages disent « BleDeal » (pas « OranPromo »), sans `{{1}}` visible, avec le bon numéro, la bonne boutique et la bonne heure.
- [ ] **Échecs.** Aucune ligne en `echec`. Sinon, lire `erreur` : modèle non approuvé, jeton Meta expiré, moyen de paiement manquant.
- [ ] **cron-job.org.** Historique.
  - Attendu : un appel toutes les 5 min, en **200** `{"envoyes":…,"echecs":…,"reportes":…,"traites":…}`.
  - 401 = `CRON_SECRET` différent ; 503 = `CRON_SECRET` absent ; 500 = empreinte absente ou différente.

---

## 5. Limites et sécurité

### 5.1 Limites de commandes (messages exacts de la base)

- [ ] **3 par heure, client et boutique.** Le Client A, 4e commande dans la boutique T en une heure.
  - Attendu : « Vous avez déjà passé 3 commandes dans cette boutique en une heure : réessayez plus tard. »
- [ ] **Autre boutique.** Juste après, commande dans une autre boutique.
  - Attendu : acceptée.
- [ ] **5 commandes en cours.** 6e commande en cours.
  - Attendu : « Vous avez déjà 5 commandes en cours… »
- [ ] **10 par heure (lourd / facultatif).**
  - Attendu : « Trop de commandes en une heure : réessayez plus tard. »

### 5.2 Limite par boutique (lourd / facultatif)

- [ ] **20 par heure.** Avec au moins 7 clients de test, 21 commandes dans la boutique T en une heure.
  - Attendu : « Cette boutique a reçu trop de commandes dans la dernière heure : réessayez un peu plus tard. ».
  - Les commandes annulées par le client dans les 2 minutes ne comptent pas.

### 5.3 Sécurité de base

- [ ] **Origine.** Toutes les actions marchent depuis `https://test.bledeal.com`.
  - Si une action échoue seulement là : vérifier `NEXT_PUBLIC_SITE_URL` (Preview).
- [ ] **Aucun secret visible.** Afficher le code source d'une page et chercher `SECRET`, `sk-ant`, `TOKEN`.
  - Attendu : rien. Seules la clé publique Supabase, la clé de site Turnstile et la clé CARTO (publique) peuvent apparaître.
- [ ] **Page de retrait non indexée.** `/retrait/<jeton>` et `/espace/retrait/<jeton>` ne s'affichent jamais dans un moteur de recherche (balise `noindex`, à vérifier par le développeur si besoin).

---

## 6. Avant la mise en ligne : récapitulatif

- [ ] **Parcours principaux.** Sections 0, 1.1 à 1.3, 1.7 à 1.9, 2.1 à 2.4, 3.1, 3.2 et 4 cochées.
- [ ] **Après approbation Meta.** Sections 1.4 (WhatsApp arabe), 1.9 (bouton « Mon QR code ») et 2.3 cochées, ou notées « en attente d'approbation Meta ».
- [ ] **Scanner.** 2.4 testé sur **Android et iPhone**.
- [ ] **Parrainage.** 1.11 et 3.5 cochés, ou parrainage **fermé** en attendant les accords écrits.
- [ ] **Tests lourds.** Faits, ou volontairement reportés (noter lesquels).
- [ ] **Textes arabes.** Relus par une personne qui parle darja, carte comprise : le filtre de la carte dit « نسا · رجال · ذراري », le catalogue « نساء · رجال · أطفال ».

---

## 7. Retrait des données de démonstration (`supabase/scripts/retirer_donnees_demo.sql`)

> ⚠️ Agit sur la base **commune**. **Une seule fois**, juste avant le lancement (guide, étape 19.1). Après, la Parfumerie Démo n'existe plus : faire les tests de 1.6 **avant**.

- [ ] **Essai à blanc.** SQL Editor › coller **tout** le script **sans le modifier** › **Run**.
  - Attendu : un tableau final, table par table, de ce qui **serait** supprimé, et **rien n'est supprimé**. La ligne marquée ⚠ `appliquer constant boolean := false …` laisse le script en simulation.
  - Vérifier : la Parfumerie Démo et les articles de démo sont toujours visibles.
- [ ] **Relire le tableau.** Il ne doit concerner que :
  - le compte `hakim3142@gmail.com` et « Boutique Nour » ;
  - « Parfumerie Démo » (`parfumerie-demo`) et ses 5 parfums ;
  - les 10 articles de démonstration (dont 3 de Maison Ilyes), les photos `placehold.co`, les messages WhatsApp de test ;
  - pour le parrainage, ce qui touche ces comptes et commandes : `parrainages`, `bons`, `releves_bons`, `lignes_releve`, `prive.retraits`.

  Le compte admin et « Maison Ilyes » sont **gardés**. En cas de doute : **s'arrêter**.
- [ ] **Suppression réelle.** Remplacer **seulement** `appliquer constant boolean := false` par `appliquer constant boolean := true` › **Run**.
  - Attendu : le tableau de ce qui a été supprimé. En cas d'erreur, **rien** n'est supprimé.
  - Arrêts possibles :
    - photos dans **Storage** › `photos` (les supprimer, relancer) ;
    - relevé de bons **payé** sur une boutique de démo (voir le développeur) ;
    - compte admin.
- [ ] **Relance.** Relancer avec `true`.
  - Attendu : **0 partout**.
- [ ] **Sur le site.** `/oran`, `/oran/catalogue?univers=beaute`, `/oran/carte`, `/b/boutique-nour`, `/b/parfumerie-demo`.
  - Attendu : plus de démo ; « Boutique indisponible » pour les deux boutiques de démo. Les vraies boutiques sont toujours là.
- [ ] **Bons des vrais clients.** Un vrai client qui avait un bon réservé sur une commande de démo.
  - Attendu : le bon est de nouveau « Disponible ».
- [ ] **Maison Ilyes.** Changer ou retirer son WhatsApp (numéro du propriétaire).
- [ ] **Onglet SQL.** Fermer sans enregistrer la version `true`.

---

## 8. Ménage après les tests

- [ ] **Commandes.** Annuler les commandes de test encore en cours.
- [ ] **No-shows et blocages.** Annuler les no-shows de test, débloquer les clients de test.
- [ ] **Parrainage.**
  - Annuler les bons de test (`/admin/parrainages` › « Annuler les bons ») ;
  - mettre de côté puis refuser leurs lignes de relevé ;
  - réaccepter les boutiques retirées pour le test.
- [ ] **Boutique de test.** Suspendre la boutique T si elle ne doit pas être visible en production. Remettre sa ville à Oran.
- [ ] **Signalements.** Classer sans suite ceux de test.
- [ ] **Villes.** Vérifier que seule Oran est ouverte (`/admin/villes`).
- [ ] **Interrupteurs.** Remettre les interrupteurs dans l'état voulu (section 0).

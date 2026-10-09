# Tests manuels sur la preview Vercel

Liste de contrôle à suivre **avant la mise en ligne** (et après chaque grosse modification), sur l'adresse de preview fixe `https://test.<domaine>` (voir `docs/guide-mise-en-ligne.md`, étape 1). Cochez chaque case `- [ ]` → `- [x]` une fois le résultat attendu constaté. Si un résultat diffère, notez la date, l'heure, le compte utilisé, le numéro de commande et une capture d'écran.

> ⚠️ **La preview et la production utilisent la même base Supabase.** Tout ce que vous créez ici (comptes, commandes, no-shows, signalements) existe aussi en production. Utilisez uniquement des comptes et une boutique **de test**, et faites le ménage à la fin (section 6). Les réglages `connexion_client` et `bouton_confirmer` sont **communs** à la preview et à la production.

Ne copiez jamais de secret (clé, jeton, mot de passe) dans ce fichier ni dans un message : uniquement des emplacements comme `<CRON_SECRET>`.

## 0. Préparation

- [ ] **Configuration faite.** Étapes 1 à 11 du guide de mise en ligne terminées, dont les 4 secrets et leurs empreintes (`VISITEURS_SECRET` / `jeton_visiteurs`, `CRON_SECRET` / `jeton_notifications`, `CODES_TELEPHONE_SECRET` / `jeton_codes_telephone`, `CONFIRMATION_SECRET` / `jeton_confirmation`). Dernier déploiement de la preview **après** le dernier changement de variable.
- [ ] **Comptes de test.** Préparer :
  - **Admin** : votre compte administrateur.
  - **Boutique T** : un compte commerçant avec une boutique de test **validée**, et au moins 3 articles en stock (dont un en promo, un avec 1 seule pièce, un avec plusieurs tailles).
  - **Client A** et **Client B** : deux comptes clients, chacun avec un numéro de mobile algérien (05/06/07) **différent** sur lequel vous recevez WhatsApp.
  - Pour les tests de limite « 20 par heure » (section 4.6) : jusqu'à 7 comptes clients. Ce test est **lourd et facultatif**.
- [ ] **Deux appareils.** Un téléphone (client) et un ordinateur (boutique ou admin), ou deux navigateurs différents, dont un en navigation privée.
- [ ] **Accès Supabase.** Ouvrir **Table Editor** pour suivre les tables `commandes`, `messages_whatsapp`, `evenements`, `signalements`. Les requêtes SQL citées se lancent dans **SQL Editor**.

---

## 1. Parcours client (visiteur et client)

### 1.1 Page d'accueil et navigation

- [ ] **Accueil.** Ouvrir `https://test.<domaine>/` sur téléphone.
  - Attendu : le titre « Les promos d'Oran », la ligne « Réservez sur WhatsApp · Payez en boutique » et le bouton « Voir les promos ».
  - Attendu : la rubrique « En ce moment » avec des articles réels (pas d'articles de démo une fois le script de la section 6 lancé) et le lien « Tout voir ».
  - Attendu : le lien « Espace commerçant ».
- [ ] **Liens.** Cliquer « Voir les promos » puis « Tout voir ».
  - Attendu : le catalogue s'ouvre, avec les promos en premier, sans page d'erreur.
- [ ] **Affichage mobile.** Vérifier en mode portrait.
  - Attendu : rien ne déborde sur le côté et les boutons sont faciles à toucher.

### 1.2 Vitrine d'une boutique et fiche article

- [ ] **Vitrine.** Ouvrir `https://test.<domaine>/b/<slug-boutique-T>`.
  - Attendu : le nom de la boutique, les boutons « WhatsApp » et « Itinéraire », et le titre « Articles disponibles · promos en premier ».
- [ ] **Boutique non validée ou suspendue.** Ouvrir l'adresse d'une boutique non validée (ou suspendue).
  - Attendu : « Boutique indisponible » et le lien « Retour à l'accueil ».
- [ ] **Fiche article.** Ouvrir un article.
  - Attendu : les photos, le prix (prix barré si promo), les choix « Taille » et « Quantité », le bouton « Ajouter au panier », la phrase « La boutique confirme votre commande. Paiement en boutique. » et le lien « Une question ? WhatsApp ».
- [ ] **Article vendu.** Ouvrir un article dont le stock est à 0.
  - Attendu : « Article plus disponible » ou « Cet article a été vendu », et pas de bouton de commande.

### 1.3 Vues, clics et « Signaler » (`VISITEURS_SECRET`) — **urgent**

> Sans `VISITEURS_SECRET` (et l'empreinte `jeton_visiteurs`), les vues et clics ne sont **pas** enregistrés et « Signaler cet article » répond « pas disponible ». À tester en premier.

- [ ] **Vue enregistrée.** En navigation privée, ouvrir la vitrine de la boutique T, puis une fiche article.
  - Attendu : une ligne apparaît dans `evenements` en moins d'une minute (Table Editor, trier par date).
- [ ] **Clic « Ajouter au panier » enregistré.** Sur la fiche, choisir taille et quantité, puis cliquer « Ajouter au panier ».
  - Attendu : une nouvelle ligne de clic dans `evenements` (c'est ce que l'espace boutique affiche comme « Clics « Réserver » »).
- [ ] **Pas de double comptage.** Recharger 3 fois la même fiche en moins de 10 minutes.
  - Attendu : la vue n'est comptée **qu'une fois** par 10 minutes pour ce visiteur.
- [ ] **Statistiques boutique.** Avec le compte Boutique T, ouvrir `/espace/statistiques`, puis basculer entre 7 et 30 jours.
  - Attendu : « Vues de la vitrine », « Vues des articles » et « Clics « Réserver » » ont augmenté. L'article apparaît dans « Les 5 articles les plus vus ».
- [ ] **Signaler un article.** Sur une fiche article, cliquer « Signaler cet article », choisir un motif (par ex. « Autre »), écrire un commentaire, puis « Envoyer le signalement ».
  - Attendu : le message « Merci, nous allons vérifier. ».
  - **Échec typique** : « Le signalement n'est pas disponible pour le moment. Réessayez plus tard. » veut dire que `VISITEURS_SECRET` ou `jeton_visiteurs` est absent ou différent. Vérifier l'étape 3 du guide, puis redéployer.
- [ ] **Sans motif.** Envoyer sans choisir de motif.
  - Attendu : « Choisissez un motif. »
- [ ] **Signalement en double.** Signaler à nouveau **le même** article depuis le même appareil.
  - Attendu : « Vous avez déjà signalé cet article, merci… » (un signalement par article et par visiteur en 24 h).
- [ ] **Trop de signalements (facultatif).** Signaler 6 articles différents en moins d'une heure depuis le même appareil.
  - Attendu : le 6e est refusé avec « Trop de signalements envoyés : réessayez dans une heure. »
- [ ] **Côté admin.** Ouvrir `/admin/moderation`.
  - Attendu : le signalement est listé (voir section 3.3).

### 1.4 Connexion et vérification du numéro WhatsApp

> Pendant l'essai du mode téléphone (guide, étape 12) ou après la mise en service (étape 13). Si `connexion_client` n'est pas activé, seule la connexion par e-mail est proposée : notez-le et passez à 1.5.

- [ ] **Page de connexion.** Ouvrir `/compte/connexion`.
  - Attendu : le titre « Se connecter », la ligne « Pour commander et suivre vos commandes », et les liens « Se connecter avec mon numéro de téléphone » et « Se connecter avec un e-mail (compte déjà créé par e-mail) ».
- [ ] **Numéro invalide.** Saisir `0412345678` (fixe) ou un numéro trop court.
  - Attendu : « Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres. »
- [ ] **Anti-robot.** Saisir un numéro valide.
  - Attendu : la case Turnstile « Je ne suis pas un robot » s'affiche et se valide (souvent toute seule). Sans elle, l'envoi est refusé.
- [ ] **Code reçu sur WhatsApp.** Cliquer « Recevoir le code sur WhatsApp ».
  - Attendu : un message WhatsApp avec un code à 6 chiffres arrive en moins d'une minute, et **aucun SMS**. S'il arrive par SMS, le canal SMS de Twilio Verify est encore actif (guide, étape 8).
- [ ] **Mauvais code.** Saisir un code faux dans « Code à 6 chiffres ».
  - Attendu : « Code incorrect ou expiré… »
- [ ] **Bon code.** Saisir le bon code.
  - Attendu : vous êtes connecté et le numéro apparaît comme vérifié dans « Mon compte ».
- [ ] **Changer de numéro.** Cliquer « Changer de numéro ou recevoir un nouveau code ».
  - Attendu : retour à la saisie du numéro.
- [ ] **Codes trop rapprochés.** Redemander un code tout de suite pour le même numéro.
  - Attendu : refus. Un code par minute au plus.
- [ ] **Trop de codes (facultatif).** Demander 6 codes en moins d'une heure pour le même numéro (en attendant 1 minute entre chaque).
  - Attendu : le 6e est refusé avec « Trop de codes demandés pour ce numéro : réessayez dans une heure. »
- [ ] **Numéro déjà pris.** Avec le Client B, essayer de vérifier le numéro du Client A.
  - Attendu : « Ce numéro est déjà utilisé par un autre compte… »
- [ ] **Pas configuré.** Si la connexion par téléphone n'est pas encore branchée, le message attendu est « La connexion par téléphone n'est pas encore configurée… ». Le noter, ce n'est pas un bug.
- [ ] **Connexion par e-mail.** Se déconnecter, puis cliquer « Se connecter avec un e-mail (compte déjà créé par e-mail) ».
  - Attendu : l'e-mail arrive (envoyé par Resend, pas par Supabase). Le lien ramène sur **`test.<domaine>`** (pas sur la production ni sur `localhost`).

### 1.5 Panier et commande

- [ ] **Panier.** Ajouter un article au panier, puis ouvrir `/panier`.
  - Attendu : le titre « Mon panier », l'article, la taille, la quantité et le « Total ». Le champ « Note pour la boutique (facultative) » est présent.
- [ ] **Panier d'une autre boutique.** Ajouter un article d'une **autre** boutique.
  - Attendu : le bouton « Vider le panier et ajouter » est proposé (un panier = une boutique).
- [ ] **Pas connecté.** Déconnecté, ouvrir le panier.
  - Attendu : le bouton « Se connecter pour commander ».
- [ ] **Numéro non vérifié** (si `connexion_client` est actif). Avec un compte e-mail sans numéro vérifié, ouvrir le panier.
  - Attendu : « Vérifiez votre numéro pour commander ». Une tentative de commande répond « Vérifiez votre numéro de téléphone par code avant de commander. »
- [ ] **Commander.** Avec le Client A (numéro vérifié), écrire une note puis envoyer la commande.
  - Attendu : la commande apparaît dans « Mes commandes » avec le statut « Commande envoyée » (Demandée). Le panier est vidé.
- [ ] **Sa propre boutique.** Avec le compte Boutique T, essayer de commander dans la boutique T.
  - Attendu : « Vous ne pouvez pas commander dans votre propre boutique. »
- [ ] **Suivi.** Ouvrir la commande dans `/compte/commandes`.
  - Attendu : la frise des étapes (Commande envoyée → Confirmée par la boutique → Prête à récupérer → Récupérée) et le bouton « Écrire à la boutique sur WhatsApp ».

### 1.6 Annulation par le client

- [ ] **Annuler une commande demandée.** Sur une commande « Demandée » (ou « Confirmée »), cliquer « Annuler ma commande », écrire un mot facultatif, puis « Confirmer l'annulation ».
  - Attendu : le statut passe à « Annulée » avec le motif « Annulée par le client ».
  - Attendu : si la commande était confirmée, le stock de l'article **remonte**.
- [ ] **Commande prête.** Ouvrir une commande « Prête ».
  - Attendu : le client ne peut plus l'annuler (pas de bouton).

### 1.7 No-show et contestation (côté client)

> Prérequis : la boutique a déclaré « Client pas venu » sur une commande du Client A (voir 2.4).

- [ ] **Message WhatsApp.** Après la déclaration :
  - Attendu : le Client A reçoit un WhatsApp d'avertissement (modèle `oranpromo_no_show`) dans les 5 minutes (prochain passage de cron-job.org).
- [ ] **Liste des no-shows.** Ouvrir `/compte` avec le Client A.
  - Attendu : la rubrique « Commandes non récupérées » liste la commande, avec un bouton « Contester ».
- [ ] **Motif trop court.** Cliquer « Contester » et écrire « non » (moins de 5 caractères).
  - Attendu : « Expliquez en quelques mots pourquoi vous contestez (5 à 300 caractères). »
- [ ] **Contester.** Écrire un motif de 5 à 300 caractères, puis envoyer.
  - Attendu : la contestation est « en attente ».
- [ ] **Une contestation à la fois.** Avec un 2e no-show sur le même client, essayer d'en contester un second pendant que le premier est en attente.
  - Attendu : « Vous avez déjà une contestation en attente… »
- [ ] **Déjà contesté.** Après la décision de l'admin (3.2), essayer de recontester le même no-show.
  - Attendu : « Vous avez déjà contesté ce no-show. »
- [ ] **Délai de 7 jours (lourd / facultatif).** Un no-show de plus de 7 jours.
  - Attendu : « Le délai pour contester est dépassé : un no-show se conteste dans les 7 jours. »
  - À tester en attendant 7 jours, ou avec l'aide d'un développeur qui antidate la déclaration **sur un compte de test uniquement**.

### 1.8 Blocage après 5 no-shows

> Lourd : il faut 5 commandes déclarées « Client pas venu » pour le même client de test. À faire au moins une fois avant le lancement.

- [ ] **Blocage au 5e no-show.** Au 5e « Client pas venu » non annulé :
  - Attendu : le compte du client est bloqué, et il reçoit un WhatsApp de blocage (modèle `oranpromo_compte_bloque`).
- [ ] **Commande refusée.** Le client bloqué essaie de commander.
  - Attendu : « Votre compte est bloqué après 5 commandes non récupérées : contactez OranPromo pour le débloquer. »
- [ ] **Déblocage.** Après le déblocage par l'admin (3.2) :
  - Attendu : le client peut de nouveau commander.

---

## 2. Parcours boutique (commerçant)

### 2.1 Espace et partage de la boutique

- [ ] **Espace.** Se connecter avec le compte Boutique T, puis ouvrir `/espace`.
  - Attendu : la navigation de l'espace (Mes articles, Commandes, Statistiques…).
  - Attendu : la rubrique « Partager ma boutique ».
- [ ] **Copier le lien.** Cliquer pour copier le lien.
  - Attendu : le message « Lien copié ».
  - Attendu : en le collant dans un navigateur, l'adresse est `https://test.<domaine>/b/<slug>` (en production : `https://<domaine>/b/<slug>`) et ouvre la vitrine.
- [ ] **Aperçu du lien.** Coller le lien dans une conversation WhatsApp (avec vous-même).
  - Attendu : un aperçu s'affiche (image « OranPromo » / « Réservez sur WhatsApp, payez en boutique », nom de la boutique).
  - Note : sur la preview protégée par Vercel (Deployment Protection), l'aperçu peut ne pas s'afficher. Refaire ce test en production.
- [ ] **QR code.** Cliquer « Télécharger le QR code ».
  - Attendu : une image se télécharge. En la scannant avec l'appareil photo d'un autre téléphone, la vitrine de la boutique s'ouvre.
- [ ] **Affiche.** Cliquer « Imprimer l'affiche » (page `/espace/affiche`).
  - Attendu : une page A4 avec le nom de la boutique, le QR code et « Scannez pour voir nos articles et nos promos ».
  - Attendu : l'aperçu d'impression tient sur une page, et le QR code imprimé se scanne.

### 2.2 Commandes reçues et changements de statut

- [ ] **Commande reçue.** Le Client A passe une commande dans la boutique T.
  - Attendu : elle apparaît dans « Commandes reçues » (`/espace/commandes`) avec le numéro, le nom, le téléphone (lien WhatsApp), les lignes, le total et la note du client.
  - Attendu : la boutique reçoit un WhatsApp « nouvelle commande » dans les 5 minutes (modèle `oranpromo_nouvelle_commande`, ou `oranpromo_nouvelle_commande_confirmer` si `bouton_confirmer` est activé : voir 2.3).
- [ ] **Confirmer.** Cliquer « Confirmer ».
  - Attendu : le statut passe à « Confirmée ». Le **stock baisse** de la quantité commandée (vérifier dans Mes articles).
  - Attendu : côté client, la frise affiche « Confirmée par la boutique ».
- [ ] **Prête.** Cliquer « Prête ».
  - Attendu : le statut passe à « Prête · jusqu'au <date heure> » (24 h).
  - Attendu : le client reçoit le WhatsApp « commande prête » (`oranpromo_commande_prete`) dans les 5 minutes, et voit « À récupérer avant le … ».
- [ ] **Récupérée.** Cliquer « Récupérée ».
  - Attendu : le statut passe à « Récupérée ». Il n'y a plus de bouton d'action.
- [ ] **Vendu à 0.** Commander puis confirmer la dernière pièce d'un article.
  - Attendu : l'article passe à 0 et la fiche publique affiche « Article plus disponible » ou « Cet article a été vendu ».
- [ ] **Stock insuffisant.** Le Client A commande la dernière pièce. Avant de confirmer, mettre le stock de cet article à 0 dans Mes articles (vente en magasin), puis cliquer « Confirmer ».
  - Attendu : un message de stock insuffisant et le lien « Corriger le stock dans Mes articles ». La commande reste « Demandée ».
- [ ] **Annuler par la boutique.** Sur une commande, cliquer « Annuler ».
  - Attendu : sans motif, « Choisissez le motif de l'annulation. »
  - Choisir « Plus en stock », écrire un « Message au client (facultatif) », puis « Annuler la commande ».
  - Attendu : le statut passe à « Annulée » avec « Motif : Plus en stock », et le lien « Corriger le stock dans Mes articles » s'affiche.
  - Attendu : si la commande était confirmée, le **stock remonte**.
- [ ] **Expiration après 24 h (lourd / facultatif).** Laisser une commande « Prête » sans la marquer « Récupérée » pendant 24 h.
  - Attendu : elle passe à « Expirée » et le stock remonte.
  - Attendu : le client reçoit `oranpromo_commande_expiree`.
  - À faire en attendant 24 h, ou avec l'aide d'un développeur sur une commande de test.
- [ ] **Client pas venu après expiration.** Sur une commande « Expirée », ou « Prête » dont l'heure limite est passée :
  - Attendu : le bouton « Client pas venu » apparaît (voir 2.4). Il n'apparaît pas avant l'heure limite.

### 2.3 Confirmation depuis WhatsApp (lien signé, `CONFIRMATION_SECRET`)

> Deux étapes :
>
> - **Avant l'approbation Meta** du modèle `oranpromo_nouvelle_commande_confirmer` : tester seulement la page `/confirmer/…` à partir d'un lien obtenu par un développeur, ou attendre.
> - **Après l'approbation** et `bouton_confirmer` = `on` (guide, étape 14) : tester avec le vrai bouton.
>
> `bouton_confirmer` est commun à la preview et à la production.

- [ ] **Message avec bouton.** Le Client A passe une commande.
  - Attendu : la boutique reçoit le WhatsApp « Nouvelle commande n° … » avec un bouton **« Confirmer »**.
  - Si le bouton est absent : `bouton_confirmer` n'est pas à `on`, ou le modèle n'est pas approuvé. Le message sans bouton (`oranpromo_nouvelle_commande`) part alors normalement.
- [ ] **Page de confirmation.** Toucher « Confirmer » dans WhatsApp.
  - Attendu : la page `https://<domaine>/confirmer/<jeton>` s'ouvre **sans demander de connexion**, avec le résumé de la commande, la phrase « Le stock baisse à la confirmation. Lien valable 24 h. » et le bouton « Confirmer la commande ».
  - Attendu : le simple fait d'ouvrir la page ne confirme rien (la commande est toujours « Demandée » dans l'espace).
- [ ] **Confirmer depuis la page.** Cliquer « Confirmer la commande ».
  - Attendu : « Commande confirmée : le stock est mis à jour. Pensez à la préparer. »
  - Attendu : dans l'espace, la commande est « Confirmée » et le stock a baissé.
- [ ] **Déjà confirmée.** Rouvrir le même lien.
  - Attendu : « Cette commande est déjà confirmée. »
- [ ] **Commande annulée.** Pour une commande annulée par le client avant confirmation, ouvrir le lien.
  - Attendu : « Cette commande a été annulée : il n'y a rien à confirmer. »
- [ ] **Commande expirée (facultatif).** Ouvrir le lien d'une commande expirée.
  - Attendu : « Cette commande a expiré : il n'y a rien à confirmer. »
- [ ] **Stock insuffisant.** Mettre le stock à 0 puis confirmer par le lien.
  - Attendu : un message de stock insuffisant et le lien « Corriger le stock ou annuler ». La commande n'est pas confirmée.
- [ ] **Lien modifié.** Changer un caractère à la fin de l'adresse `/confirmer/…`.
  - Attendu : « Ce lien n'est pas valide. »
- [ ] **Lien de plus de 24 h (lourd / facultatif).** Ouvrir un lien reçu il y a plus de 24 h.
  - Attendu : « Ce lien a expiré. Confirmez la commande dans votre espace OranPromo, rubrique Commandes. »
- [ ] **Secret absent.** Si `CONFIRMATION_SECRET` ou `jeton_confirmation` manque ou ne correspond pas :
  - Attendu : « La confirmation par lien n'est pas disponible pour le moment… ». Corriger l'étape 3 du guide et redéployer.
- [ ] **Liens de la page.** Vérifier « Voir mes commandes » et « Annuler ou voir toutes mes commandes ».
  - Attendu : ils mènent à l'espace boutique (connexion demandée si nécessaire).

### 2.4 Déclarer un client pas venu

- [ ] **Bouton.** Sur une commande « Expirée », ou « Prête » dont l'heure limite (24 h) est passée, cliquer « Client pas venu ».
  - Le bouton n'existe pas avant : il faut donc attendre 24 h ou demander l'aide d'un développeur (commande de test).
  - Attendu : le texte d'avertissement (« Il recevra un avertissement sur WhatsApp ; au 5e oubli, son compte est bloqué. ») s'affiche.
- [ ] **Confirmer.** Cliquer « Confirmer : pas venu ».
  - Attendu : la carte affiche « Client pas venu · signalé le … ». Le client reçoit `oranpromo_no_show` (voir 1.7).
- [ ] **Retour.** Cliquer « Client pas venu » puis « Retour ».
  - Attendu : rien n'est enregistré.

### 2.5 Statistiques

- [ ] **Statistiques.** Voir 1.3 : `/espace/statistiques` reflète les vues et clics. Sans aucune visite :
  - Attendu : « Aucune vue d'article sur cette période. »

---

## 3. Parcours admin

### 3.1 Accès et tableau de bord

- [ ] **Accès refusé.** Avec un compte client, ouvrir `/admin`.
  - Attendu : « Accès réservé ».
- [ ] **Accès admin.** Avec le compte admin, ouvrir `/admin`.
  - Attendu : les onglets « Tableau de bord », « Boutiques », « Modération », « Clients ».
  - Attendu : la rubrique « À relancer » (ou « Aucune boutique à relancer. ») avec « Relancer sur WhatsApp ».
- [ ] **Boutiques.** Ouvrir « Boutiques », puis filtrer par statut avec « Filtrer par statut » et « Filtrer ».
  - Attendu : la liste se met à jour.
  - Attendu : valider ou suspendre une boutique **de test** change son statut, et une boutique suspendue affiche « Boutique indisponible » côté public.

### 3.2 Clients, no-shows et contestations

- [ ] **Contestations en attente.** Ouvrir `/admin/clients`.
  - Attendu : la contestation du Client A (1.7) apparaît dans « Contestations en attente », avec son motif.
- [ ] **Valider le no-show.** Sur une contestation, cliquer « Valider le no-show ».
  - Attendu : la contestation disparaît de la liste, et le no-show compte toujours.
- [ ] **Annuler le no-show.** Sur une autre contestation, cliquer « Annuler le no-show ».
  - Attendu : le no-show ne compte plus.
  - Attendu : côté boutique, la carte affiche « (annulé par OranPromo) ».
- [ ] **Bloquer.** Cliquer « Bloquer » sur un client de test.
  - Attendu : le client ne peut plus commander (message de blocage, voir 1.8).
- [ ] **Débloquer.** Cliquer « Débloquer ».
  - Attendu : le client peut de nouveau commander.

### 3.3 Modération des signalements

- [ ] **Signalement listé.** Ouvrir `/admin/moderation`.
  - Attendu : le signalement de 1.3, avec « Le plus récent : … » et les boutons « Masquer l'article », « Avertir la boutique », « Suspendre la boutique », « Classer sans suite ».
- [ ] **Classer sans suite.** Cliquer « Classer sans suite ».
  - Attendu : le signalement quitte la liste (« Aucun signalement ouvert. » s'il n'en reste pas), et la décision apparaît dans l'historique.
- [ ] **Masquer l'article.** Sur un autre signalement d'un article **de test**, cliquer « Masquer l'article ».
  - Attendu : l'article n'apparaît plus côté public.

---

## 4. Contrôles transverses

### 4.1 Messages WhatsApp (file d'envoi et cron)

- [ ] **File d'envoi.** Après chaque événement (nouvelle commande, prête, expirée, no-show, blocage), ouvrir la table `messages_whatsapp` dans Supabase.
  - Attendu : une ligne avec le bon `modele` et le bon `destinataire` (+213…).
  - Attendu : `statut` passe de `a_envoyer` à `envoye` en moins de 5 minutes, avec `envoye_le` rempli.
- [ ] **Échecs.** Vérifier qu'aucune ligne ne reste en `echec`.
  - S'il y en a, lire la colonne `erreur` : souvent un modèle non approuvé, un jeton Meta expiré ou l'absence de moyen de paiement (guide, étape 6).
- [ ] **cron-job.org.** Dans cron-job.org, ouvrir l'historique de la tâche.
  - Attendu : un appel toutes les 5 min, avec le code **200** et une réponse `{"envoyes":…,"echecs":…,"reportes":…,"traites":…}`.
  - Si le code est 401 « Accès refusé. », le `CRON_SECRET` de cron-job.org ne correspond pas.
  - Si le code est 503 « Tâche non configurée. », `CRON_SECRET` ou l'empreinte `jeton_notifications` manque.
- [ ] **Textes reçus.** Sur le téléphone :
  - Attendu : les messages reçus correspondent aux textes des modèles (numéro de commande, nom de la boutique, heure limite), sans `{{1}}` visible.

### 4.2 Limites de commandes

> Messages exacts renvoyés par la base. Les tests de 10/h et 20/h sont **lourds**. Pour ne pas bloquer de vrais clients, les faire sur la boutique T avec des comptes de test, et annuler ensuite les commandes.

- [ ] **3 par heure, client et boutique.** Le Client A passe 3 commandes dans la boutique T en moins d'une heure, puis une 4e.
  - Attendu : la 4e est refusée avec « Vous avez déjà passé 3 commandes dans cette boutique en une heure : réessayez plus tard. »
- [ ] **Autre boutique.** Juste après, le Client A commande dans une **autre** boutique.
  - Attendu : c'est accepté (la limite de 3 est par boutique).
- [ ] **5 commandes en cours.** Le Client A a 5 commandes en cours (Demandée, Confirmée ou Prête) et en passe une 6e.
  - Attendu : « Vous avez déjà 5 commandes en cours… »
- [ ] **10 par heure (lourd / facultatif).** Un même client passe 11 commandes dans plusieurs boutiques en une heure.
  - Attendu : refus avec « Trop de commandes en une heure : réessayez plus tard. »
- [ ] **20 par heure par boutique (lourd / facultatif).** Au moins 7 clients de test passent ensemble 21 commandes dans la boutique T en une heure.
  - Attendu : la 21e est refusée avec « Cette boutique a reçu trop de commandes dans la dernière heure : réessayez un peu plus tard. »
  - Les commandes annulées par le client dans les 2 minutes ne comptent pas.

### 4.3 Sécurité de base

- [ ] **Origine.** Sur la preview, toute action (commander, annuler, signaler) fonctionne depuis `https://test.<domaine>`.
  - Si une action échoue seulement sur la preview, vérifier que `NEXT_PUBLIC_SITE_URL` (Preview) vaut bien `https://test.<domaine>` (guide, étape 4).
- [ ] **Aucun secret visible.** Dans le navigateur, afficher le code source d'une page (clic droit → Afficher le code source) et chercher `SECRET`, `sk-ant`, `TOKEN`.
  - Attendu : aucun résultat. Seules la clé publique Supabase et la clé de site Turnstile peuvent apparaître.

---

## 5. Avant la mise en ligne : récapitulatif

- [ ] **Parcours principaux.** Sections 1.3 (vues et Signaler), 1.4, 1.5, 2.1, 2.2, 3.1, 3.2 et 4.1 entièrement cochées.
- [ ] **Confirmation par lien.** Section 2.3 cochée, ou notée « en attente d'approbation Meta ».
- [ ] **Tests lourds.** Tests marqués « lourd / facultatif » faits, ou volontairement reportés (noter lesquels).
- [ ] **Messages arabes.** Les messages WhatsApp sont aujourd'hui en français uniquement. Des modèles en arabe (US-23) seront à prévoir et à tester quand l'arabe sera en ligne.

---

## 6. Retrait des données de démonstration (`supabase/scripts/retirer_donnees_demo.sql`)

> ⚠️ Agit sur la base **commune** preview + production. À faire **une seule fois**, juste avant le lancement (guide, étape 15), et jamais pendant que de vraies commandes sont en cours sur des articles de démo.

- [ ] **Essai à blanc.** Dans Supabase → **SQL Editor**, coller le contenu **intégral** du script **sans le modifier**, puis cliquer **Run**.
  - Attendu : un tableau final indique, table par table, ce qui **serait** supprimé, et rien n'est supprimé. Par défaut, la ligne marquée ⚠ `appliquer constant boolean := false …` laisse le script en simulation.
  - Vérifier : les articles de démo sont toujours visibles sur l'accueil.
- [ ] **Relire le tableau.** Il ne doit concerner que la démo :
  - le compte de test `hakim3142@gmail.com` et la « Boutique Nour » ;
  - les 5 articles de démonstration (3 de Maison Ilyes, 2 de Boutique Nour) ;
  - les photos `placehold.co` ;
  - les messages WhatsApp de test.

  Le compte admin et la boutique « Maison Ilyes » sont **gardés** (vide d'articles ensuite).

  > ⚠️ Si vous avez fait vos tests avec le compte `hakim3142@gmail.com` ou la Boutique Nour, ils disparaîtront : c'est normal.

  En cas de doute, **s'arrêter** et demander à un développeur.
- [ ] **Suppression réelle.** Dans le texte collé, remplacer **uniquement** `appliquer constant boolean := false` par `appliquer constant boolean := true`, puis cliquer **Run**.
  - Attendu : le tableau indique ce qui a été supprimé.
  - En cas d'erreur, **rien** n'est supprimé.
  - Si le script s'arrête en parlant de photos dans le stockage, les supprimer d'abord dans **Storage** → `photos`, puis relancer.
- [ ] **Relance de contrôle.** Relancer une 2e fois, toujours avec `true`.
  - Attendu : **0 partout**.
- [ ] **Vérification sur le site.** Recharger l'accueil, le catalogue et `/b/boutique-nour`.
  - Attendu : plus aucun article de démo, et « Boutique indisponible » pour la Boutique Nour. Les boutiques et articles réels sont toujours là.
- [ ] **WhatsApp de Maison Ilyes.** Changer ou retirer le numéro WhatsApp de Maison Ilyes (numéro du propriétaire), comme indiqué à l'étape 15 du guide.
- [ ] **Ne pas enregistrer la version modifiée.** Fermer l'onglet SQL sans enregistrer la version `true`.

## 7. Ménage après les tests

- [ ] **Commandes de test.** Annuler les commandes de test encore en cours.
- [ ] **No-shows et blocages.** Annuler les no-shows de test (« Annuler le no-show ») et débloquer les clients de test.
- [ ] **Boutique de test.** Suspendre la boutique T si elle ne doit pas être visible en production.
- [ ] **Signalements.** Classer sans suite les signalements de test.

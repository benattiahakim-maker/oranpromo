# État du projet OranPromo

> À lire en premier pour reprendre le travail. Mis à jour le 9 octobre 2026.
> Tableau des tâches : https://trello.com/b/w1W1Amkb/oranpromo

## Où on en est

- Les **19 user stories du MVP sont codées** (US-01 à US-19). Elles sont dans la colonne Trello « À vérifier » : codées, mais pas encore toutes testées en vrai.
- **806 tests** passent (+ 226 tests SQL), `npm run lint` et `npm run build` passent.
- Déjà testé en vrai : la page d'accueil (ancienne version), la fiche article, la réservation WhatsApp.
- Pas encore re-testé : la connexion par lien e-mail (corrigée le 9/10), le nouveau formulaire d'article, et tout ce qui a été fait le 9/10 après-midi (voir ci-dessous).
- **Connexion des clients par téléphone (US-21)** : codée, **pas encore en service**. Le site reste en mode e-mail tant que le propriétaire n'a pas fait la checklist ci-dessous (« US-21 : à configurer par le propriétaire ») ; code par WhatsApp uniquement (pas de SMS), donc rien avant l'approbation de l'expéditeur WhatsApp par Meta.

## Journal des modifications

### 9 octobre 2026 (après-midi, Grok Bot « BOLOSS »)

Travail fait sur une copie du projet hors du PC, par pull request sur GitHub, fusionnée dans `main` après tests, lint et build. Migrations appliquées sur Supabase avec l'accord du propriétaire.

1. **Revue de sécurité** du code, puis corrections :
   - **PR #1** (4 points importants) : un article masqué par la modération ne peut être réaffiché que par un admin (colonne `masque_par_moderation`) ; dates `cree_le` / `derniere_confirmation` fixées par la base (règle des 21 jours infalsifiable) ; seuls admin et ambassadeur créent une boutique ; IA réservée aux boutiques validées avec quota de 30 appels/heure/compte (table `appels_ia`, fonction `consommer_quota_ia()`) ; nom, WhatsApp, slug et liens d'une boutique validée modifiables seulement par l'admin. Migration `securite_corrections_revue` appliquée.
   - **PR #2** (points mineurs) : accueil et catalogue filtrés comme pour le public et paginés ; prix promo < prix normal vérifié en base ; adresses de photos limitées au stockage du projet ; contenu des photos vérifié côté serveur ; taille des envois bornée (routes IA comprises) ; dates et débit des statistiques et signalements contrôlés par la base ; redirections limitées à `NEXT_PUBLIC_SITE_URL`. Migration `securite_points_mineurs` appliquée.
2. **PR #3** Design : barre de défilement grise de la galerie masquée.
3. **PR #4** Tech : miniatures 400 px (`photos.adresse_vignette`) sur les cartes, grandes photos à 1200 px, envoi limité à 4 Mo (limite Vercel 4,5 Mo).
4. **PR #5** Catégories : nouvelle liste en 4 univers (14 catégories mode, 5 beauté avec contenance en ml), filtre « Univers » dans le catalogue, IA à jour. Migration `categories_univers` appliquée (anciennes catégories renommées).
5. **PR #6** Design : nouvelle page d'accueil (univers, grande photo, tuiles par univers et catégorie, images tirées des articles). Maquette `docs/maquettes/Accueil.dc.html`.
6. **Commandes** (US-20, PR #8 à #14) : objet commande avec statut et suivi client.
   - PR #8 docs, stories US-20 à US-20.5 et maquettes ; PR #9 stock par taille (`tailles.quantite`, boutons −/+, « Vendu » à 0) ; PR #10 côté client (rôle `client`, panier d'une seule boutique, « Mes commandes » avec frise, « Ajouter au panier » remplace « Réserver sur WhatsApp ») ; PR #11 côté boutique (Confirmer = le stock baisse, Prête, Récupérée, Annuler avec motif) ; PR #12 expiration 24 h après « prête », no-shows, blocage au 5e, déblocage dans `/admin/clients` ; PR #13 WhatsApp automatique (API Meta, file `messages_whatsapp`, tâche `GET /api/notifications/whatsapp` protégée par `CRON_SECRET`) ; PR #14 types régénérés depuis Supabase.
   - Migrations appliquées : `activer_pg_cron`, `stock_par_taille`, `role_client`, `commandes`, `commandes_boutique`, `expiration_no_shows`, `messages_whatsapp`. Tâche pg_cron `expirer-commandes` toutes les 15 min.
   - Reste à faire : compte WhatsApp Business chez Meta, 5 modèles de messages à faire approuver (voir `docs/architecture.md`), variables `WHATSAPP_*` et `CRON_SECRET` (empreinte dans `prive.reglages`), Vercel Cron déjà déclaré dans `vercel.json` (1 fois par jour en Hobby). Sans ça, les messages restent en attente.
7. **Relecture US-20 par Claude** (PR « US-20 Corrections de la relecture ») : confirmation refusée si le stock ne suffit plus (« Stock insuffisant pour … »), article qui redevient « Disponible » après annulation de plusieurs tailles, blocage suivi par numéro de téléphone, nom du client sans chiffres ni lien, résultat d'envoi WhatsApp réservé au serveur, tâche d'envoi limitée à 5 messages et arrêtée avant 60 s, Vercel Cron dans `vercel.json`, verrous dans un ordre fixe, `search_path` fixé, `server-only`. **No-shows (option C du propriétaire)** : plus de no-show automatique à l'expiration ; la boutique signale « Client pas venu » ; l'admin peut annuler un no-show dans `/admin/clients`. Tests SQL : `supabase/tests/corrections_relecture.test.sql`.
   - Migration `corrections_relecture` **appliquée** sur Supabase le 9/10 à 14 h 23 (PR #16, types vérifiés identiques à la base). Modèles WhatsApp : 5 au lieu de 4 (`oranpromo_no_show` ajouté, `oranpromo_commande_expiree` sans compte d'essais).
8. **Relecture n°2 de US-20 par Claude** (PR #18) :
   - **Blocage d'un tiers corrigé** : le numéro n'étant pas vérifié, n'importe qui pouvait mettre le numéro d'une autre personne sur son compte, faire 5 no-shows et la faire bloquer. Désormais les no-shows et le blocage automatique ne concernent que le compte qui a passé les commandes. Un numéro avec des no-shows utilisé par plusieurs comptes apparaît dans `/admin/clients` (« Numéro partagé par plusieurs comptes ») : l'admin décide (Bloquer / Débloquer, sans message WhatsApp). `/compte` n'affiche plus que le compteur du compte. Le blocage par numéro est gardé dans le code, désactivé (réglage `blocage_par_numero`), à activer avec la V2 SMS.
   - **Limite par boutique** : au plus 20 nouvelles commandes par heure et par boutique, tous clients confondus (coût WhatsApp, tranquillité de la boutique).
   - Migration `20261009233000_numero_non_verifie` **appliquée** sur Supabase le 9/10 vers 15 h (comptes existants recalculés : aucun compte bloqué ni avec no-show en base à ce moment), types régénérés. Tests SQL : `supabase/tests/numero_non_verifie.test.sql` (23) et `corrections_relecture.test.sql` mis à jour (43). `vercel.json` non modifié.
   - **À discuter avec le propriétaire** : une boutique peut passer une commande « prête » tout de suite puis déclarer « Client pas venu » 24 h plus tard, sans que le client ait vraiment eu le temps de venir. → Décision : le client peut contester (point 9).
9. **Contestation d'un no-show** (PR #20, décision du propriétaire) : dans `/compte`, rubrique « Commandes non récupérées », le client conteste un no-show avec un motif court (5 à 300 caractères), une seule fois, seulement pour ses propres commandes. Tant que la contestation est en attente, le no-show ne compte pas (compteur recalculé, compte débloqué s'il repasse sous 5) ; un blocage décidé par l'admin reste en place (nouvelle colonne `profils.bloque_par_admin`). Dans `/admin/clients`, « Contestations en attente » : **Valider le no-show** (il compte de nouveau, blocage possible au 5e) ou **Annuler le no-show**. Aucun nouveau message WhatsApp.
   - Migration `20261009234500_contestation_no_show` **appliquée** sur Supabase le 9/10 vers 15 h, types régénérés. Tests SQL : `supabase/tests/contestation_no_show.test.sql` (28).
10. **Règles de la contestation** (PR #22, décisions du propriétaire sur les points restés ouverts) :
   - contestation possible seulement dans les **7 jours** après la déclaration du no-show (après : refus, et plus de bouton « Contester » dans `/compte`) ;
   - **une seule contestation en attente à la fois** par compte ;
   - le **motif n'est plus lisible par la boutique** : il est dans la nouvelle table `contestations`, lue seulement par le client qui l'a écrit et par l'admin (la boutique voit seulement qu'une commande est contestée).
   - Migration `20261009235500_contestation_regles` **appliquée** sur Supabase le 9/10 vers 15 h (aucun motif existant à déplacer), types régénérés. Tests SQL : `supabase/tests/contestation_regles.test.sql` (14).
11. **Connexion des clients par téléphone (US-21)**, remplace la carte « V2 · Connexion par SMS ». Détails : `docs/user-stories.md` (module 8) et `docs/architecture.md` (« Connexion des clients par téléphone »).
   - **PR #24** : stories US-21 à US-21.4 et conception.
   - **PR #25** (US-21.1, base) : numéro vérifié par code (`profils.telephone_verifie_le`, recopié depuis Supabase Auth, non modifiable à la main) ; numéros mobiles algériens seulement (`+213` puis 5, 6 ou 7, puis 8 chiffres), refusés par la base avant tout envoi de code ; en mode téléphone, commande refusée sans numéro vérifié (« Vérifiez votre numéro de téléphone par code avant de commander. ») ; limites d'envoi par numéro (1 code par minute, 5 par heure) contrôlées par la base avec le jeton du serveur. Migration `20261010090000_numero_verifie` **appliquée** le 9/10, types régénérés. Tests SQL : `numero_verifie.test.sql` (31).
   - **PR #26** (US-21.2, écrans) : `/compte/connexion` en mode téléphone = numéro + code reçu par **WhatsApp**, bouton « Recevoir par SMS » en secours ; lien « Se connecter par e-mail » gardé ; `/compte` : vérification ou changement du numéro par code ; `/panier` : vérification demandée avant « Commander » pour les comptes existants. Captcha **Cloudflare Turnstile** avant chaque envoi de code (et sur le lien e-mail dès que la clé de site est définie, car Supabase l'exige alors pour toutes les connexions). Commerçants et admin : toujours le lien e-mail. Aucune migration.
   - **PR #28** (US-21.3, blocage) : blocage par numéro **activé**, seulement pour les numéros vérifiés (index unique sur les numéros vérifiés ; les anciens numéros saisis à la main ne comptent jamais pour un autre compte) ; section admin « Numéro partagé » supprimée, remplacée par un bouton Bloquer / Débloquer sur chaque client de `/admin/clients` ; contestations inchangées. Migration `20261010100000_blocage_numero_verifie` **appliquée** le 9/10, types à jour. Tests SQL : `blocage_numero_verifie.test.sql` (23), `numero_non_verifie.test.sql` adapté (19).
   - **PR #33** (US-21.5, décision du propriétaire : SMS trop cher) : code **uniquement sur WhatsApp**, bouton « Recevoir par SMS » supprimé, le serveur impose le canal WhatsApp. La connexion par lien e-mail reste permise aux clients (en mode téléphone, ils doivent quand même vérifier leur numéro par WhatsApp pour commander). Aucune migration. 803 tests Vitest (avec US-22).
   - Deux interrupteurs, **e-mail par défaut** : variable `CONNEXION_CLIENT` (Vercel) et réglage `connexion_client` de la base. Aucune clé Twilio ni Turnstile secrète dans le code ou un commit : elles vont uniquement dans le tableau de bord Supabase.
12. **Lien de boutique à partager (US-22)**, partie « lien boutique » de la carte Trello « Parcours · Connexion par code WhatsApp, arabe/darja, lien boutique ». Détails : `docs/user-stories.md` (module 9) et `docs/architecture.md` (« Lien de boutique à partager »).
   - **PR #27** : story et conception. **PR #30** : code et tests.
   - **Slug lisible** : une nouvelle boutique a l'adresse `/b/nom-de-la-boutique` (puis `-2`, `-3`… si le nom est pris) au lieu de `nom-<identifiant de 36 caractères>` ; cela corrige aussi un bug : un nom de plus d'une vingtaine de caractères faisait échouer la création (slug trop long pour la base). Les 2 boutiques existantes gardent leur adresse (`boutique-nour`, `maison-ilyes`). Le slug d'une boutique publiée ne change qu'avec l'admin : le lien imprimé reste valable.
   - **Aperçu du lien** (WhatsApp, Facebook, Instagram, X) : nom, quartier, nombre d'articles disponibles, grande photo du dernier article ; sans article, image générée noir et blanc avec le nom de la boutique (`/b/<slug>/apercu`). Boutique non validée : « Boutique indisponible », pas d'aperçu.
   - **Dans `/espace`**, bloc « Partager ma boutique » : le lien, « Copier le lien », « Partager sur WhatsApp », le **QR code** (généré sur le serveur, sans service externe), « Télécharger le QR code » et « Imprimer l'affiche » (`/espace/affiche`, A4 à poser en boutique). Boutique en attente ou suspendue : message seulement.
   - Migration `20261010120000_slug_lisible` (format du slug vérifié par la base) **appliquée** sur Supabase le 9/10 vers 15 h 30 ; types inchangés (une contrainte de format n'apparaît pas dans les types). Tests SQL : `slug_lisible.test.sql` (14). Nouvelle dépendance : `qrcode` (MIT).
   - **À tester en vrai** : ouvrir `/espace` avec un compte commerçant d'une boutique validée, copier le lien, le coller dans WhatsApp (l'aperçu ne s'affiche qu'une fois le site en ligne avec une adresse publique), scanner le QR code avec un téléphone, imprimer l'affiche.
13. **Images couleur d'Oran sur l'accueil** (PR #35, demande du propriétaire) :
   - grande photo : **vraie photo** du fort de Santa Cruz au-dessus du port (Wikimedia Commons, auteur Bachounda, licence **CC BY-SA 4.0**), avec le **crédit affiché** en bas de la photo (obligatoire : ne pas le retirer) ;
   - tuiles univers et pièces phares : 10 images **générées par IA** pour OranPromo (propriété du projet) ;
   - images optimisées en WebP dans `public/images/accueil/` (photo 115 Ko, tuiles 39 à 59 Ko) ; l'accueil n'utilise plus les photos des articles (une requête de moins) ; plus de tuiles noires unies ;
   - sources, auteurs et licences : `docs/architecture.md`, section « Crédits des images ». Aucune migration.
   - **À tester en vrai** : l'accueil sur téléphone (photo, titre lisible, crédit, tuiles).

14. **Relecture n°4 par Claude** (PR #37 à #39, puis cette mise à jour) :
   - **PR #37** (point 1) : un compte **déjà bloqué** reste bloqué pendant une contestation tant qu'il a 5 no-shows ou plus en comptant la contestation en attente ; seule une décision de l'admin le débloque ; plus de message « compte bloqué » en double. Une contestation en attente empêche toujours un nouveau blocage. Boutique saturée : **3 commandes par heure au plus pour un même client dans une même boutique**, et la limite de 20 par heure de la boutique ne compte plus les commandes annulées par le client dans les 2 minutes. Migration `20261010130000_relecture4_blocage_limites` **appliquée** le 9/10 vers 16 h. Tests SQL : `relecture4_blocage_limites.test.sql` (14), anciens tests adaptés.
   - **PR #38** (point 3) : les comptes commerçant, ambassadeur et admin ne peuvent pas ajouter de numéro de connexion (base + serveur ; `/compte` ne leur propose plus la vérification). Migration `20261010140000_numero_reserve_clients` **appliquée** (aucun compte non client n'avait de numéro). Tests SQL : `numero_reserve_clients.test.sql` (11).
   - **PR #39** (point 4) : nouveau secret **`CODES_TELEPHONE_SECRET`** pour les limites d'envoi des codes, distinct de `CRON_SECRET`. Migration `20261010150000_secret_codes_telephone` **appliquée**. Tests SQL : `secret_codes_telephone.test.sql` (8).
   - Point 2 (limite par numéro appliquée dans Supabase Auth par un hook) : **étudié, pas codé**, voir « Relecture n°4 : limite par numéro dans Supabase Auth » ci-dessous. **Décision du propriétaire (9/10) : option A** — on garde Twilio Verify, pas de hook « Send SMS » ; protection par les réglages (checklist 8 bis).
   - Types inchangés (fonctions du schéma `prive` ou mêmes signatures). 806 tests Vitest, lint et build OK.
15. **Relecture n°5 par Claude** (PR #42, puis cette mise à jour) : un compte qui **cesse d'être client** (rattaché comme commerçant par `rattacher_commercant`, promu admin ou ambassadeur, ou tout autre changement de `profils.role`) **perd son numéro de connexion** : la base vide `auth.users.phone`, `phone_confirmed_at` et `phone_change` (et le code en cours) ; il ne peut plus se connecter par code, seulement par lien e-mail. `profils.telephone_verifie_le` est effacé, et `profils.telephone` aussi **s'il était le numéro de connexion vérifié** (le numéro est libéré : un vrai client peut le vérifier) ; un numéro saisi à la main, non vérifié, est gardé (simple contact, il ne compte jamais pour un autre compte). Les no-shows du compte sont recalculés (ceux comptés par le numéro ne comptent plus). Nettoyage unique des comptes non clients qui avaient encore un numéro : **0 ligne** en production (le compte admin et le compte commerçant n'en avaient pas). Redevenir client ne rend pas le numéro : il faut le vérifier de nouveau par code. Migration `20261010160000_numero_retire_non_clients` **appliquée** le 9/10 vers 16 h 30 (l’historique Supabase contient juste avant une entrée vide du même nom, version 20261009142819, appliquée par erreur : un simple commentaire, sans effet). Tests SQL : `numero_retire_non_clients.test.sql` (21). Types inchangés ; 806 tests Vitest, lint et build OK.

Outils mis en place : connecteurs Supabase, Trello et GitHub (`gh`) côté Grok Bot.

Reste à faire côté propriétaire : plafond de dépenses dans la console Anthropic ; tester en vrai tout ce qui précède ; régler `NEXT_PUBLIC_SITE_URL` à la mise en ligne (**avant d'imprimer des affiches** : le lien et le QR code des boutiques en dépendent) ; configurer la connexion par téléphone (ci-dessous).

## US-21 : à configurer par le propriétaire

⚠️ **Tant que Meta n'a pas approuvé l'expéditeur WhatsApp, aucun code ne part** (il n'y a pas de SMS de secours) : les clients peuvent se connecter par e-mail, mais en mode téléphone **aucun ne peut commander**. Garder `CONNEXION_CLIENT=email` (et ne pas créer le réglage `connexion_client`) jusqu'à l'approbation de Meta et un essai réussi (étape 9).

Rien n'est à mettre dans le code, dans `.env.local` ni dans un commit, sauf la clé de site Turnstile (publique). **Respecter l'ordre** : sinon les connexions (e-mail compris) peuvent être bloquées.

1. **Twilio** (twilio.com) : créer le compte et le passer en compte payant (un compte d'essai n'envoie qu'aux numéros vérifiés à la main). Mettre une alerte de dépenses (Console > Billing).
2. **Service Twilio Verify** (Console > Verify > Services > Create) : nom « OranPromo », code à 6 chiffres, canal **WhatsApp seulement** : **désactiver le canal SMS** (et la voix) dans la configuration des canaux du service, pour qu'aucun SMS ne puisse être payé même si quelqu'un appelle Supabase directement. Les *Geo permissions* SMS ne sont donc pas nécessaires (si la console ne permet pas de désactiver le SMS, n'y autoriser aucun pays pour le SMS). Laisser **Fraud Guard** activé. Noter le *Service SID* (`VA…`).
3. **Expéditeur WhatsApp** : Console Twilio > Messaging > Senders > WhatsApp senders : enregistrer un numéro dédié (pas un numéro déjà utilisé dans l'application WhatsApp) et le relier au compte Meta Business. **Meta doit approuver** l'expéditeur (vérification de l'entreprise et nom affiché, de quelques heures à plusieurs jours). Puis, dans le service Verify, canal WhatsApp : choisir cet expéditeur. Tant que ce n'est pas fait, **aucun client ne peut recevoir de code** : rester en mode e-mail.
4. **Supabase** > Authentication > Sign In / Providers > **Phone** : activer, fournisseur **Twilio Verify**, coller *Account SID*, *Auth Token* et *Verify Service SID* (dans le tableau de bord uniquement). Laisser « Enable phone signup » activé. Vérifier aussi Authentication > Rate Limits (messages par heure).
5. **Cloudflare Turnstile** (dash.cloudflare.com > Turnstile > Add widget) : mode « Managed », domaines `127.0.0.1`, `localhost` et le futur domaine du site. Noter la clé de site et la clé secrète.
6. **Vercel** (et `.env.local` sur le PC pour les essais) : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = clé de site, puis redéployer. Le captcha s'affiche alors sur les formulaires de connexion.
7. **Supabase** > Authentication > Attack Protection : activer la protection captcha, fournisseur **Turnstile**, coller la **clé secrète**. ⚠️ Seulement **après** l'étape 6, sinon plus personne ne peut se connecter.
8. **`CODES_TELEPHONE_SECRET`** (relecture n°4 : secret à part, **pas** `CRON_SECRET`) : choisir 32 caractères aléatoires au moins, le mettre sur Vercel, puis ranger son empreinte dans la base (éditeur SQL Supabase) : `insert into prive.reglages (cle, valeur) values ('jeton_codes_telephone', encode(sha256(convert_to('<CODES_TELEPHONE_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;` **Obligatoire** : sans lui, l'envoi de code est refusé (« La connexion par téléphone n'est pas encore configurée. »). Aujourd'hui l'empreinte n'est pas encore dans la base.
8 bis. **Protections contre les envois abusifs** (relecture n°4, option A retenue par le propriétaire ; elles agissent même si quelqu'un appelle Supabase sans passer par le site) :
   - Supabase > Authentication > **Attack Protection** : protection captcha **activée** (étape 7) ;
   - Supabase > Authentication > **Rate Limits** : « SMS messages sent » (messages par heure pour tout le projet, WhatsApp compris) **bas**, par exemple 20 à 30 par heure au lancement (c'est le plafond de dépense : 30 par heure ≈ 0,12 $ de frais Meta par heure au pire) ; garder 60 s pour « Send OTPs » (1 code par minute et par compte) ; garder 30 demandes par 5 minutes et par IP. Si de vrais clients sont bloqués par le plafond, le remonter petit à petit ;
   - Twilio Verify : **Geo permissions** sur l'Algérie seulement et **Fraud Guard** activé (ils protègent le SMS et la voix, désactivés de toute façon) ; WhatsApp n'a pas de blocage par pays chez Twilio, mais la base refuse déjà tout numéro non algérien ;
   - Twilio : **plafond de dépense** : compte prépayé **sans recharge automatique** (Console > Billing : le solde est le plafond), plus une alerte de consommation (*Usage Triggers*).
9. **Essai** : sur le PC, `CONNEXION_CLIENT=telephone` dans `.env.local`, se connecter avec un numéro algérien (code reçu sur WhatsApp), puis vérifier le numéro d'un compte créé par e-mail depuis `/compte`.
10. **Mise en service**, seulement après l'approbation de Meta et l'essai réussi : `CONNEXION_CLIENT=telephone` sur Vercel, redéployer, **puis** dans l'éditeur SQL Supabase : `insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;` (à partir de là, la base refuse toute commande sans numéro vérifié). Retour au mode e-mail : `delete from prive.reglages where cle = 'connexion_client';`, puis retirer la variable.

**Coûts** (prix publics consultés en octobre 2026, en dollars, à revérifier) :

| Poste | Prix | Source |
|---|---|---|
| Twilio Verify | 0,05 $ par vérification réussie, + prix du canal | twilio.com/en-us/verify/pricing |
| WhatsApp, message d'authentification vers l'Algérie (frais Meta) | environ 0,004 $ par message remis | grille Meta d'octobre 2026, d'après whautomate.com et faslacloud.com (non vérifié sur le site de Meta) ; frais Twilio en plus sur WhatsApp hors Verify (0,005 $), **inconnu** s'ils s'ajoutent avec Verify |
| Cloudflare Turnstile | gratuit | developers.cloudflare.com/turnstile/plans |
| Supabase (connexion par téléphone) | **inconnu** : pas de frais propre trouvé | — |
| Numéro Twilio pour l'expéditeur WhatsApp | **inconnu** (dépend du pays du numéro) | — |

Ordre de grandeur : 1 000 vérifications par WhatsApp ≈ 54 $. Pas de SMS (décision du propriétaire, US-21.5) : un client connecté par e-mail ne paie aucun code, seul l'envoi du code WhatsApp coûte.

## Relecture n°4 : limite par numéro dans Supabase Auth (décision du propriétaire : option A)

Demande de Claude : appliquer la limite « 1 code par minute, 5 par heure et par numéro » et le refus des numéros étrangers **dans Supabase Auth** (un robot peut appeler `POST /auth/v1/otp` ou `PUT /auth/v1/user` directement avec la clé publique, sans passer par le site), avec un hook « Send SMS ».

**Ce que dit la documentation (et le code de Supabase Auth)** :
- le hook « Send SMS » **remplace** l'envoi intégré : « The Send SMS Hook replaces Supabase's built-in SMS sending » (supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) ; le hook reçoit le code (`sms.otp`) et doit le livrer lui-même ;
- dans le code de Supabase Auth (github.com/supabase/auth, `internal/api/phone.go`) : si le hook est activé, Twilio n'est pas appelé ; et (`internal/api/verify.go`) la vérification par Twilio Verify n'a lieu que si le hook est **désactivé** — avec le hook, Supabase vérifie le code lui-même ;
- un hook en fonction Postgres peut renvoyer une erreur (refus), mais en cas de succès **rien n'est envoyé** : impossible de « laisser passer » vers Twilio Verify (supabase.com/docs/guides/auth/auth-hooks) ;
- le hook « Before User Created » ne sert qu'à la **création** de compte (pas à la connexion d'un numéro existant) ; la base refuse déjà les numéros étrangers par déclencheur ;
- limites intégrées de Supabase (supabase.com/docs/guides/auth/rate-limits) : messages envoyés par heure **pour tout le projet** (30 par défaut, réglable), 1 code par minute **par compte** (« Send OTPs »), 30 demandes par 5 minutes **par IP** ; pas de limite « par numéro et par heure » ;
- Twilio Verify : 5 envois au plus vers un même numéro en 10 minutes (erreur 60203, twilio.com/docs/api/errors/60203) ; Fraud Guard et Geo permissions ne protègent que le SMS et la voix, pas WhatsApp (twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard, …/verify-geo-permissions, twilio.com/docs/verify/whatsapp) ; WhatsApp ne facture pas les messages non remis.

**Donc le point 2 n'a pas été codé** (il change l'architecture du fournisseur).

**Décision du propriétaire (9 octobre 2026) : option A.** On garde **Twilio Verify**, **pas de hook « Send SMS »**. La protection passe par les réglages (checklist, étape 8 bis) :
- captcha activé dans Supabase > Authentication > **Attack Protection** ;
- plafond **bas** de codes envoyés par heure pour tout le projet (**20 à 30**) dans Supabase > Authentication > **Rate Limits** ; garder 1 code par minute et par compte ;
- Twilio : **crédit prépayé sans recharge automatique**, envois limités à l'**Algérie**, **Fraud Guard** activé, **alertes de consommation** (Usage Triggers).

Coût : 0,05 $ par vérification réussie + frais Meta ≈ 0,004 $ par message remis. Limite acceptée : pas de vraie limite « 5 par heure et par numéro » dans Supabase Auth face à un robot qui résout le captcha ; un robot peut épuiser le plafond horaire du projet et gêner les vrais clients pendant l'heure, mais la dépense reste plafonnée.

**Évolutions possibles plus tard** (non retenues pour l'instant, à reprendre si des abus apparaissent ou pour se passer de Twilio) :

| Option | Comment | Pour | Contre | Coût par code (Algérie) |
|---|---|---|---|---|
| B. Hook HTTP (Edge Function Supabase) qui envoie le code par l'**API WhatsApp Cloud de Meta** (modèle « Authentification », bouton « copier le code ») | le hook contrôle `prive.envois_codes` (1/min, 5/h par numéro, numéro algérien), puis appelle Meta avec le même compte WhatsApp Business que les messages de commande | limite par numéro appliquée **dans Supabase Auth** ; plus de Twilio du tout (un fournisseur de moins) ; moins cher | nouvelle Edge Function à écrire, déployer et surveiller ; secrets `SEND_SMS_HOOK_SECRETS` et jeton Meta dans les secrets Supabase ; modèle d'authentification à faire approuver par Meta ; Supabase vérifie le code (plus Twilio) ; délai de 5 s maximum pour le hook | frais Meta seuls ≈ 0,004 $ par message remis (grille Meta, non vérifiée sur le site de Meta) |
| C. Hook HTTP qui envoie par **Twilio Messaging** (WhatsApp ou SMS via l'API Messages) | même contrôle que B, envoi par Twilio Messaging au lieu de Verify | limite par numéro dans Supabase Auth ; reste chez Twilio | même travail que B ; perd les protections de Verify ; frais Twilio par message en plus | WhatsApp : frais Meta + 0,005 $ Twilio par message ; SMS : 0,273 $ |

Option D (hook en fonction Postgres + `pg_net`) écartée : `pg_net` est asynchrone, le hook ne saurait pas si le message est parti.

## Reprendre le travail (sur le PC)

1. Fermer la fenêtre noire de `lancer-site.bat` si elle est ouverte.
2. Double-cliquer **`mettre-a-jour.bat`** : il récupère la dernière version depuis GitHub.
   ⚠️ Avant ça, vérifier que ChatGPT a bien fait son commit et son push, sinon son travail est effacé.
3. Double-cliquer **`lancer-site.bat`** : le site s'ouvre sur **http://127.0.0.1:3000**.
   Toujours utiliser 127.0.0.1, pas localhost, sinon la connexion se perd.
4. Ouvrir Trello, colonne **« À faire »**, et commencer par la carte **Test**.

## Façon de travailler

- **Une story (ou une carte) par prompt** donné à ChatGPT. Il doit lire `CLAUDE.md`, la story dans `docs/user-stories.md`, `docs/architecture.md` et la maquette.
- ChatGPT doit **commiter et pousser** avant de dire « fini ». Le message de commit commence par l'identifiant, par exemple `US-07 …`.
- Claude relit le code sur GitHub, corrige la base Supabase et la configuration, puis teste dans Chrome.
- Grok Bot peut aussi coder par pull request sur GitHub, appliquer les migrations Supabase (avec accord) et tenir Trello à jour.
- Le schéma de la base ne change que par un **nouveau** fichier dans `supabase/migrations/`. Ensuite, lancer `npm run db:types`.
- Jamais de clé secrète dans le code, un commit ou le chat. Les clés vont uniquement dans `.env.local` sur le PC.

## Comptes et données de test

| Compte | Rôle | Boutique |
|---|---|---|
| benattia.hakim@gmail.com | admin | Maison Ilyes |
| hakim3142@gmail.com | commerçant | Boutique Nour |

- Pour se connecter : `/espace/connexion`, saisir l'e-mail, puis cliquer sur le lien reçu.
  L'envoi intégré de Supabase est limité à quelques e-mails par heure.
- WhatsApp :
  - Maison Ilyes utilise le numéro du propriétaire (+33 6 38 31 24 98) ;
  - Boutique Nour utilise un numéro volontairement invalide.
  - Ne jamais mettre le numéro d'une vraie personne ou entreprise.
- Articles de test (photos placehold.co) :
  - polo en promo ;
  - chemise ;
  - jean vendu ;
  - robe avec une promo expirée ;
  - foulard.
  - Ils seront supprimés avant la mise en ligne (carte Backlog « Données de test »).

## Infrastructure

- **Supabase** : projet `oranpromo` (`iloyliuzsflzbkhpvxjt`, Paris), plan gratuit.
  - Limites : 500 Mo de base, 1 Go de photos, 5 Go de trafic par mois.
  - Le projet se met en pause après une semaine sans activité.
- **Connexion** :
  - par lien e-mail (commerçants, admin, et clients en mode `email`) ;
  - clients en mode `telephone` : code par WhatsApp uniquement (Twilio Verify, US-21) ou lien e-mail ; à configurer (voir plus haut) ;
  - les URL de redirection autorisées sont `http://127.0.0.1:3000/**` et `http://localhost:3000/**` ;
  - il faudra ajouter le vrai domaine à la mise en ligne.
- **GitHub** : `benattiahakim-maker/oranpromo` (privé).
- **Hébergement** : pas encore en ligne. Prévu sur Vercel ; offre Pro nécessaire pour un usage commercial.

## Prochaines étapes (Trello « À faire »)

1. **Test** : tester tout le parcours en vrai sur le PC (checklist dans la carte), puis les cartes « À vérifier » du 9/10.
2. **Commandes** : tester en vrai (panier, commande, confirmation, prête, expiration), puis configurer WhatsApp Business.
3. **IA** : le propriétaire crée la clé API Claude, la colle dans `.env.local` et fixe un plafond de dépenses.
4. **Catégories** : faire valider la nouvelle liste par 2 ou 3 commerçants.
5. **Connexion par téléphone (US-21)** : suivre la checklist « US-21 : à configurer par le propriétaire », puis tester en vrai.
6. **Lien de boutique (US-22)** : tester le bloc « Partager ma boutique » et l'affiche ; après la mise en ligne, vérifier l'aperçu dans WhatsApp et Facebook.
7. **Accueil** : valider les nouvelles images avec le propriétaire (photo de Santa Cruz, tuiles IA).

Backlog : mise en ligne (Vercel, domaine, envoi d'e-mails), environnements prod et dev (Vercel + second projet Supabase), suppression des données de test, univers Beauté, conditions d'utilisation, marketing.

## Documents de référence

- `CLAUDE.md` : règles pour les agents.
- `docs/user-stories.md` : stories et critères d'acceptation.
- `docs/architecture.md` : tables, règles métier, organisation du code.
- `docs/maquettes/` : maquettes des écrans.

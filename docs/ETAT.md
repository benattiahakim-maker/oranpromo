# État du projet OranPromo

> À lire en premier pour reprendre le travail. Mis à jour le 9 octobre 2026.
> Tableau des tâches : https://trello.com/b/w1W1Amkb/oranpromo

## Où on en est

- Les **19 user stories du MVP sont codées** (US-01 à US-19). Elles sont dans la colonne Trello « À vérifier » : codées, mais pas encore toutes testées en vrai.
- **803 tests** passent (+ 172 tests SQL), `npm run lint` et `npm run build` passent.
- Déjà testé en vrai : la page d'accueil (ancienne version), la fiche article, la réservation WhatsApp.
- Pas encore re-testé : la connexion par lien e-mail (corrigée le 9/10), le nouveau formulaire d'article, et tout ce qui a été fait le 9/10 après-midi (voir ci-dessous).
- **Connexion des clients par téléphone (US-21)** : codée, **pas encore en service**. Le site reste en mode e-mail tant que le propriétaire n'a pas fait la checklist ci-dessous (« US-21 : à configurer par le propriétaire »).

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
   - Deux interrupteurs, **e-mail par défaut** : variable `CONNEXION_CLIENT` (Vercel) et réglage `connexion_client` de la base. Aucune clé Twilio ni Turnstile secrète dans le code ou un commit : elles vont uniquement dans le tableau de bord Supabase.
12. **Lien de boutique à partager (US-22)**, partie « lien boutique » de la carte Trello « Parcours · Connexion par code WhatsApp, arabe/darja, lien boutique ». Détails : `docs/user-stories.md` (module 9) et `docs/architecture.md` (« Lien de boutique à partager »).
   - **PR #27** : story et conception. **PR #30** : code et tests.
   - **Slug lisible** : une nouvelle boutique a l'adresse `/b/nom-de-la-boutique` (puis `-2`, `-3`… si le nom est pris) au lieu de `nom-<identifiant de 36 caractères>` ; cela corrige aussi un bug : un nom de plus d'une vingtaine de caractères faisait échouer la création (slug trop long pour la base). Les 2 boutiques existantes gardent leur adresse (`boutique-nour`, `maison-ilyes`). Le slug d'une boutique publiée ne change qu'avec l'admin : le lien imprimé reste valable.
   - **Aperçu du lien** (WhatsApp, Facebook, Instagram, X) : nom, quartier, nombre d'articles disponibles, grande photo du dernier article ; sans article, image générée noir et blanc avec le nom de la boutique (`/b/<slug>/apercu`). Boutique non validée : « Boutique indisponible », pas d'aperçu.
   - **Dans `/espace`**, bloc « Partager ma boutique » : le lien, « Copier le lien », « Partager sur WhatsApp », le **QR code** (généré sur le serveur, sans service externe), « Télécharger le QR code » et « Imprimer l'affiche » (`/espace/affiche`, A4 à poser en boutique). Boutique en attente ou suspendue : message seulement.
   - Migration `20261010120000_slug_lisible` (format du slug vérifié par la base) **appliquée** sur Supabase le 9/10 vers 15 h 30 ; types inchangés (une contrainte de format n'apparaît pas dans les types). Tests SQL : `slug_lisible.test.sql` (14). Nouvelle dépendance : `qrcode` (MIT).
   - **À tester en vrai** : ouvrir `/espace` avec un compte commerçant d'une boutique validée, copier le lien, le coller dans WhatsApp (l'aperçu ne s'affiche qu'une fois le site en ligne avec une adresse publique), scanner le QR code avec un téléphone, imprimer l'affiche.

Outils mis en place : connecteurs Supabase, Trello et GitHub (`gh`) côté Grok Bot.

Reste à faire côté propriétaire : plafond de dépenses dans la console Anthropic ; tester en vrai tout ce qui précède ; régler `NEXT_PUBLIC_SITE_URL` à la mise en ligne (**avant d'imprimer des affiches** : le lien et le QR code des boutiques en dépendent) ; configurer la connexion par téléphone (ci-dessous).

## US-21 : à configurer par le propriétaire

Rien n'est à mettre dans le code, dans `.env.local` ni dans un commit, sauf la clé de site Turnstile (publique). **Respecter l'ordre** : sinon les connexions (e-mail compris) peuvent être bloquées.

1. **Twilio** (twilio.com) : créer le compte et le passer en compte payant (un compte d'essai n'envoie qu'aux numéros vérifiés à la main). Mettre une alerte de dépenses (Console > Billing).
2. **Service Twilio Verify** (Console > Verify > Services > Create) : nom « OranPromo », code à 6 chiffres, canaux **SMS** et **WhatsApp** activés. Dans Verify > Settings > **Geo permissions** : n'autoriser que l'**Algérie**. Laisser **Fraud Guard** activé. Noter le *Service SID* (`VA…`).
3. **Expéditeur WhatsApp** : Console Twilio > Messaging > Senders > WhatsApp senders : enregistrer un numéro dédié (pas un numéro déjà utilisé dans l'application WhatsApp) et le relier au compte Meta Business. **Meta doit approuver** l'expéditeur (vérification de l'entreprise et nom affiché, de quelques heures à plusieurs jours). Puis, dans le service Verify, canal WhatsApp : choisir cet expéditeur. Tant que ce n'est pas fait, seul le bouton « Recevoir par SMS » fonctionne.
4. **Supabase** > Authentication > Sign In / Providers > **Phone** : activer, fournisseur **Twilio Verify**, coller *Account SID*, *Auth Token* et *Verify Service SID* (dans le tableau de bord uniquement). Laisser « Enable phone signup » activé. Vérifier aussi Authentication > Rate Limits (SMS par heure).
5. **Cloudflare Turnstile** (dash.cloudflare.com > Turnstile > Add widget) : mode « Managed », domaines `127.0.0.1`, `localhost` et le futur domaine du site. Noter la clé de site et la clé secrète.
6. **Vercel** (et `.env.local` sur le PC pour les essais) : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = clé de site, puis redéployer. Le captcha s'affiche alors sur les formulaires de connexion.
7. **Supabase** > Authentication > Attack Protection : activer la protection captcha, fournisseur **Turnstile**, coller la **clé secrète**. ⚠️ Seulement **après** l'étape 6, sinon plus personne ne peut se connecter.
8. **`CRON_SECRET`** sur Vercel + son empreinte dans la base (même réglage que pour WhatsApp, `docs/architecture.md`, mise en service des messages, étape 3) : **obligatoire**, sans lui l'envoi de code est refusé (« La connexion par téléphone n'est pas encore configurée. »). Aujourd'hui l'empreinte n'est pas encore dans la base.
9. **Essai** : sur le PC, `CONNEXION_CLIENT=telephone` dans `.env.local`, se connecter avec un numéro algérien (code par WhatsApp puis par SMS).
10. **Mise en service** : `CONNEXION_CLIENT=telephone` sur Vercel, redéployer, **puis** dans l'éditeur SQL Supabase : `insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;` (à partir de là, la base refuse toute commande sans numéro vérifié). Retour au mode e-mail : `delete from prive.reglages where cle = 'connexion_client';`, puis retirer la variable.

**Coûts** (prix publics consultés en octobre 2026, en dollars, à revérifier) :

| Poste | Prix | Source |
|---|---|---|
| Twilio Verify | 0,05 $ par vérification réussie, + prix du canal | twilio.com/en-us/verify/pricing |
| SMS vers l'Algérie (Twilio) | 0,273 $ par SMS | twilio.com/en-us/sms/pricing/dz |
| WhatsApp, message d'authentification vers l'Algérie (frais Meta) | environ 0,004 $ par message remis | grille Meta d'octobre 2026, d'après whautomate.com et faslacloud.com (non vérifié sur le site de Meta) ; frais Twilio en plus sur WhatsApp hors Verify (0,005 $), **inconnu** s'ils s'ajoutent avec Verify |
| Cloudflare Turnstile | gratuit | developers.cloudflare.com/turnstile/plans |
| Supabase (connexion par téléphone) | **inconnu** : pas de frais propre trouvé | — |
| Numéro Twilio pour l'expéditeur WhatsApp | **inconnu** (dépend du pays du numéro) | — |

Ordre de grandeur : 1 000 connexions par WhatsApp ≈ 54 $ ; par SMS ≈ 323 $. D'où WhatsApp par défaut et le SMS en secours.

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
  - clients en mode `telephone` : code par WhatsApp ou SMS (Twilio Verify, US-21), à configurer (voir plus haut) ;
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

Backlog : mise en ligne (Vercel, domaine, envoi d'e-mails), environnements prod et dev (Vercel + second projet Supabase), suppression des données de test, univers Beauté, conditions d'utilisation, marketing.

## Documents de référence

- `CLAUDE.md` : règles pour les agents.
- `docs/user-stories.md` : stories et critères d'acceptation.
- `docs/architecture.md` : tables, règles métier, organisation du code.
- `docs/maquettes/` : maquettes des écrans.

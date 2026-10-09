# État du projet OranPromo

> À lire en premier pour reprendre le travail. Mis à jour le 9 octobre 2026.
> Tableau des tâches : https://trello.com/b/w1W1Amkb/oranpromo

## Où on en est

- Les **19 user stories du MVP sont codées** (US-01 à US-19). Elles sont dans la colonne Trello « À vérifier » : codées, mais pas encore toutes testées en vrai.
- **622 tests** passent, `npm run lint` et `npm run build` passent.
- Déjà testé en vrai : la page d'accueil (ancienne version), la fiche article, la réservation WhatsApp.
- Pas encore re-testé : la connexion par lien e-mail (corrigée le 9/10), le nouveau formulaire d'article, et tout ce qui a été fait le 9/10 après-midi (voir ci-dessous).

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
   - Migration **à appliquer** (après accord) : `20261009230000_corrections_relecture.sql`. Modèles WhatsApp : 5 au lieu de 4 (`oranpromo_no_show` ajouté, `oranpromo_commande_expiree` sans compte d'essais).

Outils mis en place : connecteurs Supabase, Trello et GitHub (`gh`) côté Grok Bot.

Reste à faire côté propriétaire : plafond de dépenses dans la console Anthropic ; tester en vrai tout ce qui précède ; régler `NEXT_PUBLIC_SITE_URL` à la mise en ligne.

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
  - par lien e-mail (le SMS demande Twilio, prévu en V2) ;
  - les URL de redirection autorisées sont `http://127.0.0.1:3000/**` et `http://localhost:3000/**` ;
  - il faudra ajouter le vrai domaine à la mise en ligne.
- **GitHub** : `benattiahakim-maker/oranpromo` (privé).
- **Hébergement** : pas encore en ligne. Prévu sur Vercel ; offre Pro nécessaire pour un usage commercial.

## Prochaines étapes (Trello « À faire »)

1. **Test** : tester tout le parcours en vrai sur le PC (checklist dans la carte), puis les cartes « À vérifier » du 9/10.
2. **Commandes** : tester en vrai (panier, commande, confirmation, prête, expiration), puis configurer WhatsApp Business.
3. **IA** : le propriétaire crée la clé API Claude, la colle dans `.env.local` et fixe un plafond de dépenses.
4. **Catégories** : faire valider la nouvelle liste par 2 ou 3 commerçants.

Backlog : mise en ligne (Vercel, domaine, envoi d'e-mails), environnements prod et dev (Vercel + second projet Supabase), suppression des données de test, SMS (V2), univers Beauté, conditions d'utilisation, marketing.

## Documents de référence

- `CLAUDE.md` : règles pour les agents.
- `docs/user-stories.md` : stories et critères d'acceptation.
- `docs/architecture.md` : tables, règles métier, organisation du code.
- `docs/maquettes/` : maquettes des écrans.

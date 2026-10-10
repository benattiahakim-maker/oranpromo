# Guide de mise en ligne de BleDeal (pour le propriétaire)

> **Pour qui** : le propriétaire, sans connaissances en développement.
> **Sources** : rédigé le 9 octobre 2026, puis mis à jour le 10 octobre 2026, d'après `docs/ETAT.md` (journal, points 1 à 28, et listes « à faire par le propriétaire »), `docs/architecture.md`, le code de la branche `main`, et la documentation officielle de chaque service (liens en fin de guide).
> **En cas de différence**, c'est `docs/ETAT.md` qui fait foi : prévenez le développeur.
> **Pas de captures d'écran** : les écrans des services changent souvent. Quand un chemin de menu n'a pas pu être vérifié, c'est écrit **(chemin à confirmer)**.
>
> BleDeal s'appelait OranPromo. Les **identifiants techniques** gardent l'ancien nom et doivent être recopiés **tels quels** :
> - les noms des modèles WhatsApp `oranpromo_*` ;
> - le dépôt GitHub `benattiahakim-maker/oranpromo`, tant qu'il n'est pas renommé ;
> - le projet Supabase `oranpromo` (`iloyliuzsflzbkhpvxjt`) ;
> - les clés internes du navigateur.

## ⚠️ À savoir tout de suite

1. **Aucun message WhatsApp ne part aujourd'hui.** L'empreinte de **`CRON_SECRET`** (clé `jeton_notifications` dans `prive.reglages`) est **absente de la base** (`docs/ETAT.md`, point 22). Sans elle, rien ne part :
   - ni « nouvelle commande », « prête », « expirée », « client pas venu », « compte bloqué » ;
   - ni les boutons « Confirmer » et « Mon QR code ».
   C'est l'étape 3 : à faire en priorité.
2. **`VISITEURS_SECRET`** et son empreinte (`jeton_visiteurs`) sont indispensables. Sans eux, aucune statistique n'est enregistrée, et « Signaler cet article » répond « pas disponible » (étape 3).
3. **Parrainage.** D'après le développeur (10/10), il a été **activé en production**. Pourtant `docs/ETAT.md` le décrit encore « fermé ». Vérifiez son état dès maintenant (étape 16.1) : les bons de 300 DA ne doivent circuler qu'une fois **l'accord écrit signé par chaque boutique** et le **budget** vérifié.
4. **Le domaine `bledeal.com` n'est pas encore acheté.** Les modèles WhatsApp à bouton, `NEXT_PUBLIC_SITE_URL`, les affiches et la clé CARTO en dépendent : achetez-le au début (étape 1).

## Avant de commencer : 7 règles

1. **Aucune clé ni aucun secret** dans :
   - un e-mail, un chat (ChatGPT, Claude, Grok compris), une capture ;
   - un commit ou un fichier du dépôt.

   Les secrets vont **uniquement** dans les tableaux de bord (Vercel, Supabase, cron-job.org) et dans `.env.local` sur votre PC. Dans ce guide, `<CRON_SECRET>`, `<VISITEURS_SECRET>`, etc. sont des **emplacements** à remplacer : n'écrivez jamais la vraie valeur dans ce fichier.
2. **Gardez vos secrets dans un gestionnaire de mots de passe** (Bitwarden, 1Password, le trousseau du téléphone…).
3. **Fabriquer un secret** : générateur du gestionnaire de mots de passe, **40 caractères, lettres et chiffres seulement**. Pas d'espace, pas d'apostrophe `'`, pas de guillemet : une apostrophe casse la commande SQL de l'empreinte. Un secret différent pour chaque variable.
4. **Respectez l'ordre des étapes.** Certaines, faites trop tôt, bloquent toutes les connexions (étape 12) ou envoient des messages refusés par Meta (étape 15).
5. **Après chaque changement de variable sur Vercel, redéployez.** Vercel n'applique une variable qu'aux nouveaux déploiements ([doc Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)). Les variables `NEXT_PUBLIC_…` sont copiées dans le site à la construction.
6. **Une seule base pour tout.** La preview et la production utilisent **le même projet Supabase**. Conséquences :
   - les 4 secrets (`CRON_SECRET`, `VISITEURS_SECRET`, `CODES_TELEPHONE_SECRET`, `CONFIRMATION_SECRET`) ont **la même valeur en Production et en Preview** ;
   - une commande de test sur la preview est une **vraie ligne** dans la base, et ses messages WhatsApp partent vraiment ;
   - les **réglages de la base** valent pour les deux : `connexion_client`, `bouton_confirmer`, `bouton_retrait`, `modeles_arabes`, `parrainage`, `parrainage_budget_mois`.
7. **Interrupteurs dans la base.** Ils s'activent par une commande SQL (Supabase › **SQL Editor**) et se désactivent par une autre. Chaque étape donne les deux commandes.

---

## La liste complète, dans l'ordre (à cocher)

Chaque ligne renvoie à l'étape détaillée plus bas. Les étapes 0, 7 et 9 dépendent de Meta (jours ou semaines d'attente) : lancez-les tôt et continuez le reste pendant l'attente.

**Comptes et domaine**
- [ ] 0.1 Meta : lancer la **vérification de l'entreprise** (portefeuille « BleDeal »).
- [ ] 0.2 Facebook : choisir un **autre nom de Page** que « @bledeal » (déjà pris).
- [ ] 1.1 Acheter **`bledeal.com`**.
- [ ] 1.2 Vercel en **Pro** (usage commercial).
- [ ] 1.3 Projet Vercel relié au dépôt.
- [ ] 1.4 Domaines `bledeal.com` + `www.bledeal.com`, avec `www` redirigé vers `bledeal.com`.
- [ ] 1.5 Preview fixe `test.bledeal.com` sur la branche `test`.

**Base de données et e-mails**
- [ ] 2.1 Supabase **Pro** + Spend Cap.
- [ ] 2.2 URL Configuration : `https://bledeal.com`.
- [ ] 2.3 E-mails par Resend (expéditeur « BleDeal »).
- [ ] 2.4 Modèles d'e-mails relus (« BleDeal »).
- [ ] 3 Les **4 secrets** et leurs empreintes (**`CRON_SECRET` → `jeton_notifications` en premier**), avec la vérification.

**Variables et services**
- [ ] 4 Toutes les **variables Vercel** (Production et Preview), puis redéploiement.
- [ ] 5 Anthropic : clé + plafond de dépenses.
- [ ] 6 CARTO : clé `NEXT_PUBLIC_CARTO_CLE` (usage commercial), restreinte aux domaines.
- [ ] 7.1 Meta WhatsApp : numéro des messages, nom affiché « BleDeal ».
- [ ] 7.2 Meta WhatsApp : jeton permanent, moyen de paiement.
- [ ] 7.3 Les **7 modèles français** à faire approuver.
- [ ] 7.4 Les **4 modèles arabes** `_ar` à faire approuver.
- [ ] 8 cron-job.org toutes les 5 minutes.
- [ ] 9 Twilio : compte prépayé, expéditeur WhatsApp des codes, service Verify « BleDeal ».
- [ ] 10 Supabase : connexion par téléphone (Twilio Verify) + plafonds.
- [ ] 11 Cloudflare Turnstile (`bledeal.com`, `test.bledeal.com`…).
- [ ] 12 Supabase : protection captcha (**seulement après l'étape 11**).

**Mise en service, une fonction à la fois**
- [ ] 13 Essai du mode téléphone sur la preview.
- [ ] 14 Mise en service du mode téléphone (`connexion_client`).
- [ ] 15.1 `bouton_confirmer` = `on`, après l'approbation de `oranpromo_nouvelle_commande_confirmer`.
- [ ] 15.2 `bouton_retrait` = `on`, après l'approbation de `oranpromo_commande_prete_retrait`.
- [ ] 15.3 `modeles_arabes` = `on`, après l'approbation des **4** modèles `_ar`.
- [ ] 16 Parrainage :
  - [ ] état vérifié ;
  - [ ] **accord écrit signé** par chaque boutique ;
  - [ ] budget mensuel ;
  - [ ] `parrainage` = `on` seulement ensuite.

**Boutiques, villes et projet**
- [ ] 17.1 Position sur la carte de chaque boutique.
- [ ] 17.2 Ville de chaque boutique et des ambassadeurs.
- [ ] 18.1 GitHub : dépôt renommé `bledeal`.
- [ ] 18.2 Facultatif : noms des projets Vercel / Supabase / Claude.

**Jour J et ensuite**
- [ ] 19.1 Retrait des **données de démonstration** (Boutique Nour, Parfumerie Démo, 10 articles).
- [ ] 19.2 WhatsApp de Maison Ilyes changé.
- [ ] 19.3 Affiches imprimées **après** `NEXT_PUBLIC_SITE_URL`.
- [ ] 19.4 Contrôles finaux.
- [ ] 20.1 Chaque mois, **avant le 10** : remboursement des bons aux boutiques.
- [ ] 20.2 Chaque semaine : surveillance.
- [ ] 20.3 Ville suivante (Mostaganem) ouverte quand elle est prête.

### Tous les réglages de la base (`prive.reglages`)

| Clé | Valeur | Rôle | Étape |
|---|---|---|---|
| `jeton_notifications` | empreinte de `CRON_SECRET` | ⚠️ **absente aujourd'hui** : aucun WhatsApp ne part | 3 |
| `jeton_visiteurs` | empreinte de `VISITEURS_SECRET` | statistiques, « Signaler » | 3 |
| `jeton_codes_telephone` | empreinte de `CODES_TELEPHONE_SECRET` | codes de connexion par WhatsApp | 3 |
| `jeton_confirmation` | empreinte de `CONFIRMATION_SECRET` | lien « Confirmer » | 3 |
| `connexion_client` | `telephone` | la base exige un numéro vérifié pour commander | 14 |
| `bouton_confirmer` | `on` | message « nouvelle commande » avec bouton « Confirmer » | 15.1 |
| `bouton_retrait` | `on` | message « commande prête » avec bouton « Mon QR code » | 15.2 |
| `modeles_arabes` | `on` | messages au client en arabe si la commande a été passée en arabe | 15.3 |
| `parrainage` | `on` | parrainage ouvert (bons de 300 DA) | 16 |
| `parrainage_budget_mois` | montant en DA | budget mensuel des bons (30 000 DA au départ, 0 = aucun bon) ; réglé depuis `/admin/parrainages`, pas en SQL | 16 |

Pour voir l'état en une fois (les secrets n'y sont pas, seulement des empreintes) :

```sql
select cle, case when cle like 'jeton_%' then length(valeur)::text else valeur end as valeur from prive.reglages order by cle;
```

---

## Étape 0 — Meta : vérification de l'entreprise et Page Facebook (à lancer en premier)

**Pourquoi** : sans entreprise vérifiée, Meta limite les envois WhatsApp et le nombre de numéros (2 au plus par portefeuille non vérifié). La vérification prend souvent 1 à 2 semaines, parfois plus ([Twilio, Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) ; [Twilio, limites de numéros](https://www.twilio.com/docs/whatsapp/api)).

### 0.1 Vérification de l'entreprise
1. Ouvrir **Meta Business Suite** (business.facebook.com) avec votre compte Facebook. Créer un **portefeuille d'entreprise** (Business Portfolio) « BleDeal » s'il n'existe pas.
   - Facultatif : si un portefeuille « OranPromo » existe déjà, le renommer « BleDeal » (`docs/ETAT.md`, liste BleDeal, point 4).
2. Dans le portefeuille : **Paramètres** (roue dentée) › **Centre de sécurité** (Security Center) › **Vérification de l'entreprise** › **Commencer**.
3. Fournir les documents demandés : registre de commerce, justificatif d'adresse, site web, e-mail sur le domaine.

**Vérifier** : le Centre de sécurité affiche « Vérifiée ».

**Pièges**
- Le nom légal et l'adresse doivent être **exactement** ceux des documents.
- Le domaine `bledeal.com` et une adresse e-mail `@bledeal.com` accélèrent la vérification : faites l'étape 1.1 en parallèle.
- « Meta Verified » (abonnement payant) n'est **pas** la vérification d'entreprise : ne pas l'acheter.

### 0.2 Page Facebook : « @bledeal » est déjà pris
D'après le propriétaire (10/10), le nom d'utilisateur **@bledeal est déjà pris sur Facebook**. Cette information n'est pas encore dans `docs/ETAT.md`.
1. Créer la Page de la marque avec un **autre nom d'utilisateur** : facebook.com › **Pages** › **Créer une Page** (chemin à confirmer).
   - Exemples : `bledeal.dz`, `bledealdz`, `bledeal.algerie`. La disponibilité se voit au moment de la saisie.
2. Garder **« BleDeal »** comme **nom affiché** de la Page, si Facebook l'accepte. Seul le nom d'utilisateur (l'adresse `facebook.com/…`) doit changer.
3. Relier la Page au portefeuille « BleDeal » (Paramètres de l'entreprise › Comptes › Pages).

**Pièges**
- Meta compare le **nom affiché WhatsApp** (« BleDeal », étape 7.1) avec la marque visible sur le site et les pages publiques. Une Page au nom très différent peut retarder l'examen. Gardez « BleDeal » dans le nom affiché de la Page.
- Faites de même pour Instagram si un compte est prévu : vérifier que le nom est libre avant d'imprimer quoi que ce soit.

---

## Étape 1 — Domaine `bledeal.com` et Vercel (production + preview)

**Pourquoi** : le site doit avoir son adresse définitive. Elle sert à :
- les liens de connexion ;
- les liens, QR codes et affiches des boutiques ;
- l'aperçu des liens partagés ;
- les boutons WhatsApp « Confirmer » (`/confirmer/…`) et « Mon QR code » (`/retrait/…`) ;
- la clé CARTO.

**Aucun ancien domaine n'a été acheté et aucune affiche n'est imprimée : aucune redirection à prévoir** (`docs/ETAT.md`).

### 1.1 Acheter le domaine
Acheter **`bledeal.com`** chez un vendeur de domaines (registraire). `bledeal.com` n'est **pas encore acheté** au 10/10.

### 1.2 Plan Vercel
Le plan gratuit **Hobby est réservé à un usage personnel, non commercial** ([Vercel, plan Hobby](https://vercel.com/docs/plans/hobby)).
- BleDeal étant commercial, passer en **Pro** avant le lancement : tableau de bord Vercel › **Settings** › **Billing** › **Upgrade**.
- Les essais fonctionnent aussi en Hobby.

### 1.3 Projet
1. vercel.com › **Add New…** › **Project** › importer le dépôt GitHub `benattiahakim-maker/oranpromo` (à renommer `bledeal` à l'étape 18 ; Vercel suit le renommage).
2. Avant **Deploy** : **Environment Variables** › ajouter au moins `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase › **Project Settings** › **API**). Les autres viennent à l'étape 4.
3. Branche de production : `main`.

### 1.4 Domaine de production
1. Projet Vercel › **Settings** › **Domains** › **Add Domain** › `bledeal.com`. Accepter aussi `www.bledeal.com`, **redirigé vers `bledeal.com`** : l'adresse principale est **sans `www`** ([doc](https://vercel.com/docs/domains/working-with-domains/add-a-domain)).
2. Chez le vendeur du domaine : créer les enregistrements DNS affichés par Vercel (**A** pour `bledeal.com`, **CNAME** pour `www`).

### 1.5 Adresse fixe de la preview
Les liens de connexion ne marchent que sur l'adresse écrite dans `NEXT_PUBLIC_SITE_URL` (règle de sécurité, `lib/origine.ts`). Une preview a donc besoin d'**une adresse fixe** :
1. Demander au développeur une branche Git `test`, tenue à jour avec ce qu'il faut tester.
2. Vercel › **Settings** › **Domains** › **Add Domain** › `test.bledeal.com` › **Edit** › **Connect to an environment** : **Preview**, **Git Branch** : `test` ([doc](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch) ; [environnements](https://vercel.com/docs/deployments/environments)).

**Vérifier**
- `https://bledeal.com` et `https://test.bledeal.com` affichent l'accueil (cadenas présent).
- `https://www.bledeal.com` renvoie vers `https://bledeal.com`.
- `https://bledeal.com/` mène à `https://bledeal.com/oran`, seule ville ouverte.
- Settings › Domains : « Valid Configuration ».

**Pièges**
- `NEXT_PUBLIC_SITE_URL` doit être **exactement** `https://bledeal.com` : sans `www`, sans `/` final.
- La preview est protégée (**Deployment Protection** › Standard Protection) : il faut être connecté à Vercel pour l'ouvrir ([doc](https://vercel.com/docs/deployment-protection)). Ne pas retirer cette protection. L'aperçu des liens dans WhatsApp ou Facebook se teste donc sur la production.
- La tâche planifiée de Vercel (`vercel.json`, une fois par jour) ne tourne **que sur la production** ([doc](https://vercel.com/docs/cron-jobs)).

---

## Étape 2 — Supabase : plan, adresses, e-mails

### 2.1 Plan Pro
- **Pourquoi** : un projet gratuit se met **en pause après 7 jours sans activité** et n'a pas de sauvegarde téléchargeable ([check-list production Supabase](https://supabase.com/docs/guides/deployment/going-into-prod)).
- **Où** : supabase.com › votre **organisation** › **Billing** › plan **Pro**. Laisser le **Spend Cap** **activé** ([doc](https://supabase.com/docs/guides/platform/cost-control)).
- **Vérifier** : « Pro Plan » et « Spend Cap : enabled ».

### 2.2 Adresses autorisées (URL Configuration)
- **Où** : projet `oranpromo` › **Authentication** › **URL Configuration** ([doc](https://supabase.com/docs/guides/auth/redirect-urls)).
- **Site URL** : `https://bledeal.com`.
- **Redirect URLs** :
  - ajouter `https://bledeal.com/**` et `https://test.bledeal.com/**` ;
  - **garder** `http://127.0.0.1:3000/**` et `http://localhost:3000/**`.
- **Vérifier** : connexion par lien e-mail sur `https://bledeal.com/espace/connexion` ; le lien reçu ramène sur le site, connecté.

### 2.3 E-mails de connexion par Resend
- **Pourquoi** : l'envoi intégré de Supabase n'envoie qu'**aux membres de l'équipe** et **2 e-mails par heure** ([doc SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
- **Resend** (resend.com) :
  1. **Domains** › **Add Domain** › `bledeal.com` (ou `mail.bledeal.com`), créer les enregistrements DNS affichés (SPF, DKIM), attendre « Verified ».
  2. Désactiver le **suivi des clics** (click tracking) : il réécrit les liens et peut casser les liens de connexion ([Supabase](https://supabase.com/docs/guides/deployment/going-into-prod)).
  3. **API Keys** › **Create API Key** (« Sending access », limité à ce domaine).
- **Supabase** : **Authentication** › **Emails** › **SMTP Settings** › **Custom SMTP** ([Resend](https://resend.com/docs/send-with-supabase-smtp)) :
  - Sender email `no-reply@bledeal.com` ; **Sender name `BleDeal`** ;
  - Host `smtp.resend.com`, Port `465`, Username `resend`, Password : la clé API Resend.
- **Authentication** › **Rate Limits** : avec un SMTP personnel, la limite d'e-mails part de **30 par heure**. La monter, par exemple à 100 ([doc](https://supabase.com/docs/guides/auth/rate-limits)).
- **Vérifier** : demander un lien avec une adresse **hors équipe Supabase** (Gmail personnel). L'e-mail arrive, avec l'expéditeur « BleDeal » `no-reply@bledeal.com`.

### 2.4 Textes des e-mails
**Authentication** › **Emails** › **Templates** : relire chaque modèle (lien magique, confirmation…) et remplacer « OranPromo » par « BleDeal » s'il y figure (`docs/ETAT.md`, liste BleDeal, point 3).

---

## Étape 3 — Les 4 secrets et leurs empreintes dans la base (⚠️ `CRON_SECRET` en premier)

La base ne garde jamais un secret, seulement son **empreinte** (SHA-256) dans `prive.reglages`. Le site envoie le secret, la base calcule l'empreinte et compare.

| Variable (Vercel) | Clé de l'empreinte | Sans elle |
|---|---|---|
| **`CRON_SECRET`** ⚠️ **empreinte absente aujourd'hui** | `jeton_notifications` | **aucun message WhatsApp ne part**, ni juste après une action, ni par la tâche planifiée. Les boutons « Confirmer » et « Mon QR code » non plus : le jeton de retrait est demandé à la base avec ce secret. Les messages s'accumulent en `a_envoyer` dans `messages_whatsapp`. |
| **`VISITEURS_SECRET`** ⚠️ | `jeton_visiteurs` | aucune vue, aucun clic « Ajouter au panier », aucun partage enregistré (statistiques vides) ; « Signaler cet article » répond « Le signalement n’est pas disponible pour le moment. Réessayez plus tard. » |
| `CODES_TELEPHONE_SECRET` | `jeton_codes_telephone` | aucun code de connexion par WhatsApp (« La connexion par téléphone n’est pas encore configurée. ») |
| `CONFIRMATION_SECRET` | `jeton_confirmation` | message « nouvelle commande » sans bouton « Confirmer » ; la page du lien dit « pas disponible » |

**Quoi faire**
1. Fabriquer 4 secrets (règle 3) et les ranger dans le gestionnaire de mots de passe.
2. Supabase › **SQL Editor** › **New query**. Remplacer **seulement** le texte entre `'<` et `>'` (garder les apostrophes), puis **Run** :

```sql
insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('<CRON_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_visiteurs', encode(sha256(convert_to('<VISITEURS_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_codes_telephone', encode(sha256(convert_to('<CODES_TELEPHONE_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_confirmation', encode(sha256(convert_to('<CONFIRMATION_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
```

3. **Effacer ensuite la requête** de l'éditeur SQL, et l'extrait enregistré s'il y en a un : elle contient les secrets en clair.

**Vérifier**
- `select cle, length(valeur) from prive.reglages where cle like 'jeton_%' order by cle;` → les **4** clés, chacune de longueur **64**.
- Après l'étape 4 : messages WhatsApp (étape 8), statistiques et « Signaler » (étape 4).

**Pièges**
- La valeur sur Vercel doit être **exactement** celle utilisée ici. Un caractère de différence = refus silencieux.
- Changer un secret plus tard = **trois** choses :
  1. nouvelle valeur sur Vercel (Production **et** Preview) + redéploiement ;
  2. nouvelle empreinte (même commande) ;
  3. pour `CRON_SECRET`, mise à jour sur cron-job.org (étape 8).
- Jamais le même secret pour deux variables.

---

## Étape 4 — Les variables sur Vercel

**Où** : projet Vercel › **Settings** › **Environment Variables** › **Name**, **Value**, environnements, **Save** ([doc](https://vercel.com/docs/environment-variables/managing-environment-variables)). Pour une valeur propre à la preview : **Preview** et branche `test`.

| Variable | Production | Preview (branche `test`) | Remarque |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iloyliuzsflzbkhpvxjt.supabase.co` | idem | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique Supabase | idem | publique |
| `NEXT_PUBLIC_SITE_URL` | **`https://bledeal.com`** | `https://test.bledeal.com` | **différente** ; à régler **avant d'imprimer des affiches** |
| `NEXT_PUBLIC_CARTO_CLE` | clé CARTO de l'étape 6 | même clé si `test.bledeal.com` est autorisé chez CARTO | publique ; vide = tuiles OpenStreetMap, **interdites en production** |
| `CRON_SECRET` | secret | **même valeur** | étape 3 ; 16 caractères au moins (le code refuse plus court) |
| `VISITEURS_SECRET` | secret | **même valeur** | étape 3 |
| `CODES_TELEPHONE_SECRET` | secret | **même valeur** | étape 3 |
| `CONFIRMATION_SECRET` | secret | **même valeur** | étape 3 |
| `ANTHROPIC_API_KEY` | clé de l'étape 5 | idem | secrète |
| `ANTHROPIC_MODELE` | `claude-haiku-5-5` | idem | valeur de `.env.example` |
| `WHATSAPP_FOURNISSEUR` | `meta` | idem | |
| `WHATSAPP_TOKEN` | jeton de l'étape 7.2 | idem | secret |
| `WHATSAPP_PHONE_NUMBER_ID` | identifiant de l'étape 7.1 | idem | |
| `WHATSAPP_LANGUE` | `fr` | idem | les modèles `…_ar` partent en `ar` d'eux-mêmes |
| `WHATSAPP_API_VERSION` | `v23.0` (ou vide) | idem | ne changer que sur conseil du développeur |
| `CONNEXION_CLIENT` | `email` | `email` | passe à `telephone` aux étapes 13-14 seulement |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clé de site de l'étape 11 | idem | publique |

Puis **Deployments** › dernier déploiement de production › **⋯** › **Redeploy**. Faire de même pour la branche `test`.

**Vérifier**
- **`VISITEURS_SECRET`** : sur une fiche article, « Signaler cet article » › motif › « Envoyer le signalement » → « Merci, nous allons vérifier. ». Le lendemain, `/espace/statistiques` montre des vues.
- **`NEXT_PUBLIC_SITE_URL`** : `/espace` d'un commerçant, bloc « Partager ma boutique » → le lien commence par `https://bledeal.com/b/`.

**Pièges**
- Copier-coller sans espace ni retour à la ligne en trop.
- Sur le PC, `.env.local` :
  - `NEXT_PUBLIC_SITE_URL` reste `http://localhost:3000` ;
  - `NEXT_PUBLIC_CARTO_CLE` : clé de développement à part (étape 6), ou vide.

---

## Étape 5 — Anthropic (IA) : clé et plafond de dépenses

1. Console Claude (anciennement console.anthropic.com) › **Settings** › **Workspaces** : créer un espace de travail « BleDeal ». Les plafonds ne peuvent pas être posés sur l'espace par défaut.
2. Dans cet espace : régler un **plafond de dépenses mensuel** (par exemple 20 $), puis **API Keys** › créer une clé → `ANTHROPIC_API_KEY`.
3. **Settings** › **Billing** › **Spend limits** › **Set limit** : plafond pour l'organisation ([doc](https://docs.claude.com/en/api/rate-limits)). Laisser toute recharge automatique **désactivée**.

**Vérifier** : un commerçant ajoute un article avec photo, et le titre et la description se remplissent. **Usage** montre l'appel.

**Piège** : quand le plafond est atteint, l'IA s'arrête jusqu'au mois suivant. Le formulaire reste utilisable à la main. Le site limite déjà à 30 appels par heure et par compte.

---

## Étape 6 — CARTO : clé de la carte des boutiques (US-24)

**Pourquoi** : la carte (`/oran/carte`, et le bloc « Position sur la carte ») utilise le fond **CARTO Positron**. Sans `NEXT_PUBLIC_CARTO_CLE`, le site prend les tuiles OpenStreetMap. Leur politique autorise à couper un service commercial à tout moment : réservées au développement (`docs/ETAT.md`, point 18).

1. Aller sur [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/) › **Request a key** avec votre e-mail. Déclarer un **usage commercial** : gratuit jusqu'à **1 million de tuiles par mois**, puis 500 $/mois ([page CARTO](https://carto.com/basemaps/apikey/)). La clé arrive par e-mail.
2. Tableau de bord CARTO ([dashboard.basemaps.carto.com](https://dashboard.basemaps.carto.com/), connexion par lien e-mail) › la clé › **Restrictions** › **Restrict to specific websites (Referer)** : ajouter `bledeal.com`, `www.bledeal.com` et `test.bledeal.com`.
   - Écrire le nom seul : sans `https://`, ni chemin, ni port ([FAQ CARTO](https://docs.carto.com/faqs/carto-basemaps)).
   - `www.bledeal.com` et `bledeal.com` comptent pour deux.
3. Pour le PC : **une seconde clé** limitée à `localhost` et `127.0.0.1`. CARTO interdit de mélanger `localhost` et des sites publics sur une même clé. Elle va dans `.env.local` seulement.
4. Mettre la clé publique dans **`NEXT_PUBLIC_CARTO_CLE`** sur Vercel (étape 4), puis redéployer : la variable est lue à la construction du site.

**Vérifier**
- `https://bledeal.com/oran/carte` affiche un fond gris clair, avec la mention « © OpenStreetMap contributors, © CARTO ».
- Les épingles des boutiques sont visibles.
- Sans « API key required » sur la carte.

**Pièges**
- Une tuile vide ou une erreur 403 veut dire que le domaine n'est pas dans la liste de la clé.
- L'adresse de la preview doit être `test.bledeal.com` : les adresses `*.vercel.app` changent à chaque déploiement.
- Suivre la consommation dans le tableau de bord CARTO, chaque mois. Plan B en cas de dépassement : Stadia Maps Starter, 20 $/mois (`docs/ETAT.md`, point 17).

---

## Étape 7 — Meta WhatsApp Business (messages des commandes)

**Deux numéros WhatsApp dédiés** (conseil de ce guide) :
- **numéro A** : codes de connexion, enregistré **par Twilio** (étape 9) ;
- **numéro B** : messages des commandes, branché **directement** sur l'API WhatsApp Cloud de Meta (cette étape).

**Pourquoi deux** :
- Twilio demande un compte WhatsApp Business (WABA) **créé par Twilio** ([Twilio Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)).
- Un numéro n'est actif que chez un fournisseur à la fois ([Twilio, migration](https://www.twilio.com/docs/whatsapp/migrate-numbers-and-senders)).

**Chaque numéro** : **jamais utilisé dans l'application WhatsApp** (ou supprimé de WhatsApp avant), et capable de recevoir un SMS ou un appel.

### 7.1 Application Meta et compte WhatsApp
1. developers.facebook.com › **My Apps** › **Create App** › cas d'usage **« Connect with customers through WhatsApp »** › portefeuille « BleDeal » › **Create app** ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)).
2. **API Setup** :
   - relier ou créer le compte WhatsApp Business ;
   - **ajouter le numéro B**, **nom affiché « BleDeal »** ;
   - vérifier le numéro par le code reçu.
3. Si un nom affiché « OranPromo » existe déjà : demander « BleDeal ». Meta refait un examen.
4. Noter le **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
5. **Enregistrer le numéro pour l'API**. Cela ne se fait **que par une commande** ([doc Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/)) :
   - `POST https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>/register`, avec `{"messaging_product":"whatsapp","pin":"<6 chiffres choisis>"}` et le jeton de 7.2 ;
   - à lancer sur votre PC, avec le développeur si besoin, **sans lui envoyer le jeton par chat** ;
   - garder le PIN dans le gestionnaire.
6. **Moyen de paiement** du compte WhatsApp dans le **Billing Hub** de Meta Business Suite. Sans lui, les messages payants ne partent pas ([tarifs](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).

### 7.2 Jeton permanent (utilisateur système)
([doc Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens))
1. Meta Business Suite › **Paramètres de l'entreprise** › **Utilisateurs système** › **Ajouter** › nom « bledeal-serveur », rôle **Admin**.
2. **Assign assets** : l'application et le compte WhatsApp, en contrôle total.
3. **Generate token** › l'application › expiration **Never** › autorisations `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging` › copier → `WHATSAPP_TOKEN`.

**Piège** : le jeton « temporaire » de la page API Setup expire en quelques heures. Ne pas l'utiliser.

### 7.3 Les 7 modèles français
**Où** : **WhatsApp Manager** › **Modèles de messages** › **Créer un modèle** ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)), dans le compte du **numéro B**. Pour chaque modèle :
- catégorie **Utilitaire** (Utility), langue **français (`fr`)** ;
- **nom exact** : les noms gardent `oranpromo_`, c'est voulu, ne pas les changer ;
- **texte exact**, à copier-coller, variables `{{1}}`… comprises ;
- un exemple par variable.

| Nom (exact) | Texte (à copier tel quel) | Exemples |
|---|---|---|
| `oranpromo_nouvelle_commande` | Nouvelle commande n° {{1}} sur BleDeal : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace BleDeal, rubrique Commandes. | 12 · Amina · 2 · 7 000 DA |
| `oranpromo_nouvelle_commande_confirmer` | Nouvelle commande n° {{1}} sur BleDeal : {{2}}, {{3}} article(s), {{4}}. Touchez Confirmer, ou confirmez-la dans votre espace BleDeal, rubrique Commandes. | 12 · Amina · 2 · 7 000 DA |
| `oranpromo_commande_prete` | Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu'au {{4}}. | Amina · 12 · Boutique Nour · samedi 18 octobre à 17 h |
| `oranpromo_commande_prete_retrait` | Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu'au {{4}}. Montrez votre QR code de retrait en boutique (bouton ci-dessous) et payez sur place. | Amina · 12 · Boutique Nour · samedi 18 octobre à 17 h |
| `oranpromo_commande_expiree` | Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n'a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher. | Amina · 12 · Boutique Nour |
| `oranpromo_no_show` | Bonjour {{1}}, {{2}} nous signale que vous n'êtes pas venu(e) chercher votre commande n° {{3}}. C'est votre {{4}}e commande non récupérée : encore {{5}} et votre compte BleDeal sera bloqué. Merci de ne commander que ce que vous viendrez chercher. | Amina · Boutique Nour · 12 · 2 · 3 |
| `oranpromo_compte_bloque` | Bonjour {{1}}, votre compte BleDeal est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez BleDeal. | Amina |

**Boutons des deux modèles à bouton.** Section **Boutons** › **Visiter le site web** (Visit website), type **dynamique**, domaine **définitif** `bledeal.com` :

| Modèle | Libellé | Adresse | Exemple de fin d'adresse |
|---|---|---|---|
| `oranpromo_nouvelle_commande_confirmer` (US-20.6) | **`Confirmer`** | `https://bledeal.com/confirmer/{{1}}` | `exemple` |
| `oranpromo_commande_prete_retrait` (US-26) | **`Mon QR code`** | `https://bledeal.com/retrait/{{1}}` | `exemple` |

Ces deux modèles se créent **une fois `bledeal.com` acheté**. Leur activation est à l'étape 15.

**Modèles déjà créés avec « OranPromo »** :
- **ne pas les supprimer** : un nom supprimé est bloqué 30 jours ;
- **modifier leur texte** pour écrire « BleDeal ». Meta refait un examen, et limite à 1 modification par 24 h et 10 par 30 jours par modèle (`docs/ETAT.md`, liste BleDeal, point 4).

**Vérifier**
- Chaque modèle passe à **Actif** (Active), après un examen pouvant aller jusqu'à 24 h.
- Puis, **une fois l'empreinte `jeton_notifications` en place** (étape 3) : une commande de test sur la preview → la boutique de test reçoit « Nouvelle commande n° … », et `messages_whatsapp` montre `envoye`.

**Pièges**
- Un nom ou une variable différente d'une seule lettre = message refusé par Meta. On le voit dans la colonne `erreur` de `messages_whatsapp`, « Meta 400 … ».
- Ne pas laisser Meta reclasser un modèle en **Marketing** : refaire la demande en Utilitaire.
- Meta demande que les clients aient **accepté** de recevoir ces messages : à mentionner dans les conditions d'utilisation.
- Le message « commande prête » **ne contient pas** le code à 6 chiffres. C'est voulu (`docs/ETAT.md`, suivi de la relecture n°6) : le code reste dans « Mes commandes » et sur la page du proche.

### 7.4 Les 4 modèles arabes (US-23)
Les messages **au client** partent en arabe quand la commande a été passée en arabe **et** que l'interrupteur `modeles_arabes` est à `on` (étape 15.3). Sinon, ils partent en français. Le message à la boutique reste en français.

**Où** : même écran, catégorie **Utilitaire**, **langue Arabe (`ar`)**, mêmes variables que les modèles français.
- Les textes sont ceux validés par le propriétaire le 9/10 (`docs/ETAT.md`), avec « BleDeal » à la place de « OranPromo » (US-30). Le nom de marque reste écrit en lettres latines, comme sur le site.
- Quand le nom du client manque, `{{1}}` vaut « خويا ».

| Nom (exact) | Texte (à copier tel quel) | Exemples |
|---|---|---|
| `oranpromo_commande_prete_ar` | السلام {{1}}، الطلب رقم {{2}} راهو واجد عند {{3}}. تقدر تجي تدّيه حتى {{4}}. | Samir · 12 · Boutique Nour · 10/10 على 16:10 |
| `oranpromo_commande_expiree_ar` | السلام {{1}}، الطلب رقم {{2}} عند {{3}} ما تدّاش في 24 ساعة: تلغات والسلعة رجعت للبيع. من فضلك ما تطلب غير واش راك تجي تدّي. | Samir · 12 · Boutique Nour |
| `oranpromo_no_show_ar` | السلام {{1}}، {{2}} قالولنا بلي ما جيتش تدّي الطلب رقم {{3}}. عندك دروك {{4}} طلبات ما تدّاوش: كان زادو {{5}} يتبلوكا حسابك في BleDeal. من فضلك ما تطلب غير واش راك تجي تدّي. | Samir · Boutique Nour · 12 · 2 · 3 |
| `oranpromo_compte_bloque_ar` | السلام {{1}}، حسابك في BleDeal تبلوكا من بعد 5 طلبات ما تدّاوش. باش يتحلّ، اتصل بـ BleDeal. | Samir |

**Pièges**
- **Les 4** doivent être approuvés avant d'activer `modeles_arabes`.
- Il n'existe pas de modèle arabe **avec bouton** « Mon QR code ». Un client en arabe reçoit `oranpromo_commande_prete_ar` **sans bouton**, même avec `bouton_retrait` = `on` (`docs/architecture.md`). Son QR code reste dans « Mes commandes ».
- Faire relire les textes par quelqu'un qui parle darja avant l'envoi à Meta.

---

## Étape 8 — cron-job.org : envoi des messages en attente toutes les 5 minutes

**Pourquoi** :
- Les messages « nouvelle commande », « prête » et « client pas venu » partent juste après l'action.
- Les **expirations, blocages et nouvelles tentatives** partent par la tâche `GET /api/notifications/whatsapp`.
- En Hobby, Vercel ne lance cette tâche qu'**une fois par jour** ([doc](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Un service externe gratuit l'appelle toutes les 5 minutes. En Pro, le développeur peut passer `vercel.json` à `*/5 * * * *` ; cron-job.org reste alors un doublon sans danger.

**Quoi faire** (cron-job.org › **Create cronjob**) :
- **URL** : `https://bledeal.com/api/notifications/whatsapp` (adresse principale, sans redirection) ;
- **Planification** : toutes les 5 minutes ;
- **Advanced** › **Request method** `GET` ; **Headers** : clé `Authorization`, valeur `Bearer <CRON_SECRET>` (le mot `Bearer`, un espace, le secret) ([FAQ](https://cron-job.org/en/faq/)) ;
- **notifications d'échec** par e-mail activées ;
- **Test run**, puis **Save**.

**Vérifier** (réponse du Test run)

| Réponse | Signification |
|---|---|
| `200` avec `{"envoyes":…,"echecs":…,"reportes":…,"traites":…}` | tout va bien |
| `200` « WhatsApp non configuré : les messages restent en attente. » | manque `WHATSAPP_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID` |
| `401` « Accès refusé. » | l'en-tête ne correspond pas à `CRON_SECRET` |
| `503` « Tâche non configurée. » | `CRON_SECRET` absent sur Vercel, ou trop court |
| `500` | le plus souvent, **l'empreinte `jeton_notifications` manque** ou ne correspond pas : refaire l'étape 3 |

**Pièges**
- Ne jamais pointer vers `test.bledeal.com` : la preview est protégée, l'appel reçoit un 401 de Vercel.
- Une adresse qui redirige (`www.bledeal.com`) fait échouer l'appel.

---

## Étape 9 — Twilio : expéditeur WhatsApp des codes et service Verify

Décision du propriétaire : **code par WhatsApp uniquement, aucun SMS** (US-21.5).

### 9.1 Compte payant, prépayé, sans recharge automatique
1. twilio.com › créer le compte › Console › **Admin** › **Account billing** › **Upgrade account** ([doc](https://www.twilio.com/docs/whatsapp/self-sign-up)). Un compte d'essai n'envoie qu'aux numéros vérifiés à la main.
2. Petit crédit (par exemple 20 $), **recharge automatique désactivée** : **(chemin à confirmer : Console › Billing)** ([doc](https://www.twilio.com/docs/usage/billing)). Le solde devient le plafond.
3. **Alerte de consommation** : *Usage Triggers* ([doc](https://www.twilio.com/docs/usage/api/usage-trigger)) **(chemin à confirmer)**.

### 9.2 Expéditeur WhatsApp (numéro A)
([Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) ; [Bring your own sender](https://www.twilio.com/docs/verify/whatsapp/byo))
1. Console › **Messaging** › **Senders** › **WhatsApp Senders** › **Create new sender**.
2. Configurer l'expéditeur :
   - numéro A ;
   - **Continue with Facebook** › portefeuille « BleDeal » › **créer un nouveau compte WhatsApp Business** (pas celui du numéro B) ;
   - nom affiché « BleDeal » ;
   - vérifier le numéro › **Confirm**.
3. Console › **Messaging** › **Services** › **Messaging Service** « BleDeal codes » avec cet expéditeur. Noter son identifiant `MG…`.

### 9.3 Service Verify
1. Console › **Verify** › **Services** › **Create new** :
   - nom **« BleDeal »** : il peut apparaître dans le message du code. Renommer un ancien service « OranPromo » ;
   - code à **6 chiffres**, canal **WhatsApp** ;
   - **Fraud Guard** activé ([doc](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)) ;
   - noter le **Service SID** (`VA…`).
2. Onglet **WhatsApp** du service : choisir le Messaging Service `MG…` ([doc](https://www.twilio.com/docs/verify/whatsapp/byo)).
3. **Désactiver les canaux SMS et voix.** ⚠️ Si le SMS est actif, Twilio **bascule vers le SMS** en cas d'échec et le facture ([doc](https://www.twilio.com/docs/verify/fallback-scenarios)).
4. Console › **Verify** › **Settings** › **Geo permissions** : SMS et voix désactivés partout sauf l'Algérie, ou désactivés partout ([doc](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions)).
5. Noter l'**Account SID** (`AC…`) et l'**Auth Token**, pour l'étape 10.

**Vérifier** : l'expéditeur est « Online », et l'onglet WhatsApp du service montre le Messaging Service.

**Pièges**
- Tant que Meta n'a pas approuvé l'expéditeur, **aucun code ne part** : rester en mode e-mail.
- Twilio limite à 5 codes par numéro en 10 minutes (erreur 60203).
- L'erreur 63008 veut dire que le Messaging Service manque.

---

## Étape 10 — Supabase : connexion par téléphone et plafonds

1. Supabase › **Authentication** › **Sign In / Providers** › **Phone** ([doc](https://supabase.com/docs/guides/auth/phone-login/twilio)) :
   - activer, fournisseur **Twilio Verify** ;
   - coller **Account SID**, **Auth Token**, **Verify Service SID** ;
   - laisser « Enable phone signup » activé ;
   - **Save**.
2. **Authentication** › **Rate Limits** ([doc](https://supabase.com/docs/guides/auth/rate-limits)) :
   - « SMS messages sent » (WhatsApp compris, tout le projet) : **20 à 30 par heure** au lancement. C'est le plafond de dépense ;
   - « Send OTPs » : **60 secondes** ;
   - **30 demandes par 5 minutes** par IP.

**Vérifier** : Phone est « Enabled » avec Twilio Verify.

**Pièges**
- Les clés Twilio vont **uniquement ici**, jamais sur Vercel ni dans `.env.local`.
- Si de vrais clients sont bloqués par le plafond, le remonter **petit à petit**.

---

## Étape 11 — Cloudflare Turnstile (anti-robot)

1. dash.cloudflare.com › **Turnstile** › **Add widget** ([doc](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)) :
   - nom « BleDeal » ;
   - domaines `bledeal.com`, `test.bledeal.com`, `127.0.0.1`, `localhost` ;
   - mode **Managed** › **Create**.
   - Un widget existant : ajouter `bledeal.com` et `test.bledeal.com` à sa liste.
2. **Clé de site** (publique) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` sur Vercel (Production **et** Preview) et dans `.env.local`. Redéployer les deux.
3. Garder la **clé secrète** pour l'étape 12.

**Vérifier** : `/espace/connexion` et `/compte/connexion` affichent le contrôle Cloudflare, sur la production, la preview et le PC.

## Étape 12 — Supabase : protection captcha (SEULEMENT après l'étape 11)

⚠️ Dès que cette protection est active, **toutes** les connexions (e-mail comprises) exigent Turnstile. Un site qui n'a pas encore la clé de site déployée bloque tout le monde.

1. Supabase › **Authentication** › **Attack Protection** › **Enable Captcha protection** ([doc](https://supabase.com/docs/guides/auth/auth-captcha)) :
   - fournisseur **Turnstile by Cloudflare** ;
   - **clé secrète** ;
   - **Save**.

**Vérifier** : la connexion par lien e-mail réussit sur la production, la preview et le PC.

**Retour arrière** : décocher la même case.

---

## Étape 13 — Essai du mode téléphone (sur la preview)

Seulement quand l'expéditeur WhatsApp de l'étape 9 est approuvé par Meta.
1. Vercel : mettre `CONNEXION_CLIENT` = `telephone` **en Preview seulement**, puis redéployer `test`. Ne **pas** créer le réglage `connexion_client` à ce stade.
2. `https://test.bledeal.com/compte/connexion` › mobile algérien › contrôle › « Recevoir le code sur WhatsApp » › code → connecté.
3. Avec un compte créé par e-mail : `/compte` › vérifier le numéro par code.
4. Twilio › **Monitor** › **Logs** (Verify) : canal **whatsapp**, aucun SMS.

## Étape 14 — Mise en service du mode téléphone

Seulement après l'approbation de Meta **et** un essai réussi.
1. Vercel : mettre `CONNEXION_CLIENT` = `telephone` en **Production**, puis redéployer.
2. **Puis** Supabase › SQL Editor :
```sql
insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;
```
À partir de là, la base refuse toute commande sans numéro vérifié (production **et** preview).

**Vérifier** : un compte sans numéro vérifié voit « Vérifiez votre numéro pour commander » dans `/panier`.

**Retour au mode e-mail** :
1. `delete from prive.reglages where cle = 'connexion_client';`
2. `CONNEXION_CLIENT=email` sur Vercel, puis redéployer.

**Piège** : dans l'ordre inverse (réglage avant variable), les clients ne peuvent plus commander.

---

## Étape 15 — Les trois interrupteurs WhatsApp (après approbation Meta)

Un interrupteur activé **avant** l'approbation de son modèle = messages refusés par Meta (modèle inconnu). Activer **un seul à la fois** et tester.

### 15.1 Bouton « Confirmer » (US-20.6) — `bouton_confirmer`
**Prérequis** :
- `CONFIRMATION_SECRET` et `jeton_confirmation` (étape 3) ;
- `oranpromo_nouvelle_commande_confirmer` **approuvé** (étape 7.3).
```sql
insert into prive.reglages (cle, valeur) values ('bouton_confirmer', 'on') on conflict (cle) do update set valeur = excluded.valeur;
```
**Vérifier**
- Une commande de test → le message de la boutique a le bouton « Confirmer ».
- Ce bouton ouvre `https://bledeal.com/confirmer/…` ; la page montre la commande **sans** le téléphone du client.
- « Confirmer la commande » → « Commande confirmée : le stock est mis à jour. Pensez à la préparer. »

**Retour arrière** : `delete from prive.reglages where cle = 'bouton_confirmer';`. L'ancien message sans bouton repart.

**À savoir** : le lien vaut 24 h, pour une seule commande. Sans `CONFIRMATION_SECRET`, l'ancien message part.

### 15.2 Bouton « Mon QR code » (US-26) — `bouton_retrait`
**Prérequis** :
- `jeton_notifications` en place (étape 3) : le jeton du bouton est demandé à la base avec `CRON_SECRET` ;
- `NEXT_PUBLIC_SITE_URL` = `https://bledeal.com` : le QR code et le lien du proche en dépendent ;
- `oranpromo_commande_prete_retrait` **approuvé** (étape 7.3).
```sql
insert into prive.reglages (cle, valeur) values ('bouton_retrait', 'on') on conflict (cle) do update set valeur = excluded.valeur;
```
**Vérifier** : une commande de test passe « Prête » → le client reçoit le message avec le bouton « Mon QR code ». Ce bouton ouvre `https://bledeal.com/retrait/…`, avec le QR code et le code à 6 chiffres.

**Retour arrière** : `delete from prive.reglages where cle = 'bouton_retrait';`

**À savoir**
- Commande plus « prête », date passée ou jeton indisponible : l'ancien modèle part, sans bouton.
- Client en arabe avec `modeles_arabes` = `on` : modèle arabe **sans** bouton.
- Le scanner (`/espace/scanner`) marche **sans** cet interrupteur. Le client trouve aussi son QR code dans « Mes commandes ».

### 15.3 Messages en arabe (US-23) — `modeles_arabes`
**Prérequis** : **les 4** modèles `_ar` approuvés (étape 7.4).
```sql
insert into prive.reglages (cle, valeur) values ('modeles_arabes', 'on') on conflict (cle) do update set valeur = excluded.valeur;
```
**Vérifier** : passer une commande avec le site en arabe (bouton « عربي » de l'en-tête), puis la mettre « Prête ». Le client reçoit `oranpromo_commande_prete_ar`. Une commande passée en français reçoit toujours le français.

**Retour au français pour tout le monde** : `delete from prive.reglages where cle = 'modeles_arabes';`

---

## Étape 16 — Parrainage (US-27) : accord, budget, interrupteur

**Comment ça marche** :
- Un bon **BleDeal de 300 DA** pour le parrain et le filleul. Il est déduit **en caisse** par la boutique, puis **remboursé chaque mois par BleDeal** à la boutique.
- Le bon s'utilise sur une commande d'au moins 1 000 DA.
- Il n'est valable que si la commande est **remise par QR code**. Par code à 6 chiffres ou par « Remis sans QR code », ni bon ni parrainage (relecture n°6).
- Le parrainage ne marche qu'avec la **connexion par code** (étape 14).

### 16.1 Vérifier l'état actuel (à faire tout de suite)
```sql
select cle, valeur from prive.reglages where cle in ('parrainage', 'parrainage_budget_mois');
```
- Si `parrainage` vaut `on` alors que **les accords ne sont pas signés**, ou que la connexion par code n'est pas en service, **fermer** :
  - `delete from prive.reglages where cle = 'parrainage';`
  - les bons déjà émis restent valables ;
  - pour ne plus en émettre du tout, mettre le budget à 0 (16.3).
- **Vérifier** : `/parrainage` affiche « Le parrainage n’est pas encore ouvert. Reviens bientôt ! » quand il est fermé.

### 16.2 Accord écrit avec chaque boutique (avant d'ouvrir)
Faire signer **à chaque boutique** un court accord qui dit :
- la boutique accepte en caisse les **bons BleDeal de 300 DA**, **sur une commande remise par QR code** (pas par code à 6 chiffres) ;
- BleDeal lui rembourse chaque mois les bons utilisés : relevé clôturé le **1er**, paiement **avant le 10** du mois suivant, par CCP, BaridiMob ou virement ;
- BleDeal peut **mettre de côté ou refuser** une ligne suspecte ;
- chacune des deux parties peut **arrêter** les bons à tout moment.

Garder les coordonnées de paiement des boutiques **hors du site** : le site ne les demande jamais.

Une boutique qui ne signe pas : `/admin/parrainages` › « Retirer la boutique des bons ». Ses clients voient alors « Bon non appliqué : cette boutique n’accepte pas les bons pour le moment… ».

### 16.3 Budget mensuel
`/admin/parrainages`, champ **« Budget mensuel (DA) »** › **Enregistrer** (30 000 DA au départ).
- Les **bons émis** comptent, pas seulement ceux utilisés.
- Au-delà du budget, les bons attendent le 1er du mois suivant.
- **0** = plus aucun nouveau bon.

### 16.4 Ouvrir le parrainage
**Seulement** quand les conditions sont réunies :
- connexion par code en service (étape 14) ;
- accords signés ;
- budget vérifié.
```sql
insert into prive.reglages (cle, valeur) values ('parrainage', 'on') on conflict (cle) do update set valeur = excluded.valeur;
```
**Vérifier** :
- `/parrainage` affiche « Parraine tes amis » et, pour un client vérifié, son lien `/p/<code>` ;
- l'accueil montre « Parraine tes amis · 300 DA chacun ».

**Fermer** : `delete from prive.reglages where cle = 'parrainage';`

### 16.5 Chaque mois, avant le 10 : rembourser les boutiques
1. `/admin/remboursements` › choisir le mois. Une ligne par boutique, par exemple « 4 bons · 1 200 DA ».
2. Regarder les **signaux** (jamais bloquants). En cas de doute, « Mettre de côté » une ligne avec un motif, puis « Rembourser » ou « Refuser ».
3. **Exporter le CSV** du mois. Il ne contient aucun numéro de téléphone.
4. Payer chaque boutique (CCP, BaridiMob, virement), **hors du site**.
5. « **Marquer comme payé** » avec la référence du paiement. Le relevé n'est plus modifiable ensuite.

**Piège** : la boutique voit ses bons dans `/espace`, bloc « Bons parrainage à rembourser ». Payez **avant le 10**, comme le dit l'accord.

---

## Étape 17 — Boutiques : position sur la carte et ville (US-24, US-29)

### 17.1 Position sur la carte
- **Création d'une boutique** (`/admin/boutiques`, admin ou ambassadeur) : bloc « Position sur la carte ». Trois façons de la régler :
  - « Je suis dans la boutique : utiliser ma position » ;
  - « Coller un lien Google Maps » (lien long ; les liens courts `maps.app.goo.gl` sont refusés) ;
  - « Saisir les coordonnées à la main ».
- **Boutique déjà publiée** : bouton « Position » sur sa ligne (admin seulement).
- **Commerçant** : dans `/espace`, tant que sa boutique est **en attente**. Ensuite, seul BleDeal peut la changer.
- **La base refuse une position hors de la wilaya** de la boutique (Oran : 35,33 à 35,92 N, −1,15 à −0,10 E).
- **Vérifier** : la boutique a son épingle sur `/oran/carte`. Les boutiques sans position apparaissent sous « Sans position sur la carte ».

### 17.2 Villes
- **Les 9 villes de la feuille de route existent**. **Seule Oran est ouverte** :
  - Ouest : Oran, Mostaganem, Relizane, Tlemcen ;
  - Centre : Alger, Tizi Ouzou, Béjaïa ;
  - Est : Annaba, Constantine.
- **Adresses** : les pages qui dépendent de la ville portent son nom (`/oran`, `/oran/catalogue`, `/oran/carte`). `/b/<slug>` et `/a/<id>` restent sans ville.
- **Nouvelle boutique** : le formulaire demande « Ville (wilaya) ». Oran est présélectionnée tant qu'elle est seule ouverte.
- **Changer la ville d'une boutique** : `/admin/boutiques` › « Changer de ville » (admin).
- **Ambassadeurs** : `/admin/villes` › « Ville des ambassadeurs ». Un ambassadeur avec une ville ne crée des boutiques que dans cette ville. Vide = toutes les villes.
- **Ne pas ouvrir une ville vide** : voir 20.3.

---

## Étape 18 — Renommages du projet

1. **GitHub** : `benattiahakim-maker/oranpromo` › **Settings** › **General** › **Repository name** › `bledeal` › **Rename**.
   - GitHub redirige l'ancienne adresse, et Vercel suit.
   - Ensuite, demander au développeur de mettre la nouvelle adresse dans `installer-bledeal.bat` et de lancer `git remote set-url origin https://github.com/benattiahakim-maker/bledeal` sur le PC.
2. **Facultatif** :
   - renommer le projet Vercel (l'adresse `*.vercel.app` change ; `bledeal.com` non) ;
   - renommer le nom **affiché** du projet Supabase (l'adresse `iloyliuzsflzbkhpvxjt.supabase.co` ne change pas) ;
   - renommer l'espace de travail de la console Claude ;
   - renommer le portefeuille et l'application Meta « BleDeal ».

---

## Étape 19 — Jour J

### 19.1 Retirer les données de démonstration
Script `supabase/scripts/retirer_donnees_demo.sql` (`docs/ETAT.md`, « Retrait des données de démonstration »). Il **n'a pas encore été lancé**. **Par défaut, il ne supprime rien (essai à blanc).**

**Ce qu'il supprime**
- Le compte de test `hakim3142@gmail.com` et sa « Boutique Nour » (`boutique-nour`).
- La **« Parfumerie Démo »** (`parfumerie-demo`, US-25) et ses 5 parfums.
- Les **10 articles de démonstration** (`a0000000-…-001` à `…-010`, dont 3 de Maison Ilyes), avec leurs photos `placehold.co`, tailles et contenances, promos et statistiques.
- Les commandes et messages WhatsApp de ces boutiques.
- Côté parrainage : les relevés de bons et les lignes des commandes de démo, les bons et les codes de retrait (`prive.retraits`) liés.

**Ce qu'il garde**
- Le compte admin et « Maison Ilyes » (vide d'articles ensuite).
- Les réglages.
- Les vraies commandes. Un bon d'un vrai client réservé sur une commande de démo lui est **rendu**.

**Quoi faire**
1. Supabase › SQL Editor › coller **tout** le fichier tel quel › **Run**. Le tableau final indique ce qui **serait** supprimé, table par table (dont `parrainages`, `bons`, `releves_bons`, `lignes_releve`, `prive.retraits`). Vérifier que ce n'est que de la démo.
2. Pour supprimer vraiment : dans le texte collé, remplacer `appliquer constant boolean := false` par `appliquer constant boolean := true` (ligne marquée ⚠), puis relancer. Tout se fait en une fois : en cas d'erreur, **rien** n'est supprimé.
3. Relancer une deuxième fois avec `true` : **0** partout.
4. Fermer l'onglet sans enregistrer la version `true`.

**Arrêts possibles** (rien n'est supprimé dans ces cas) :
- des photos de démo sont dans le stockage : les supprimer d'abord dans **Storage** › `photos`, puis relancer ;
- un **relevé de bons déjà payé** concerne une boutique de démo : à régler avec le développeur ;
- un compte admin aurait été supprimé.

**Vérifier** : `/oran`, `/oran/catalogue?univers=beaute` et `/oran/carte` n'affichent plus Boutique Nour, Parfumerie Démo ni leurs articles. `/b/parfumerie-demo` répond « Boutique indisponible ».

### 19.2 Maison Ilyes
Son WhatsApp est le **numéro français du propriétaire**. Le changer ou le retirer avant l'ouverture (`/admin/boutiques`), ou suspendre la boutique.

### 19.3 Affiches
Aucune n'est imprimée.
- Les imprimer **après** `NEXT_PUBLIC_SITE_URL=https://bledeal.com` + redéploiement : le QR code mène à `https://bledeal.com/b/<slug>`.
- `/espace/affiche` affiche « BleDeal · Oran ».
- Scanner une affiche imprimée avant d'en imprimer d'autres.

### 19.4 Contrôles finaux
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://bledeal.com` (le lien de « Partager ma boutique » commence par `https://bledeal.com/b/`).
- [ ] Les **4** empreintes `jeton_…` présentes (étape 3), **`jeton_notifications` compris**.
- [ ] cron-job.org : derniers appels en `200` ; `messages_whatsapp` : rien en `a_envoyer` depuis plus de 10 minutes, aucun `echec` inexpliqué.
- [ ] Statistiques et « Signaler » fonctionnent.
- [ ] Carte : fond CARTO, pas OpenStreetMap.
- [ ] Interrupteurs : chacun à `on` **seulement** si son modèle est approuvé (requête de l'en-tête).
- [ ] Parrainage : fermé, ou ouvert avec accords signés et budget (étape 16).
- [ ] Plafonds en place : Supabase Spend Cap, Rate Limits (20 à 30 codes/h), Twilio sans recharge automatique + alerte, Anthropic, consommation CARTO.
- [ ] Logo « BleDeal » en français et en arabe.
- [ ] Lien d'une boutique collé dans WhatsApp : aperçu « BleDeal ».
- [ ] Message « vu sur BleDeal » au moment de réserver.
- [ ] `docs/tests-manuels.md` coché sur la preview.

---

## Étape 20 — Après l'ouverture

### 20.1 Chaque mois
Avant le 10 : remboursement des bons (16.5). Consommation CARTO.

### 20.2 Chaque semaine
- **Twilio** : solde, logs Verify.
- **Meta** : qualité des modèles, statut du numéro.
- **Supabase** : Usage, `messages_whatsapp`.
- **Anthropic** : Usage.
- **Resend** : e-mails rejetés.
- **cron-job.org** : échecs.
- **`/admin/parrainages`** : signaux.

### 20.3 Ouvrir la ville suivante
Feuille de route : Mostaganem, puis Ouest → Centre → Est.
1. Préparer quelques boutiques **validées** dans cette ville (avec leur position), un ambassadeur et des affiches.
2. `/admin/villes` › ligne de la ville « Fermée » › « Ouvrir » › confirmer.
3. Le bouton « Oran ▾ » apparaît dans l'en-tête (2 villes ouvertes), et `/villes` propose les deux villes.

**Fermer une ville** : même bouton. Rien n'est supprimé.

---

## Ce qui n'a pas pu être vérifié

- **Twilio** : chemins exacts pour désactiver la recharge automatique et créer une alerte e-mail (les pages d'aide demandent un navigateur) ; libellé exact de la désactivation du SMS dans un service Verify.
- **Un seul numéro pour les deux usages** (codes par Twilio, messages par Meta) : non retenu faute de confirmation, d'où deux numéros.
- **Supabase** : libellés exacts des lignes de **Rate Limits** et du menu **Emails › Templates**.
- **Cloudflare** : place du menu Turnstile dans la barre latérale.
- **Console Claude** : adresse exacte et existence d'une recharge automatique.
- **Meta** :
  - nom exact du type de bouton (« Visiter le site web ») et libellé de la langue arabe dans WhatsApp Manager ;
  - limites de modification d'un modèle approuvé : reprises de `docs/architecture.md`.
- **Facebook** : « @bledeal déjà pris » vient du propriétaire (pas de `docs/ETAT.md`) ; chemin exact de création d'une Page ; effet d'un nom de Page différent sur l'examen du nom affiché WhatsApp.
- **CARTO** : libellés du tableau de bord tirés de la page publique ; l'écran connecté n'a pas été ouvert.
- **Parrainage « activé en production »** : information du développeur, non vérifiée dans la base (aucune lecture de la base pour ce guide). `docs/ETAT.md` le dit fermé. D'où la vérification de l'étape 16.1.

## Sources (consultées les 9 et 10 octobre 2026)

- **Projet** : `docs/ETAT.md` (journal 1 à 28, « BleDeal : à faire par le propriétaire (US-30.3) », « US-21 : à configurer par le propriétaire », « Retrait des données de démonstration ») ; `docs/architecture.md` ; `docs/user-stories.md` ; `.env.example` ; `supabase/scripts/retirer_donnees_demo.sql`.
- **Vercel** : [variables](https://vercel.com/docs/environment-variables/managing-environment-variables) · [domaines](https://vercel.com/docs/domains/working-with-domains/add-a-domain) · [domaine d'une branche](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch) · [environnements](https://vercel.com/docs/deployments/environments) · [tâches planifiées](https://vercel.com/docs/cron-jobs) · [limites des tâches](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [protection](https://vercel.com/docs/deployment-protection) · [plan Hobby](https://vercel.com/docs/plans/hobby)
- **Supabase** : [redirections](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [limites](https://supabase.com/docs/guides/auth/rate-limits) · [téléphone](https://supabase.com/docs/guides/auth/phone-login/twilio) · [captcha](https://supabase.com/docs/guides/auth/auth-captcha) · [production](https://supabase.com/docs/guides/deployment/going-into-prod) · [plafond](https://supabase.com/docs/guides/platform/cost-control)
- **Resend** : [Supabase par SMTP](https://resend.com/docs/send-with-supabase-smtp)
- **Twilio** : [Verify WhatsApp](https://www.twilio.com/docs/verify/whatsapp) · [expéditeur personnel](https://www.twilio.com/docs/verify/whatsapp/byo) · [bascule de canal](https://www.twilio.com/docs/verify/fallback-scenarios) · [Geo permissions](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions) · [Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard) · [Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) · [migration](https://www.twilio.com/docs/whatsapp/migrate-numbers-and-senders) · [WhatsApp](https://www.twilio.com/docs/whatsapp/api) · [facturation](https://www.twilio.com/docs/usage/billing) · [Usage Triggers](https://www.twilio.com/docs/usage/api/usage-trigger)
- **Meta** : [démarrer](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) · [jetons](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens) · [modèles](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) · [enregistrement du numéro](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/) · [tarifs](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- **CARTO** : [clé Basemaps](https://carto.com/basemaps/apikey/) · [tableau de bord](https://dashboard.basemaps.carto.com/) · [FAQ (restrictions par site)](https://docs.carto.com/faqs/carto-basemaps)
- **Anthropic** : [plafonds](https://docs.claude.com/en/api/rate-limits)
- **Cloudflare** : [widget Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)
- **cron-job.org** : [FAQ](https://cron-job.org/en/faq/)

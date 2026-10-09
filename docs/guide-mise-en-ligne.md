# Guide de mise en ligne d'OranPromo (pour le propriétaire)

> Pour qui : le propriétaire, sans connaissances en développement.
> Rédigé le 9 octobre 2026, d'après `docs/ETAT.md` et `docs/architecture.md` (branche `main`) et la documentation officielle de chaque service, consultée le même jour (liens en fin de guide).
> Ce guide ne remplace pas `docs/ETAT.md` : en cas de différence, c'est `docs/ETAT.md` qui fait foi, et il faut prévenir le développeur.
> Pas de captures d'écran (les écrans des services changent souvent). Les chemins de menus viennent de la documentation officielle ; quand un chemin n'a pas pu être vérifié, c'est écrit **(chemin à confirmer)**.

## Avant de commencer : 6 règles

1. **Aucune clé ni aucun secret** dans un e-mail, un chat (ChatGPT, Claude, Grok compris), une capture, un commit ou un fichier du dépôt. Les secrets vont **uniquement** dans les tableaux de bord (Vercel, Supabase, cron-job.org) et dans `.env.local` sur votre PC. Dans ce guide, `<CRON_SECRET>`, `<votre-domaine>`, etc. sont des **emplacements** à remplacer : n'écrivez jamais la vraie valeur dans ce fichier.
2. **Gardez vos secrets dans un gestionnaire de mots de passe** (Bitwarden, 1Password, le trousseau du téléphone…). Vous en aurez besoin plusieurs fois.
3. **Fabriquer un secret** : utilisez le générateur du gestionnaire de mots de passe, **40 caractères, lettres et chiffres seulement** (pas d'espace, pas d'apostrophe `'`, pas de guillemet : une apostrophe casse la commande SQL de l'empreinte). Un secret différent pour chaque variable.
4. **Respectez l'ordre des étapes.** Certaines, faites trop tôt, bloquent toutes les connexions (étape 11 notamment).
5. **Après chaque changement de variable sur Vercel, il faut redéployer** : Vercel n'applique une variable qu'aux nouveaux déploiements ([doc Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)).
6. **Une seule base pour tout** : aujourd'hui, la préversion (preview) et la production utilisent **le même projet Supabase**. Conséquences :
   - les secrets `CRON_SECRET`, `VISITEURS_SECRET`, `CODES_TELEPHONE_SECRET`, `CONFIRMATION_SECRET` doivent avoir **la même valeur en Production et en Preview** (la base ne garde qu'une empreinte par secret) ;
   - les commandes de test passées sur la preview sont de **vraies lignes** dans la base, et leurs messages WhatsApp partent vraiment ;
   - les réglages de la base (`connexion_client`, `bouton_confirmer`) valent pour les deux.
   Un second projet Supabase pour les essais est prévu plus tard (Backlog « environnements prod et dev »).

## Vue d'ensemble : l'ordre conseillé

| # | Étape | Durée | Peut bloquer |
|---|---|---|---|
| 0 | **Lancer tout de suite** la vérification de l'entreprise chez Meta | 1 h + **1 à 2 semaines** d'attente | WhatsApp |
| 1 | Domaine + Vercel (production et preview) | 1 h | — |
| 2 | Supabase : plan Pro, adresses (URL), e-mails par Resend | 1 h | e-mails de connexion |
| 3 | Les 5 secrets et leurs empreintes dans la base | 30 min | statistiques, signalements, WhatsApp, codes |
| 4 | Toutes les variables sur Vercel, redéploiement | 30 min | — |
| 5 | Anthropic (IA) : clé + plafond de dépenses | 15 min | — |
| 6 | Meta WhatsApp Business : numéro des messages de commande, jeton, 6 modèles | 2 h + attente Meta | messages de commande |
| 7 | cron-job.org : envoi des messages toutes les 5 minutes | 15 min | rappels WhatsApp |
| 8 | Twilio : compte prépayé, expéditeur WhatsApp des codes, service Verify | 1 h + attente Meta | codes de connexion |
| 9 | Supabase : connexion par téléphone (Twilio Verify) et plafonds | 15 min | — |
| 10 | Cloudflare Turnstile + clé de site sur Vercel | 20 min | — |
| 11 | Supabase : protection captcha (**seulement après l'étape 10**) | 5 min | **toutes les connexions** |
| 12 | Essai du mode téléphone sur la preview | 30 min | — |
| 13 | Mise en service du mode téléphone | 10 min | commandes |
| 14 | Bouton « Confirmer » dans WhatsApp (après approbation Meta) | 10 min | — |
| 15 | Jour J : données de démonstration, contrôles finaux | 1 h | — |

Les étapes 6 et 8 dépendent de Meta : commencez-les tôt, et continuez le reste pendant l'attente.

---

## Étape 0 — Vérification de l'entreprise chez Meta (à lancer en premier)

**Pourquoi** : sans entreprise vérifiée, Meta limite les envois WhatsApp et le nombre de numéros (2 au plus par portefeuille non vérifié) ; la vérification prend souvent 1 à 2 semaines, parfois plus ([Twilio, Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) ; [Twilio, Bring your own sender](https://www.twilio.com/docs/verify/whatsapp/byo) ; [Twilio, limites de numéros](https://www.twilio.com/docs/whatsapp/api)).

**Quoi faire**
1. Ouvrir **Meta Business Suite** (business.facebook.com) avec votre compte Facebook. Créer un **portefeuille d'entreprise** (Business Portfolio) « OranPromo » s'il n'existe pas.
2. Dans le portefeuille : **Paramètres** (roue dentée) > **Centre de sécurité** (Security Center) > **Vérification de l'entreprise** > **Commencer**, puis fournir les documents demandés (registre de commerce, justificatif d'adresse, site web, e-mail sur le domaine).

**Vérifier** : le Centre de sécurité affiche « Vérifiée ».

**Pièges**
- Le nom légal et l'adresse doivent être **exactement** ceux des documents.
- Avoir le **domaine définitif** et une adresse e-mail sur ce domaine accélère la vérification : faites l'étape 1 en parallèle.
- « Meta Verified » (abonnement payant) n'est **pas** la vérification d'entreprise : ne pas l'acheter.

---

## Étape 1 — Domaine et Vercel (production + preview)

**Pourquoi** : le site doit avoir une adresse définitive ; elle est utilisée par les liens de connexion, les liens et QR codes des boutiques, l'aperçu des liens partagés et le bouton « Confirmer » de WhatsApp.

### 1.1 Choisir le plan Vercel
Le plan gratuit **Hobby est réservé à un usage personnel, non commercial** ([Vercel, plan Hobby](https://vercel.com/docs/plans/hobby)). OranPromo étant commercial, passer en **Pro** avant le lancement : tableau de bord Vercel > **Settings** > **Billing** > **Upgrade**.
Les étapes ci-dessous fonctionnent aussi en Hobby pour les essais.

### 1.2 Créer le projet
1. vercel.com > **Add New…** > **Project** > importer le dépôt GitHub `benattiahakim-maker/oranpromo` (Vercel reconnaît Next.js tout seul).
2. Avant de cliquer sur **Deploy**, ouvrir **Environment Variables** et ajouter au moins `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > **Project Settings** > **API**). Les autres variables viennent à l'étape 4.
3. Branche de production : `main` (réglage par défaut).

### 1.3 Brancher le domaine de production
1. Projet Vercel > **Settings** > **Domains** > **Add Domain** > taper `<votre-domaine>` ([doc](https://vercel.com/docs/domains/working-with-domains/add-a-domain)).
2. Vercel propose d'ajouter aussi `www.<votre-domaine>` : accepter, et **choisir une seule adresse principale** ; l'autre redirige vers elle.
3. Chez le vendeur du domaine : créer l'enregistrement **A** (domaine nu) ou **CNAME** (sous-domaine) affiché par Vercel.

### 1.4 Créer l'adresse fixe de la preview
Les liens de connexion ne marchent que sur l'adresse écrite dans `NEXT_PUBLIC_SITE_URL` (règle de sécurité du code, `lib/origine.ts`). Une preview a donc besoin d'**une adresse fixe** :
1. Demander au développeur de créer une branche Git `test` (il la tiendra à jour avec ce qu'il faut tester).
2. Vercel > **Settings** > **Domains** > **Add Domain** > `test.<votre-domaine>` > **Edit** > **Connect to an environment** : **Preview**, **Git Branch** : `test` ([doc](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch) ; [environnements](https://vercel.com/docs/deployments/environments)).

**Vérifier** : `https://<votre-domaine>` et `https://test.<votre-domaine>` affichent l'accueil (cadenas présent). Settings > Domains indique « Valid Configuration ».

**Pièges**
- `NEXT_PUBLIC_SITE_URL` doit être **exactement** l'adresse principale (`https://`, avec ou sans `www` comme choisi, sans `/` final). Sinon : connexion par e-mail cassée, liens de boutique faux.
- La preview est protégée par défaut (**Deployment Protection** > Standard Protection) : il faut être connecté à Vercel pour l'ouvrir, y compris sur le téléphone qui ouvre le lien de connexion ([doc](https://vercel.com/docs/deployment-protection)). C'est voulu ; ne pas la retirer. L'aperçu des liens dans WhatsApp ne se teste donc que sur la production.
- La tâche planifiée de Vercel (`vercel.json`, une fois par jour) ne s'exécute **que sur la production** ([doc](https://vercel.com/docs/cron-jobs)).

---

## Étape 2 — Supabase : plan, adresses, e-mails

### 2.1 Plan Pro
- Pourquoi : un projet gratuit se met **en pause après 7 jours sans activité** et n'a pas de sauvegarde téléchargeable ([check-list production Supabase](https://supabase.com/docs/guides/deployment/going-into-prod)).
- Où : supabase.com > votre **organisation** > **Billing** > changer de plan pour **Pro**. Laisser le **Spend Cap** (plafond de dépenses) **activé** ([doc](https://supabase.com/docs/guides/platform/cost-control)).
- Vérifier : la page Billing indique « Pro Plan » et « Spend Cap : enabled ».

### 2.2 Adresses autorisées (URL Configuration)
- Où : projet `oranpromo` > **Authentication** > **URL Configuration** ([doc](https://supabase.com/docs/guides/auth/redirect-urls)).
- **Site URL** : `https://<votre-domaine>`.
- **Redirect URLs** : garder `http://127.0.0.1:3000/**` et `http://localhost:3000/**` (essais sur le PC), ajouter `https://<votre-domaine>/**` et `https://test.<votre-domaine>/**`.
- Vérifier : se connecter par lien e-mail sur la production (`/espace/connexion`) ; le lien reçu ramène sur le site, connecté.
- Piège : une adresse manquante ici = le lien de l'e-mail renvoie vers la Site URL au lieu de la bonne page.

### 2.3 E-mails de connexion par Resend
- Pourquoi : l'envoi intégré de Supabase n'envoie qu'**aux membres de l'équipe Supabase** et **2 e-mails par heure** : inutilisable pour de vrais clients ([doc SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
- Resend (resend.com) :
  1. **Domains** > **Add Domain** > `<votre-domaine>` (ou `mail.<votre-domaine>`), puis créer chez le vendeur du domaine les enregistrements DNS affichés (SPF, DKIM) et attendre « Verified ».
  2. Désactiver le **suivi des clics** (click tracking) du domaine : il réécrit les liens et peut casser les liens de connexion ([Supabase](https://supabase.com/docs/guides/deployment/going-into-prod)).
  3. **API Keys** > **Create API Key** (droit « Sending access », limité à ce domaine).
- Supabase : **Authentication** > **Emails** > **SMTP Settings** > activer **Custom SMTP** ([Resend](https://resend.com/docs/send-with-supabase-smtp)) :
  - Sender email : `no-reply@<votre-domaine>` ; Sender name : `OranPromo` ;
  - Host `smtp.resend.com`, Port `465`, Username `resend`, Password : la clé API Resend.
- Puis **Authentication** > **Rate Limits** : avec un SMTP personnel, la limite d'e-mails est d'abord de **30 par heure** ; la monter (par exemple 100 par heure) ([doc](https://supabase.com/docs/guides/auth/rate-limits)).
- Vérifier : demander un lien de connexion avec une adresse **qui n'est pas** membre de l'équipe Supabase (par exemple une adresse Gmail personnelle) ; l'e-mail arrive, expéditeur `no-reply@<votre-domaine>`.
- Pièges : domaine non vérifié chez Resend = aucun e-mail ; ne pas utiliser ce domaine d'envoi pour du marketing.

---

## Étape 3 — Les 5 secrets et leurs empreintes dans la base

La base ne garde jamais un secret, seulement son **empreinte** (SHA-256) dans `prive.reglages`. Le site envoie le secret, la base calcule l'empreinte et compare.

| Variable (Vercel) | Clé de l'empreinte (`prive.reglages`) | Sans elle |
|---|---|---|
| **`VISITEURS_SECRET`** ⚠️ urgent | `jeton_visiteurs` | **plus aucune vue, aucun clic, aucun partage enregistré** (statistiques des boutiques vides) et « Signaler cet article » répond « Le signalement n’est pas disponible pour le moment. Réessayez plus tard. » |
| `CRON_SECRET` | `jeton_notifications` | aucun message WhatsApp ne part (ni juste après une action, ni par la tâche planifiée) |
| `CODES_TELEPHONE_SECRET` | `jeton_codes_telephone` | aucun code de connexion par WhatsApp (« La connexion par téléphone n’est pas encore configurée. ») |
| `CONFIRMATION_SECRET` | `jeton_confirmation` | messages « nouvelle commande » sans bouton « Confirmer » ; la page du lien dit « pas disponible » |

(`VISITEURS_SECRET` est **déjà nécessaire aujourd'hui** : depuis la mise à jour du 9/10, les statistiques ne sont plus enregistrées tant qu'il manque. À faire en priorité, dès l'étape 4.)

**Quoi faire**
1. Fabriquer 4 secrets (règle 3 : 40 caractères, lettres et chiffres) et les ranger dans le gestionnaire de mots de passe.
2. Supabase > **SQL Editor** > **New query**. Coller la commande ci-dessous en remplaçant **seulement** le texte entre `'<` et `>'` (garder les apostrophes), puis **Run**. Une commande par secret :

```sql
insert into prive.reglages (cle, valeur) values ('jeton_visiteurs', encode(sha256(convert_to('<VISITEURS_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_notifications', encode(sha256(convert_to('<CRON_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_codes_telephone', encode(sha256(convert_to('<CODES_TELEPHONE_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
insert into prive.reglages (cle, valeur) values ('jeton_confirmation', encode(sha256(convert_to('<CONFIRMATION_SECRET>', 'UTF8')), 'hex')) on conflict (cle) do update set valeur = excluded.valeur;
```

3. **Effacer ensuite la requête** de l'éditeur SQL (et l'extrait enregistré s'il y en a un) : elle contient les secrets en clair.

**Vérifier** : nouvelle requête `select cle, length(valeur) from prive.reglages order by cle;` → les 4 clés `jeton_…` apparaissent avec la longueur **64**. Le vrai contrôle se fait après l'étape 4 (tests indiqués à chaque secret).

**Pièges**
- La valeur sur Vercel doit être **exactement** celle utilisée ici. Un caractère de différence = refus silencieux (statistiques vides, messages qui ne partent pas).
- Changer un secret plus tard = **trois** choses : nouvelle valeur sur Vercel (Production **et** Preview) + redéploiement, nouvelle empreinte (même commande), et pour `CRON_SECRET` mise à jour sur cron-job.org (étape 7).
- Ne jamais réutiliser le même secret pour deux variables (la séparation est voulue : une fuite de l'un n'ouvre pas les autres).

---

## Étape 4 — Les variables sur Vercel

Où : projet Vercel > **Settings** > **Environment Variables** > pour chaque ligne : **Name**, **Value**, cocher les environnements, **Save** ([doc](https://vercel.com/docs/environment-variables/managing-environment-variables)). Pour une valeur propre à la preview, choisir **Preview** et la branche `test`.

| Variable | Production | Preview (branche `test`) | Remarque |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iloyliuzsflzbkhpvxjt.supabase.co` | idem | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique Supabase | idem | publique |
| `NEXT_PUBLIC_SITE_URL` | `https://<votre-domaine>` | `https://test.<votre-domaine>` | **différente** ; à régler **avant d'imprimer des affiches** |
| `VISITEURS_SECRET` | secret | **même valeur** | étape 3 |
| `CRON_SECRET` | secret | **même valeur** | étape 3 ; au moins 16 caractères (le code refuse plus court) |
| `CODES_TELEPHONE_SECRET` | secret | **même valeur** | étape 3 |
| `CONFIRMATION_SECRET` | secret | **même valeur** | étape 3 |
| `ANTHROPIC_API_KEY` | clé de l'étape 5 | idem | secrète |
| `ANTHROPIC_MODELE` | `claude-haiku-5-5` | idem | valeur de `.env.example` |
| `WHATSAPP_FOURNISSEUR` | `meta` | idem | |
| `WHATSAPP_TOKEN` | jeton de l'étape 6 | idem | secret |
| `WHATSAPP_PHONE_NUMBER_ID` | identifiant de l'étape 6 | idem | |
| `WHATSAPP_LANGUE` | `fr` | idem | |
| `WHATSAPP_API_VERSION` | laisser vide (`v23.0` par défaut) | idem | ne changer que sur conseil du développeur |
| `CONNEXION_CLIENT` | `email` | `email` | passe à `telephone` aux étapes 12-13 seulement |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clé de site de l'étape 10 | idem | publique ; ajoutée à l'étape 10 |

Puis **Deployments** > dernier déploiement de production > menu **⋯** > **Redeploy** ; idem pour la branche `test`.

**Vérifier**
- `VISITEURS_SECRET` : ouvrir une fiche article, « Signaler cet article », choisir un motif, « Envoyer le signalement » : « Merci, nous allons vérifier. » (et non « …pas disponible pour le moment… »). Le lendemain, `/espace/statistiques` d'une boutique montre des vues.
- `NEXT_PUBLIC_SITE_URL` : `/espace` d'un commerçant, bloc « Partager ma boutique » : le lien commence par `https://<votre-domaine>/b/`.

**Pièges**
- Les variables `NEXT_PUBLIC_…` sont copiées dans le site **au moment du déploiement** : sans redéploiement, l'ancienne valeur reste.
- Copier-coller sans espace ni retour à la ligne en trop.
- Mettre aussi les mêmes valeurs dans `.env.local` sur le PC pour les essais locaux (sauf `NEXT_PUBLIC_SITE_URL` qui reste `http://127.0.0.1:3000` sur le PC).

---

## Étape 5 — Anthropic (IA) : clé et plafond de dépenses

1. Console Claude (anciennement console.anthropic.com) > **Settings** > **Workspaces** : créer un espace de travail « OranPromo » (les plafonds ne peuvent pas être posés sur l'espace par défaut).
2. Dans cet espace : régler un **plafond de dépenses mensuel** (par exemple 20 $), puis **API Keys** > créer une clé → `ANTHROPIC_API_KEY` (étape 4).
3. **Settings** > **Billing** > **Spend limits** > **Set limit** : plafond pour toute l'organisation ([doc](https://docs.claude.com/en/api/rate-limits)). Si une recharge automatique des crédits est proposée, la laisser **désactivée**.

**Vérifier** : un commerçant d'une boutique validée ajoute un article avec une photo : titre et description se remplissent. La page **Usage** de la console montre l'appel.
**Pièges** : plafond atteint = l'IA ne répond plus jusqu'au mois suivant, mais le formulaire reste utilisable à la main (prévu par US-14). Le site limite déjà à 30 appels par heure et par compte.

---

## Étape 6 — Meta WhatsApp Business (messages des commandes)

**Deux numéros WhatsApp dédiés** (conseil de ce guide) :
- **numéro A** : codes de connexion, enregistré **par Twilio** (étape 8) ;
- **numéro B** : messages des commandes, branché **directement** sur l'API WhatsApp Cloud de Meta (cette étape).
Pourquoi deux : Twilio demande un compte WhatsApp Business (WABA) **créé par Twilio**, à ne pas partager avec un autre fournisseur ([Twilio Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)), et un numéro ne peut être actif que chez un fournisseur à la fois ([Twilio, migration](https://www.twilio.com/docs/whatsapp/migrate-numbers-and-senders)). Les deux comptes peuvent appartenir au même portefeuille Meta (étape 0).
Chaque numéro : **jamais utilisé dans l'application WhatsApp** (ou supprimé de WhatsApp avant), capable de recevoir un SMS ou un appel (code de Meta).

### 6.1 Application Meta et compte WhatsApp
1. developers.facebook.com > **My Apps** > **Create App** > cas d'usage **« Connect with customers through WhatsApp »** > choisir le portefeuille OranPromo > **Create app** ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)).
2. **Start using the API** > page **API Setup** : relier ou créer le compte WhatsApp Business, puis **ajouter le numéro B** (« Add phone number »), nom affiché **OranPromo**, et le vérifier par le code reçu.
3. Noter le **Phone number ID** affiché sur API Setup → `WHATSAPP_PHONE_NUMBER_ID`.
4. **Enregistrer le numéro pour l'API** : Meta n'accepte cet enregistrement **que par une commande** (pas par l'écran) ([doc Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/)) : `POST https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>/register` avec `{"messaging_product":"whatsapp","pin":"<6 chiffres choisis>"}` et le jeton de 6.2. Demander au développeur de la lancer avec vous si besoin (le jeton ne doit pas lui être envoyé par chat : il la lance sur votre PC ou vous la lancez). Garder le PIN dans le gestionnaire de mots de passe.
5. Ajouter un **moyen de paiement** au compte WhatsApp dans **Billing Hub** de Meta Business Suite : sans lui, les messages payants ne partent pas ([tarifs Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). L'Algérie est dans la zone « Rest of Africa ».

### 6.2 Jeton permanent (utilisateur système)
([doc Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens))
1. Meta Business Suite > **Paramètres de l'entreprise** (Business Settings) > **Utilisateurs système** (System users) > **Ajouter** > nom « oranpromo-serveur », rôle **Admin**.
2. **Assign assets** : l'application (contrôle total, « Manage app ») et le compte WhatsApp (contrôle total).
3. **Generate token** > choisir l'application > expiration **Never** (jamais) > autorisations `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging` > copier le jeton → `WHATSAPP_TOKEN` (étape 4).

Piège : le jeton « temporaire » de la page API Setup expire en quelques heures : ne pas l'utiliser.

### 6.3 Les modèles de messages à faire approuver
Où : **WhatsApp Manager** > **Modèles de messages** (Message templates) > **Créer un modèle** ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)). Pour chacun : catégorie **Utilitaire** (Utility), langue **français (`fr`)**, nom **exact**, texte **exact** (copier-coller, variables `{{1}}`… comprises), un exemple pour chaque variable. Créer les modèles dans le compte WhatsApp du **numéro B**.

| Nom | Texte (à copier tel quel) | Exemples de variables |
|---|---|---|
| `oranpromo_nouvelle_commande` | Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Confirmez-la dans votre espace OranPromo, rubrique Commandes. | 12 · Amina · 2 · 7 000 DA |
| `oranpromo_commande_prete` | Bonjour {{1}}, votre commande n° {{2}} est prête chez {{3}}. Vous pouvez la récupérer jusqu'au {{4}}. | Amina · 12 · Boutique Nour · samedi 18 octobre à 17 h |
| `oranpromo_commande_expiree` | Bonjour {{1}}, votre commande n° {{2}} chez {{3}} n'a pas été récupérée dans les 24 heures : elle est annulée et les articles sont remis en vente. Merci de ne commander que ce que vous viendrez chercher. | Amina · 12 · Boutique Nour |
| `oranpromo_no_show` | Bonjour {{1}}, {{2}} nous signale que vous n'êtes pas venu(e) chercher votre commande n° {{3}}. C'est votre {{4}}e commande non récupérée : encore {{5}} et votre compte OranPromo sera bloqué. Merci de ne commander que ce que vous viendrez chercher. | Amina · Boutique Nour · 12 · 2 · 3 |
| `oranpromo_compte_bloque` | Bonjour {{1}}, votre compte OranPromo est bloqué après 5 commandes non récupérées. Pour le débloquer, contactez OranPromo. | Amina |
| `oranpromo_nouvelle_commande_confirmer` | Nouvelle commande n° {{1}} sur OranPromo : {{2}}, {{3}} article(s), {{4}}. Touchez Confirmer, ou confirmez-la dans votre espace OranPromo, rubrique Commandes. | 12 · Amina · 2 · 7 000 DA |

Pour **`oranpromo_nouvelle_commande_confirmer`** (US-20.6) en plus : section **Boutons** > **Visiter le site web** (Visit website), type **dynamique**, libellé **`Confirmer`**, adresse `https://<votre-domaine>/confirmer/{{1}}` (le domaine **définitif**, sans `www` si votre adresse principale n'en a pas). Exemple de fin d'adresse : `exemple`. Ce modèle se crée **une fois le domaine définitif connu** ; l'activation est l'étape 14.

Les 5 premiers textes viennent de `docs/architecture.md` (« Commandes ») et le 6e de `docs/ETAT.md` (« Reste à faire côté propriétaire »). En cas de doute, ce sont ces fichiers qui font foi.

**Vérifier** : chaque modèle passe à **Actif** (Active) dans WhatsApp Manager (examen jusqu'à 24 h). Puis, sur la preview, passer une commande de test : la boutique de test reçoit « Nouvelle commande n° … » sur son WhatsApp, et la table Supabase `messages_whatsapp` montre le message `envoye` (Table Editor).

**Pièges**
- Un nom ou une variable différente d'une seule lettre = message refusé par Meta (colonne `erreur` de `messages_whatsapp`, « Meta 400 … »).
- Ne pas laisser Meta reclasser un modèle en **Marketing** : refaire la demande en Utilitaire avec le texte exact.
- Le **nom affiché** doit respecter les règles de Meta ; refusé = 250 messages par jour au plus ([Twilio](https://www.twilio.com/docs/whatsapp/self-sign-up)).
- Meta demande que les clients aient **accepté** de recevoir ces messages : à mentionner dans les conditions d'utilisation (point à voir avec le développeur).
- **Arabe (US-23, en cours)** : les messages aux clientes en arabe seront de **nouveaux modèles** (même nom en langue `ar`, ou nom en `…_ar`, selon ce que le développeur fixera), **à faire approuver par Meta** avant usage : `oranpromo_commande_prete`, `oranpromo_commande_expiree`, `oranpromo_no_show`, `oranpromo_compte_bloque`. Les messages à la boutique restent en français. Tant qu'un modèle arabe n'est pas approuvé, le message part en français. Prévoir cette demande dès que les textes arabes sont validés (`docs/user-stories.md`, US-23).

---

## Étape 7 — cron-job.org : envoi des messages en attente toutes les 5 minutes

**Pourquoi** : les messages « nouvelle commande », « prête » et « client pas venu » partent juste après l'action ; les **rappels d'expiration, les blocages et les nouvelles tentatives** partent par la tâche `GET /api/notifications/whatsapp`. En Hobby, Vercel ne la lance qu'**une fois par jour** et à l'heure près ([doc](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Un service externe gratuit l'appelle toutes les 5 minutes. (En Pro, le développeur peut passer `vercel.json` à `*/5 * * * *` ; cron-job.org reste alors un simple doublon sans danger, chaque message étant réservé avant envoi.)

**Quoi faire** (cron-job.org > **Create cronjob**) :
- **URL** : `https://<votre-domaine>/api/notifications/whatsapp` (l'adresse **principale**, sans redirection) ;
- **Planification** : toutes les 5 minutes ;
- **Advanced** > **Request method** : `GET` ; **Headers** : clé `Authorization`, valeur `Bearer <CRON_SECRET>` (le mot `Bearer`, un espace, puis le secret) ([FAQ cron-job.org](https://cron-job.org/en/faq/)) ;
- activer les **notifications d'échec** par e-mail ;
- **Test run**, puis **Save**.

**Vérifier** (réponse du Test run) :
- `200` avec `{"envoyes":…,"echecs":…,"reportes":…,"traites":…}` → tout va bien ;
- `200` « WhatsApp non configuré : les messages restent en attente. » → manque `WHATSAPP_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID` ;
- `401` « Accès refusé. » → l'en-tête ne correspond pas à `CRON_SECRET` ;
- `503` « Tâche non configurée. » → `CRON_SECRET` absent sur Vercel (ou moins de 16 caractères) ;
- `500` → le plus souvent l'empreinte `jeton_notifications` ne correspond pas (refaire l'étape 3).

**Pièges** : ne jamais pointer vers `test.<votre-domaine>` (protégé, réponse 401 de Vercel) ; une adresse qui redirige (`www` ↔ sans `www`) fait échouer l'appel ; le secret est confié à cron-job.org : en cas de doute, le changer (règle de l'étape 3).

---

## Étape 8 — Twilio : expéditeur WhatsApp des codes et service Verify

Décision du propriétaire : **code par WhatsApp uniquement, aucun SMS** (US-21.5).

### 8.1 Compte payant, prépayé, sans recharge automatique
1. Créer le compte sur twilio.com, puis le passer en compte payant : Console > **Admin** > **Account billing** > **Upgrade account** ([doc](https://www.twilio.com/docs/whatsapp/self-sign-up)). Un compte d'essai n'envoie qu'aux numéros vérifiés à la main.
2. Ajouter un **petit crédit** (par exemple 20 $) et **désactiver la recharge automatique** (Auto-recharge) dans la facturation **(chemin à confirmer : Console > Billing)** ([doc facturation](https://www.twilio.com/docs/usage/billing)) : le solde devient le plafond de dépense.
3. Mettre une **alerte de consommation** : *Usage Triggers* (déclencheur au-delà d'un montant par jour) ([doc](https://www.twilio.com/docs/usage/api/usage-trigger)) et, si proposée, l'alerte e-mail de solde bas **(chemin à confirmer)**.

### 8.2 Expéditeur WhatsApp (numéro A)
([Twilio Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) ; [Bring your own sender](https://www.twilio.com/docs/verify/whatsapp/byo))
1. Console > **Messaging** > **Senders** > **WhatsApp Senders** > **Create new sender**.
2. Choisir le numéro A (un numéro Twilio acheté dans **Phone Numbers**, ou le vôtre), **Continue with Facebook**, choisir le portefeuille OranPromo, **créer un nouveau compte WhatsApp Business** (ne pas choisir celui du numéro B), nom affiché « OranPromo », vérifier le numéro, **Confirm**.
3. Console > **Messaging** > **Services** > créer un **Messaging Service** « OranPromo codes » et y ajouter cet expéditeur. Noter son identifiant `MG…`.

### 8.3 Service Verify
1. Console > **Verify** > **Services** > **Create new** : nom « OranPromo », code à **6 chiffres**, canal **WhatsApp** ; **Fraud Guard** : activé ([doc Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)). Noter le **Service SID** (`VA…`).
2. Dans le service, onglet **WhatsApp** : choisir le Messaging Service `MG…` de 8.2 ([doc](https://www.twilio.com/docs/verify/whatsapp/byo)).
3. **Désactiver le canal SMS et la voix** dans la configuration du service. ⚠️ Essentiel : quand le canal SMS est actif, Twilio **bascule de WhatsApp vers le SMS** en cas d'échec et facture un SMS ([doc](https://www.twilio.com/docs/verify/fallback-scenarios)). Si la console ne permet pas de le désactiver, n'autoriser **aucun pays** pour le SMS (point suivant).
4. Console > **Verify** > **Settings** > **Geo permissions** : SMS et voix **désactivés partout sauf l'Algérie** (ou désactivés partout), **Save** ([doc](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions)). WhatsApp n'a pas de blocage par pays chez Twilio, mais la base refuse déjà tout numéro non algérien.
5. Noter l'**Account SID** (`AC…`) et l'**Auth Token** (page d'accueil de la console) pour l'étape 9.

**Vérifier** : la page de l'expéditeur indique « Online » ; l'onglet WhatsApp du service montre le Messaging Service. L'essai réel se fait à l'étape 12.
**Pièges** : tant que Meta n'a pas approuvé l'expéditeur, **aucun code ne part** : rester en mode e-mail. Twilio limite à 5 codes par numéro en 10 minutes (erreur 60203). Erreur 63008 = Messaging Service manquant dans le service Verify.

---

## Étape 9 — Supabase : connexion par téléphone et plafonds

1. Supabase > **Authentication** > **Sign In / Providers** > **Phone** : activer ; fournisseur **Twilio Verify** ; coller **Account SID**, **Auth Token**, **Verify Service SID** (`VA…`) ; laisser « Enable phone signup » activé ; **Save** ([doc](https://supabase.com/docs/guides/auth/phone-login/twilio)).
2. **Authentication** > **Rate Limits** ([doc](https://supabase.com/docs/guides/auth/rate-limits)) :
   - messages par heure (« SMS messages sent », WhatsApp compris, pour tout le projet) : **20 à 30** au lancement — c'est le plafond de dépense ;
   - « Send OTPs » : garder **60 secondes** ;
   - demandes de connexion par IP : garder **30 par 5 minutes**.

**Vérifier** : la page Phone indique « Enabled » avec Twilio Verify.
**Pièges** : les clés Twilio vont **uniquement ici**, jamais sur Vercel ni dans `.env.local`. Changer l'Auth Token chez Twilio sans le recopier ici = plus aucun code. Si de vrais clients sont bloqués par le plafond horaire, le remonter **petit à petit**.

---

## Étape 10 — Cloudflare Turnstile (anti-robot)

1. dash.cloudflare.com > **Turnstile** > **Add widget** ([doc](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)) : nom « OranPromo » ; domaines : `<votre-domaine>`, `test.<votre-domaine>`, `127.0.0.1`, `localhost` ; mode **Managed** ; **Create**.
2. Copier la **clé de site** (Site key, publique) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` sur Vercel (Production **et** Preview) et dans `.env.local` ; redéployer **les deux**.
3. Garder la **clé secrète** pour l'étape 11 (gestionnaire de mots de passe).

**Vérifier** : sur la production, la preview et le PC, les formulaires de connexion (`/espace/connexion`, `/compte/connexion`) affichent le contrôle Cloudflare.
**Piège** : un domaine oublié dans la liste = le contrôle échoue sur ce domaine.

## Étape 11 — Supabase : protection captcha (SEULEMENT après l'étape 10)

⚠️ Dès que cette protection est active, **toutes** les connexions (e-mail comprises) exigent le contrôle Turnstile. Si un site (production, preview **ou** PC) n'a pas encore la clé de site déployée, plus personne ne peut s'y connecter.

1. Supabase > **Authentication** > **Attack Protection** > **Enable Captcha protection** ; fournisseur **Turnstile by Cloudflare** ; coller la **clé secrète** ; **Save** ([doc](https://supabase.com/docs/guides/auth/auth-captcha) ; [configuration](https://supabase.com/docs/guides/auth/general-configuration)).

**Vérifier** : connexion par lien e-mail réussie sur la production, la preview et le PC.
**Retour arrière** en cas de blocage : désactiver la même case.

---

## Étape 12 — Essai du mode téléphone (sur la preview)

Seulement quand l'expéditeur WhatsApp (étape 8) est approuvé par Meta.

1. Vercel > `CONNEXION_CLIENT` = `telephone` **en Preview seulement**, redéployer la branche `test`. (Ne **pas** créer le réglage `connexion_client` dans la base à ce stade.)
2. Sur `https://test.<votre-domaine>/compte/connexion` : saisir un mobile algérien, passer le contrôle, « Recevoir le code sur WhatsApp », saisir le code → connecté.
3. Avec un compte créé par e-mail : `/compte` > vérifier le numéro par code.
4. Dans Twilio > **Monitor** > **Logs** (Verify) : canal **whatsapp**, aucun SMS.

Les tests détaillés sont dans `docs/tests-manuels.md`.

## Étape 13 — Mise en service du mode téléphone

Seulement après l'approbation de Meta **et** un essai réussi.
1. Vercel > `CONNEXION_CLIENT` = `telephone` en **Production**, redéployer.
2. **Puis** Supabase > SQL Editor :
```sql
insert into prive.reglages (cle, valeur) values ('connexion_client', 'telephone') on conflict (cle) do update set valeur = excluded.valeur;
```
À partir de là, la base refuse toute commande sans numéro vérifié (production **et** preview).

**Vérifier** : un compte sans numéro vérifié voit « Vérifiez votre numéro pour commander » dans `/panier`.
**Retour au mode e-mail** : `delete from prive.reglages where cle = 'connexion_client';`, puis `CONNEXION_CLIENT=email` sur Vercel et redéployer.
**Piège** : ordre inverse (réglage de la base avant la variable) = les clients ne peuvent plus commander et n'ont pas encore l'écran pour vérifier leur numéro.

## Étape 14 — Bouton « Confirmer » dans le message WhatsApp (US-20.6)

Prérequis : `CONFIRMATION_SECRET` et son empreinte (étape 3), domaine définitif, modèle `oranpromo_nouvelle_commande_confirmer` **approuvé** par Meta (étape 6.3).

1. **Seulement après l'approbation**, Supabase > SQL Editor :
```sql
insert into prive.reglages (cle, valeur) values ('bouton_confirmer', 'on') on conflict (cle) do update set valeur = excluded.valeur;
```
2. **Vérifier** : une nouvelle commande de test → la boutique reçoit le message avec le bouton « Confirmer » ; le bouton ouvre `https://<votre-domaine>/confirmer/…`, la page montre la commande **sans** le téléphone du client ; « Confirmer la commande » → « Commande confirmée : le stock est mis à jour. Pensez à la préparer. »
3. **Retour arrière** : `delete from prive.reglages where cle = 'bouton_confirmer';` (l'ancien message sans bouton repart).

**Pièges** : activer le réglage avant l'approbation = messages refusés par Meta (modèle inconnu). Sans `CONFIRMATION_SECRET`, l'ancien message sans bouton part (rien n'est perdu). Le lien ne vaut que 24 heures et pour une seule commande.

---

## Étape 15 — Jour J

### 15.1 Retirer les données de démonstration
Script `supabase/scripts/retirer_donnees_demo.sql` (détail : `docs/ETAT.md`, « Retrait des données de démonstration »). **Par défaut, il ne supprime rien (essai à blanc).**
1. Supabase > SQL Editor > coller **tout** le fichier tel quel > **Run** : rien n'est supprimé ; le tableau final indique, table par table, ce qui **serait** supprimé. Vérifier que c'est bien la démo (compte `hakim3142@gmail.com`, « Boutique Nour », les 5 articles de démonstration, photos `placehold.co`).
2. Pour supprimer vraiment : dans le texte collé, remplacer `appliquer constant boolean := false` par `appliquer constant boolean := true` (ligne marquée ⚠), relancer. Tout se fait en une fois : en cas d'erreur, **rien** n'est supprimé.
3. Relancer une deuxième fois (avec `true`) : le tableau doit afficher **0** partout.

Pièges : si le script s'arrête en parlant de photos dans le stockage, les supprimer d'abord dans **Storage** > `photos`, puis relancer. Le compte admin et « Maison Ilyes » sont gardés ; **changer ou retirer le WhatsApp de Maison Ilyes** (numéro français du propriétaire) avant l'ouverture (admin, `/admin/boutiques`).

### 15.2 Contrôles finaux
- [ ] `NEXT_PUBLIC_SITE_URL` = domaine définitif **avant d'imprimer** la moindre affiche (lien et QR code en dépendent).
- [ ] Les 4 empreintes `jeton_…` présentes (étape 3) ; statistiques et « Signaler » fonctionnent.
- [ ] cron-job.org : derniers appels en `200`.
- [ ] `messages_whatsapp` : aucun message bloqué en `a_envoyer` depuis plus de 10 minutes, ni `echec` inexpliqué.
- [ ] Plafonds en place : Supabase Spend Cap, Rate Limits (20-30 codes/h), Twilio sans recharge automatique + alerte, Anthropic.
- [ ] Coller le lien d'une boutique dans WhatsApp : l'aperçu (nom, photo) s'affiche.
- [ ] `docs/tests-manuels.md` entièrement coché sur la preview.

### 15.3 Après l'ouverture (chaque semaine)
Twilio (solde, logs Verify), Meta (qualité des modèles, statut du numéro), Supabase (Usage, `messages_whatsapp`), Anthropic (Usage), Resend (e-mails rejetés), cron-job.org (échecs).

---

## Ce qui n'a pas pu être vérifié dans la documentation officielle

- **Twilio** : chemins exacts pour désactiver la recharge automatique et créer une alerte e-mail (les pages d'aide Twilio ne s'affichent pas sans navigateur) ; libellé exact de la désactivation du canal SMS dans un service Verify.
- **Un seul numéro pour les deux usages** (codes par Twilio et messages par Meta) : non retenu ici, faute de confirmation ; d'où le conseil de deux numéros.
- **Supabase** : libellés exacts des lignes de **Rate Limits** (« SMS messages sent » dans `docs/ETAT.md`, « SMS messages sent by Supabase Auth » dans la doc).
- **Cloudflare** : place du menu Turnstile dans la barre latérale (le lien direct de la doc mène à la bonne page).
- **Console Claude** : adresse exacte (console.anthropic.com redirige vers la nouvelle console) et existence d'une recharge automatique.
- **Meta** : nom exact du type de bouton (« Visiter le site web ») et libellé « French » de la langue dans WhatsApp Manager.

## Sources (consultées le 9 octobre 2026)

- Vercel : [variables](https://vercel.com/docs/environment-variables/managing-environment-variables) · [domaines](https://vercel.com/docs/domains/working-with-domains/add-a-domain) · [domaine d'une branche](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch) · [environnements](https://vercel.com/docs/deployments/environments) · [tâches planifiées](https://vercel.com/docs/cron-jobs) · [limites des tâches](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [gestion des tâches](https://vercel.com/docs/cron-jobs/manage-cron-jobs) · [protection des déploiements](https://vercel.com/docs/deployment-protection) · [plan Hobby](https://vercel.com/docs/plans/hobby)
- Supabase : [adresses de redirection](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [limites](https://supabase.com/docs/guides/auth/rate-limits) · [connexion par téléphone](https://supabase.com/docs/guides/auth/phone-login/twilio) · [captcha](https://supabase.com/docs/guides/auth/auth-captcha) · [configuration](https://supabase.com/docs/guides/auth/general-configuration) · [check-list production](https://supabase.com/docs/guides/deployment/going-into-prod) · [plafond de dépenses](https://supabase.com/docs/guides/platform/cost-control)
- Resend : [Supabase par SMTP](https://resend.com/docs/send-with-supabase-smtp)
- Twilio : [Verify WhatsApp](https://www.twilio.com/docs/verify/whatsapp) · [expéditeur personnel](https://www.twilio.com/docs/verify/whatsapp/byo) · [choix et bascule de canal](https://www.twilio.com/docs/verify/fallback-scenarios) · [Geo permissions](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions) · [Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard) · [Self Sign-up WhatsApp](https://www.twilio.com/docs/whatsapp/self-sign-up) · [migration de numéros](https://www.twilio.com/docs/whatsapp/migrate-numbers-and-senders) · [WhatsApp avec Twilio](https://www.twilio.com/docs/whatsapp/api) · [facturation](https://www.twilio.com/docs/usage/billing) · [Usage Triggers](https://www.twilio.com/docs/usage/api/usage-trigger)
- Meta : [démarrer avec l'API Cloud](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) · [jetons d'accès](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens) · [modèles](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) · [enregistrement du numéro](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/) · [tarifs](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- Anthropic : [limites et plafonds de dépenses](https://docs.claude.com/en/api/rate-limits)
- Cloudflare : [créer un widget Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)
- cron-job.org : [FAQ (en-têtes personnalisés)](https://cron-job.org/en/faq/)

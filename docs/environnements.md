# Environnements : production et dev séparés (Vercel + Supabase)

> Carte Trello « Mise en ligne · Environnements prod et dev (Vercel + Supabase) ». Plan pas à pas pour le propriétaire.
> **Rien n'est créé par ce document** : chaque case est un geste à faire par le propriétaire (ou à confier au
> développeur quand c'est écrit « développeur »). **Aucune ressource payante** : le projet de dev reste sur le plan
> gratuit de Supabase, les previews Vercel sont comprises dans le plan du projet.
> Vocabulaire et noms repris de `docs/guide-mise-en-ligne.md` (branche `test`, adresse `test.bledeal.com`). Les
> chemins de menus des tableaux de bord changent souvent : en cas de doute, c'est écrit **(chemin à confirmer)**.

## Pourquoi

Aujourd'hui il n'y a **qu'une base** (`oranpromo`, `iloyliuzsflzbkhpvxjt`) : le site sur le PC, la preview et bientôt
la production écrivent dans la même base (règle 6 du guide de mise en ligne). Une commande d'essai est une vraie ligne,
ses messages WhatsApp partent vraiment, une migration mal faite touche directement les vrais clients, et plusieurs
agents ne peuvent pas travailler sans risque.

Après ce plan :

| | Production | Dev (test) | Tests automatiques |
| --- | --- | --- | --- |
| Site | `main` → `https://bledeal.com` | branche `test` → `https://test.bledeal.com` ; chaque PR a aussi sa preview | site local, port 3100 |
| Base Supabase | `oranpromo` (`iloyliuzsflzbkhpvxjt`) | **nouveau projet `bledeal-dev`** (gratuit) | Supabase local (`npx supabase start`) |
| Données | vraies | données de démo et comptes d'essai | créées puis oubliées par chaque test |
| WhatsApp, Claude | oui | non (variables vides), sauf choix contraire | jamais |
| Qui l'utilise | clients et boutiques | Hakim, Claude (relecture), agents | `npm run test:e2e` (`docs/tests-parcours.md`) |

Le parcours d'une modification devient : **PR → preview (base de dev) → test par Hakim sur `test.bledeal.com` →
fusion dans `main` → production automatique**. Les migrations suivent le même ordre : **dev d'abord, production ensuite**.

## Ce qui reste gratuit (et ce qu'il ne faut pas faire)

- Supabase donne **2 projets gratuits actifs** par personne (Owner ou Admin), toutes organisations confondues ; un
  projet en pause ne compte pas ([Supabase, facturation](https://supabase.com/docs/guides/platform/billing-faq)).
  Aujourd'hui : 1 projet (`oranpromo`). `bledeal-dev` sera le 2e. **Ne pas créer de 3e projet.**
- Une organisation a **un seul plan** pour tous ses projets. Quand la production passera en **Pro** (guide, étape 2.1),
  **tout nouveau projet dans cette organisation coûte environ 10 $ par mois** (une instance « Micro » par projet).
  ➜ **`bledeal-dev` va dans une organisation à part, restée sur le plan Free**. Ne jamais le transférer dans
  l'organisation de production. Ne pas activer « Branching » (payant).
- Un projet gratuit se met **en pause après 7 jours sans activité** : pour `bledeal-dev`, ce n'est pas grave
  (Supabase › projet › **Restore** / « Resume », gratuit). Pas de sauvegarde : la base de dev se reconstruit avec les
  migrations et les scripts de démo.
- Vercel : les previews et les variables par environnement sont comprises dans tous les plans. Les « Custom
  Environments » (payants) ne sont **pas** nécessaires : on utilise **Preview** + la branche `test`.

## La liste à cocher (dans l'ordre)

**A. Supabase : le projet de dev** (≈ 20 min)
- [ ] A1. Créer l'organisation gratuite « BleDeal dev ».
- [ ] A2. Y créer le projet `bledeal-dev` (région Paris, comme la production).
- [ ] A3. Noter l'adresse du projet et sa clé publique ; mot de passe de la base dans le gestionnaire de mots de passe.
- [ ] A4. Donner accès au développeur (connecteur Supabase de Grok Bot / Claude) à cette organisation.
- [ ] A5. Appliquer toutes les migrations du dépôt à `bledeal-dev` (développeur, ou propriétaire avec la commande).
- [ ] A6. Adresses autorisées (URL Configuration) du projet de dev.
- [ ] A7. Réglages et données de démo du dev.

**B. Vercel : production et preview** (≈ 15 min)
- [ ] B1. Branche Git `test` (développeur) et adresse fixe `test.bledeal.com` (guide, étape 1.5).
- [ ] B2. Variables **Production** = projet `oranpromo` ; variables **Preview** = projet `bledeal-dev`.
- [ ] B3. Secrets **différents** en Preview, avec leurs empreintes dans la base de dev.
- [ ] B4. Redéployer production et `test`, puis vérifier.

**C. Sur le PC** (≈ 5 min)
- [ ] C1. `.env.local` branché sur `bledeal-dev` (le site lancé sur le PC n'écrit plus dans la production).

**D. Façon de travailler** (développeur, rien à cliquer)
- [ ] D1. Migrations : dev d'abord, production ensuite (détail plus bas).
- [ ] D2. Mettre à jour `docs/ETAT.md` (« Infrastructure ») et la règle 6 du guide une fois A à C faits.

---

## A. Supabase : le projet de dev

### A1. Organisation gratuite
supabase.com › menu des organisations (en haut à gauche) › **New organization** › nom « BleDeal dev », type
« Personal », plan **Free** › **Create organization**. Ne saisir **aucune carte bancaire**.

### A2. Projet `bledeal-dev`
Dans l'organisation « BleDeal dev » › **New project** :
- **Name** : `bledeal-dev` ;
- **Database password** : bouton **Generate a password**, puis le ranger dans le gestionnaire de mots de passe
  (« Supabase bledeal-dev, base ») ;
- **Region** : la même que la production (Europe, Paris : `eu-west-3`) ;
- laisser le reste par défaut (instance gratuite) › **Create new project**. Attendre « Project is ready ».

**Vérifier** : la page de facturation de l'organisation « BleDeal dev » affiche « Free Plan », 0 $.

### A3. Adresse et clé publique
Projet `bledeal-dev` › **Project Settings** › **API Keys** (ou **Data API**) :
- **Project URL** : `https://<ref-dev>.supabase.co` (`<ref-dev>` = l'identifiant de 20 lettres du projet) ;
- **clé publique** : la clé **publishable** (`sb_publishable_…`) ; si l'écran ne montre que les anciennes clés, la clé
  **anon** (onglet « Legacy API keys »). C'est elle qui va dans `NEXT_PUBLIC_SUPABASE_ANON_KEY` (le code accepte les
  deux formes ; elle est publique).
- **Ne jamais copier** la clé **secret** / **service_role** nulle part : le site n'en a pas besoin.

Donner au développeur seulement `<ref-dev>` (ce n'est pas un secret).

### A4. Accès du développeur
Pour que les agents appliquent les migrations au dev **avant** la production, le connecteur Supabase doit voir la
nouvelle organisation : dans l'application où le connecteur est installé (Grok Bot, Claude…), **reconnecter Supabase**
et cocher l'organisation « BleDeal dev » quand la page d'autorisation le demande **(chemin à confirmer)**.
Sans connecteur, le propriétaire peut faire l'étape A5 lui-même avec la commande ci-dessous.

### A5. Toutes les migrations dans la base de dev
La base de dev part **vide** : on y rejoue les fichiers de `supabase/migrations/` dans l'ordre. Ils ont été vérifiés
sur une base vide (c'est ce que font les tests de parcours, `docs/tests-parcours.md`).

Avec le connecteur (développeur) : `apply_migration` de chaque fichier, dans l'ordre des noms, sur `<ref-dev>`.

Ou depuis le PC (propriétaire), dans le dossier du projet, Docker **non** nécessaire :
```
npx supabase login
npx supabase link --project-ref <ref-dev>
npx supabase db push
```
`db push` demande le mot de passe de la base de dev (A2) et liste les migrations avant de les appliquer : vérifier que
la ligne « Remote database » est bien **`<ref-dev>`**.

⚠️ **Ne jamais lancer `npx supabase db push` sur la production** (`iloyliuzsflzbkhpvxjt`) : ses migrations ont été
appliquées une par une par le connecteur, avec des numéros de version différents des noms de fichiers ;
`db push` voudrait tout rejouer. Après le travail sur le dev, remettre le lien sur la production seulement si
`npm run db:types` doit lire la production (`npx supabase link --project-ref iloyliuzsflzbkhpvxjt`) ; le schéma
étant le même, les types tirés du dev sont identiques.

**Vérifier** (projet `bledeal-dev` › **SQL Editor**) :
```sql
select count(*) from supabase_migrations.schema_migrations;   -- = nombre de fichiers de supabase/migrations
select code, ouverte from villes order by ordre;                -- Oran ouverte, les autres fermées
select jobname, schedule from cron.job order by jobname;        -- expirer-commandes, parrainage-quotidien
```
Si `cron.job` est vide : **Database › Extensions** › activer `pg_cron`, puis relancer les deux `cron.schedule` indiqués
dans les messages des migrations `20261009210000_expiration_no_shows.sql` et `20261012090000_parrainage.sql`.

### A6. Adresses autorisées du dev
Projet `bledeal-dev` › **Authentication** › **URL Configuration**
([doc](https://supabase.com/docs/guides/auth/redirect-urls)) :
- **Site URL** : `https://test.bledeal.com` (tant que le domaine n'est pas acheté : l'adresse fixe de la branche `test`
  donnée par Vercel, du type `https://<projet>-git-test-<compte>.vercel.app`) ;
- **Redirect URLs** :
  - `https://test.bledeal.com/**` ;
  - `https://*-<compte>.vercel.app/**` (`<compte>` = le nom du compte ou de l'équipe Vercel, visible dans l'adresse
    des previews) : c'est le « `*.vercel.app` » de la carte, limité à **votre** compte ;
  - `http://127.0.0.1:3000/**` et `http://localhost:3000/**` (site sur le PC).

E-mails : l'envoi intégré de Supabase suffit pour le dev (il n'écrit qu'aux **membres de l'équipe** du projet et
2 e-mails par heure) ; pas de Resend sur le dev. Pour qu'un testeur reçoive les liens, l'inviter dans l'organisation
« BleDeal dev » (**Team** › **Invite**), rôle « Developer » (gratuit).

Connexion par téléphone, Twilio, captcha : **rien** sur le dev (les clients s'y connectent par e-mail).

### A7. Réglages et données de démo du dev
Dans **SQL Editor** du projet `bledeal-dev` (jamais celui de la production) :
1. **Boutique de démo** : coller tout `supabase/scripts/demo_parfumerie.sql` › **Run** (rejouable, ne crée rien de plus).
2. **Comptes d'essai** : sur `test.bledeal.com`, se connecter une fois avec chaque adresse (client A, client B,
   commerçant T, admin), puis donner les rôles :
   ```sql
   update profils set role = 'admin' where id = (select id from auth.users where email = '<e-mail admin>');
   update profils set role = 'commercant', boutique_id = '33333333-3333-3333-3333-333333333333'
     where id = (select id from auth.users where email = '<e-mail commerçant>');
   ```
3. **Parrainage** (pour l'essayer en dev) :
   `insert into prive.reglages (cle, valeur) values ('parrainage', 'on') on conflict (cle) do update set valeur = 'on';`
4. Les numéros vérifiés : sur le dev, pas de code WhatsApp ; pour essayer ce qui demande un numéro vérifié
   (parrainage), le développeur pose le numéro en SQL **sur le dev seulement**.

Le script `supabase/scripts/retirer_donnees_demo.sql` peut aussi tourner sur le dev pour s'entraîner (essai à blanc),
jamais sur la production sans décision du propriétaire.

---

## B. Vercel : production et preview

### B1. Branche `test` et adresse fixe
Voir le guide, étape 1.5 : le développeur crée la branche Git `test` ; Vercel › **Settings** › **Domains** ›
`test.bledeal.com` › **Connect to an environment** : **Preview**, **Git Branch** `test`.
Avant l'achat du domaine : utiliser l'adresse fixe de la branche que Vercel affiche (Deployments › filtre `test`).

Pourquoi une adresse fixe : par sécurité, les liens de connexion ne ramènent que sur l'adresse écrite dans
`NEXT_PUBLIC_SITE_URL` (`lib/origine.ts`). Sur la preview d'une PR (adresse au hasard), on peut **naviguer** mais la
connexion ramène sur `test.bledeal.com`. Pour tester une PR connecté, le développeur pousse la branche de la PR
dans `test` (`git push origin <branche>:test --force`) ; `test.bledeal.com` la montre en 1 à 2 minutes.
(Option à décider plus tard, petite PR de code : accepter aussi l'adresse de la preview donnée par Vercel,
`VERCEL_BRANCH_URL`, quand `VERCEL_ENV` vaut `preview`. Pas faite ici : elle touche une règle de sécurité.)

### B2. Variables par environnement
Vercel › projet › **Settings** › **Environment Variables**. Pour chaque ligne : **Add New**, nom, valeur, cocher
**seulement** l'environnement indiqué, **Save** ([doc](https://vercel.com/docs/environment-variables/managing-environment-variables)).
Une variable cochée « Production » et « Preview » à la fois doit être **séparée en deux** (Edit › décocher Preview,
puis ajouter la valeur de dev en Preview).

| Variable | Production | Preview (toutes les branches sauf `main`) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iloyliuzsflzbkhpvxjt.supabase.co` | `https://<ref-dev>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique de `oranpromo` | clé publique de `bledeal-dev` (A3) |
| `NEXT_PUBLIC_SITE_URL` | `https://bledeal.com` | `https://test.bledeal.com` |
| `CRON_SECRET` | secret de production | **autre** secret (B3) |
| `VISITEURS_SECRET` | secret de production | **autre** secret (B3) |
| `CONFIRMATION_SECRET` | secret de production | **autre** secret (B3) |
| `CODES_TELEPHONE_SECRET` | secret de production | vide (pas de code par téléphone en dev) |
| `CONNEXION_CLIENT` | `email` (puis `telephone`, guide étape 14) | `email` |
| `ANTHROPIC_API_KEY` | clé de production (guide, étape 5) | **vide** (l'IA répond « pas disponible ») ; ou, si vous voulez essayer l'IA en dev, une **deuxième clé** « bledeal-dev » avec un plafond mensuel bas dans la console Anthropic |
| `ANTHROPIC_MODELE` | `claude-haiku-5-5` | idem |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | valeurs Meta (guide, étape 7) | **vides** : aucun message ne part du dev |
| `WHATSAPP_FOURNISSEUR`, `WHATSAPP_LANGUE`, `WHATSAPP_API_VERSION` | `meta`, `fr`, `v23.0` | idem (sans effet sans jeton) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clé de site (guide, étape 11) | vide (pas de captcha sur le dev) ; ou la **clé de test** publique de Cloudflare `1x00000000000000000000AA` (toujours acceptée) |
| `NEXT_PUBLIC_CARTO_CLE` | clé CARTO | même clé si `test.bledeal.com` est autorisé chez CARTO, sinon vide |

Ne rien cocher en « Development » : le PC utilise `.env.local` (étape C1).

### B3. Secrets de la Preview
1. Fabriquer **3 nouveaux secrets** (règle 3 du guide : 40 lettres et chiffres) pour `CRON_SECRET`,
   `VISITEURS_SECRET`, `CONFIRMATION_SECRET` de la Preview ; les ranger (« BleDeal dev … »). Jamais les mêmes qu'en
   production : une fuite du dev ne doit rien ouvrir en production.
2. Projet **`bledeal-dev`** › **SQL Editor** : la même commande que le guide, étape 3, avec ces secrets-là (ligne
   `jeton_codes_telephone` inutile) ; puis effacer la requête.
3. Côté production, rien ne change (étape 3 du guide, secrets de production dans `oranpromo`).

La tâche planifiée de Vercel ne tourne que sur la production ; cron-job.org (guide, étape 8) n'appelle que
`https://bledeal.com`. Rien à faire pour le dev.

### B4. Redéployer et vérifier
Vercel › **Deployments** › dernier déploiement de production › **⋯** › **Redeploy** ; idem pour le dernier
déploiement de la branche `test`.

**Vérifier**
- Sur `https://test.bledeal.com` : la boutique « Parfumerie Démo » apparaît, **aucune** vraie boutique.
- Se connecter sur `https://test.bledeal.com/espace/connexion` : le lien arrive, ramène sur `test.bledeal.com`, connecté.
- Passer une commande sur `test.bledeal.com` : elle apparaît dans `bledeal-dev` (**Table Editor** › `commandes`) et
  **pas** dans `oranpromo`.
- Sur `https://bledeal.com` : les vraies boutiques, comme avant.

---

## C. Sur le PC

### C1. `.env.local` sur la base de dev
Dans `.env.local` (jamais dans un commit) : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` de
**`bledeal-dev`** ; garder `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (ou `http://127.0.0.1:3000`) ; laisser vides
`WHATSAPP_TOKEN` et `CRON_SECRET`. Relancer `lancer-site.bat`.
**Vérifier** : la page d'accueil du PC montre « Parfumerie Démo » et pas les vraies boutiques.

Les tests automatiques n'utilisent ni la production ni le dev : ils tournent sur Supabase en local
(`docs/tests-parcours.md`).

---

## D. Façon de travailler (développeur)

### D1. Migrations : dev d'abord
1. La PR ajoute un **nouveau** fichier dans `supabase/migrations/` (règle inchangée) ; tests SQL et tests de parcours
   en local (base vide + toutes les migrations).
2. **Avant la fusion** : appliquer la migration à **`bledeal-dev`** (connecteur `apply_migration` avec le contenu exact
   du fichier, ou `npx supabase db push` lié au dev) ; pousser la branche dans `test` ; Hakim teste sur
   `test.bledeal.com`.
3. **Après la fusion** : appliquer la même migration à la **production** comme aujourd'hui (connecteur
   `apply_migration`, contenu exact, accord du propriétaire), régénérer les types si le schéma public change.
4. En cas d'erreur sur le dev : on corrige par une **nouvelle** migration (comme en production). Si le dev est trop
   abîmé : le propriétaire supprime `bledeal-dev` (**Project Settings › General › Delete project**) et le recrée
   (A2, gratuit), puis A3 à A7 et B2-B3 sont refaits (nouvelle adresse, nouvelle clé). **Jamais** de remise à zéro de la production.
5. Un seul agent à la fois sur chaque base ; ne jamais lancer sur le dev ce qui n'a pas sa place en production
   (pas de modification du schéma « à la main » dans l'éditeur SQL).

### D2. Documents
Une fois A à C faits : `docs/ETAT.md` (« Infrastructure » : deux projets Supabase, adresses, qui sert à quoi) et la
règle 6 de `docs/guide-mise-en-ligne.md` (« Une seule base pour tout » ne vaut plus : la Preview utilise `bledeal-dev`,
les secrets diffèrent entre Production et Preview).

## Récapitulatif : ce que le propriétaire crée ou clique

| Où | Quoi | Coût |
| --- | --- | --- |
| Supabase | organisation « BleDeal dev » (Free) + projet `bledeal-dev` (A1-A2) ; URL Configuration (A6) ; 2 requêtes SQL (A7, B3) ; reconnecter le connecteur (A4) | 0 |
| Vercel | domaine `test.bledeal.com` sur la branche `test` (B1) ; variables Preview (B2) ; 2 redéploiements (B4) | 0 (compris dans le plan) |
| Gestionnaire de mots de passe | mot de passe de la base de dev, 3 secrets de Preview | 0 |
| PC | `.env.local` sur le dev (C1) | 0 |
| Anthropic (facultatif) | une 2e clé avec plafond bas, seulement si l'IA doit marcher sur le dev | selon l'usage |

# Tests de parcours (Playwright)

Carte Trello « Tests · Parcours automatiques + agents IA par personnage ». Un vrai navigateur (Chromium) joue les
parcours d'un client, d'une boutique et de l'admin sur un écran de téléphone (375 px), contre un site et une base
**locaux**. Rien ne touche la production.

## Ce qui est testé

| Fichier | Parcours (carte, §1) |
| --- | --- |
| `e2e/client.spec.ts` | `/villes` → Oran → recherche dans le catalogue → fiche → taille → panier → connexion par lien e-mail → « Commander » → suivi (« Demandée », « Confirmée (à venir) ») → « Mes commandes » ; bouton « العربية » : page en arabe, de droite à gauche (`dir="rtl"`), puis retour au français |
| `e2e/commande-arabe.spec.ts` | site passé en arabe (`dir="rtl"`, `lang="ar"` vérifiés à chaque écran) → fiche (« 3 500 دج », « مقاس M », « زيد للسلة ») → « السلة ديالي » → connexion par lien e-mail en arabe → conditions acceptées en arabe (case « نقبل شروط الاستعمال… », « نقبل ونطلب », US-34.2) → suivi « الطلب تبعث » (la commande garde `langue = ar`) → la boutique (en français) confirme puis « Prête » → « طلبك راهو واجد », QR code « QR تاع الاستلام » et code à 6 chiffres « رقم الاستلام » → la boutique ouvre le lien du QR code et remet → « تدّا » dans « تتبّع الطلب » (`mode_remise = qr`) |
| `e2e/boutique.spec.ts` | connexion du commerçant → « Commandes reçues » (« À confirmer 1 ») → « Confirmer » → « Prête » → le client voit son QR code et son code à 6 chiffres → la boutique tape le code dans le scanner → « Remis au client » → le client voit « Récupérée » ; même chose par le QR code (adresse `/espace/retrait/<jeton>`) → commande dans « Terminées » |
| `e2e/remise-sans-qr.spec.ts` | « Remis sans QR code » derrière sa confirmation (« Le client n’a ni QR code ni code ? … », « Confirmer la remise » / « Retour »), **sans bon ni parrainage appliqué** : 1) première commande de 2 500 DA d'un filleul qui a enregistré un parrain → commande « Récupérée » (`mode_remise = manuel`), parrainage `non_valide` (motif `remise_sans_qr_code`), aucun bon chez le filleul ni chez le parrain ; 2) commande avec un bon de 300 DA réservé → la boutique est prévenue « Sans QR code, le bon ne s’applique pas : encaissez 2 500 DA », le bon revient « Disponible » au client, aucune ligne de relevé |
| `e2e/avis.spec.ts` | US-32.2 : commande d'« Amine Benali » → pas de « Donner mon avis » avant le retrait → la boutique confirme, « Prête », remet par le lien du QR code → « Mes commandes » : « Donner mon avis » → « Votre avis sur … » → sans étoile : « Choisissez une note de 1 à 5 étoiles. » → 4 étoiles, « Bon accueil », « Article conforme », commentaire avec un numéro : message du filtre, rien d'enregistré → commentaire corrigé (« 49/300 ») : « Merci, votre avis est publié. » (avis `publie`, critères, auteur public « Amine B. ») → « Avis donné · ★ 4 » sur le suivi et la liste, plus de bouton ni de formulaire → vitrine : « Pas encore assez d’avis », le commentaire « Amine B. » déjà visible (US-32.3). 2e test (avis posés dans la base locale) : vitrine « ★ 4,3 · 3 avis », « Bon accueil · 2 », « Rapide · 1 », « Sara K. », mois ; fiche « … · ★ 4,3 (3 avis) » vers `#avis` ; catalogue « Trier » → « Mieux notées » : la boutique notée passe devant la boutique sans avis ; en arabe « ★ 4,3 · 3 راي » et « مازال ما كاينش بزاف تاع الآراء ». 3e test (US-32.4) : lien « Avis (1) » de la navigation de l'espace, bloc « Avis clients : 1 avis · 1 sans réponse » de l'espace → `/espace/avis` → réponse avec un lien refusée → « Désolés pour l’attente, merci Sara. » publiée, plus de formulaire, le lien redevient « Avis » → vitrine : réponse affichée, « Signaler » → motif → « pas disponible » (pas de `VISITEURS_SECRET` en local) → 2 signalements posés dans la base → admin, onglet « Avis » : « 2 signalements : Informations personnelles », « Masquer la réponse » → réponse plus visible → nouveau signalement « Faux avis » → « Masquer l’avis » → avis absent de la vitrine et de l'espace, 3 décisions, historique « Avis de Sara K. · … ». 4e test : 3 avis posés dans la même minute → admin, onglet « Avis » : bloc « Signaux (jamais automatiques) » « … : 3 avis dans la même minute », aucun bouton, aucun avis masqué. 5e test : admin, onglet « Mots interdits » : liste de départ (« zebi »), « Arnaqué… » ajouté → « « arnaque… » ajouté à la liste. » (normalisé), le filtre des avis le refuse aussitôt ; « deux mots » → « Un seul mot, sans espace. » ; « Retirer » → plus dans la liste ni filtré |
| `e2e/parrainage.spec.ts` | le parrain lit son code sur `/parrainage` → le filleul le saisit dans `/compte` → première commande de 2 500 DA remise par QR code → **un bon de 300 DA visible** dans « Mes bons » du filleul et du parrain → deuxième commande avec le bon (« 2 200 DA » au panier, au suivi et sur l'écran de la boutique) → remise par QR code → l'admin marque le relevé de la boutique « payé » (`/admin/remboursements`) |
| `e2e/bon-bienvenue.spec.ts` | US-33.2 : programme « Bienvenue » activé dans la base locale (remis inactif à la fin) → client au numéro vérifié → « Mes bons » : « Bon de bienvenue · 300 DA dès 2 000 DA d’achat » → panier de 1 500 DA : pas de case, « Dès 2 000 DA d’achat » → panier de 2 500 DA : « Utiliser mon bon de bienvenue (−300 DA) », 2 200 DA à payer → confirmée, prête, remise par QR code → bon « Utilisé », ligne du relevé avec l'origine « bienvenue » |
| `e2e/bon-avis.spec.ts` | US-32.5 : programme « avis » à 0 : pas de mention sur la vitrine → `prive.regler_bon_avis` (base locale) : « Les clients reçoivent un petit bon pour chaque avis, quelle que soit leur note. » → commande remise par QR code → avis 2 étoiles : « Merci, votre avis est publié. » + « Votre bon de 150 DA est dans votre compte. » (bon « avis » de 150 DA dès 1 500 DA en base) → « Mes bons » : « Bon Avis », « 150 DA dès 1 500 DA d’achat · jusqu’au … » → panier de 2 000 DA : « Utiliser mon bon Avis (−150 DA) » → vitrine en arabe : mention n° 11 ; programme remis à 0 à la fin ; `/admin/bons` : programme « avis » « reste … ce mois-ci » (un bon du mois dernier n'est pas compté) |
| `e2e/bon-campagne.spec.ts` | US-33.3 : campagne posée dans la base locale (univers Femme, Oran, 500 DA dès 4 000 DA ; désactivée à la fin) → bandeau sur `/oran` → « Conditions » : page de la campagne → `/compte` « J’ai un code » : code faux « Ce code n’existe pas ou n’est plus valable. », puis le bon code : bon ajouté → panier de 2 500 DA : « Dès 4 000 DA d’achat » → une pièce de plus (5 000 DA) : bon utilisé, 4 500 DA à payer → bon « réservé » dans la base → US-33.4 : la boutique voit « Bon Aïd test −500 DA » dans ses commandes, confirme, « Prête » → suivi du client et page du proche : « Bon Aïd test » → scan : « Bon Aïd test BleDeal », « Remis au client » → `/espace` « Bons à rembourser » : « Aïd test · 1 bon · 500 DA », « Plafond Aïd test : 1 / 30 bons dans votre boutique. » |
| `e2e/admin.spec.ts` | valider une boutique en attente et y rattacher le compte du commerçant (qui entre ensuite dans son espace) ; traiter un signalement (« Masquer l'article » : un visiteur ne voit plus la fiche) ; ouvrir puis refermer une ville (Mostaganem apparaît puis disparaît de `/villes`) ; US-33.5 : `/admin/bons` « Nouvelle campagne » (500 DA et 30 bons pré-remplis, code saisi en minuscules) → « Campagne … créée (code …) », programme « Active », « 0 émis » → le client ajoute le code dans `/compte` → « 1 émis » → « Arrêter » avec confirmation → « Arrêtée », programme inactif dans la base |
| `e2e/mes-donnees.spec.ts` | US-34.4 : client avec deux accords et une boutique suivie → `/compte` → « Mes données » : numéro vérifié avec la date, nom, accords (version, date), boutique suivie depuis ; jamais la boutique ni le nom d'un autre client ; pas de « Fermer mon compte » ; en arabe « المعلومات نتاعي » ; admin → « Acceptations » : nombre par version, recherche par numéro (0…) → accords du compte « à l’inscription » ; sans connexion → page de connexion |
| `e2e/numeros-rtl.spec.ts` | Page en arabe : numéro vérifié de `/compte`, numéro de « Mes données » (au début de la ligne, à droite), numéro du client dans « Commandes reçues » de l'espace (en arabe, US-35) : isolés de gauche à droite, premier caractère (« + » ou « 0 ») à gauche du dernier à l'écran |
| `e2e/prix-rtl.spec.ts` | Pages en arabe : suivi de commande avec bon (« دج » à gauche du nombre, « −500 ») ; retrait dans l'espace d'abord en français (« DA » à droite), puis en arabe (US-35 : sous-total, bon, « تقبض كاش » ; commandes reçues : « المجموع ») : chaque caractère du prix dans l'ordre à l'écran |
| `e2e/revue-rtl.spec.ts` | Site en arabe : espace commerçant en arabe (US-35 : navigation et pied de page en arabe, de droite à gauche) ; administration en ltr (navigation et pied de page en français, de gauche à droite) ; côté client, pied de page en arabe ; suivi d'une commande prête : adresse de la boutique dans l'ordre, sur sa propre ligne |
| `e2e/espace-arabe.spec.ts` | US-35 : le commerçant choisit « العربية » dans la navigation de l'espace → espace en arabe, de droite à gauche (navigation, titres, prix en « دج », pied de page) → confirme (« أكّد »), liste de préparation, « واجدة » → retrait par le lien du QR code (« تقبض كاش », « تسلّم للزبون » → « الطلب تسلّم ») → modification et ajout d'article, statistiques, avis, scanner en arabe → retour au français depuis l'espace. Échoue sur l'ancien code (pas de choix de langue dans l'espace, espace forcé en français). 2e test (BOLOSS, 10/10) : boutique en attente, espace en arabe, lien Google Maps collé → dans le message arabe, la latitude reste à gauche de la longitude et le « − » devant son nombre (mesuré à l'écran) ; échoue sur l'ancien code (coordonnées non isolées dans la phrase arabe) |

Les tests ne réécrivent aucune règle (blocage, no-show, numéro, statuts, stock) : ils passent par les écrans et la base
applique ses propres règles.

**Écarts assumés** (et pourquoi) :
- **Caméra** : un QR code ne se « montre » pas facilement à un navigateur de test. Le QR code contient le lien
  `/espace/retrait/<jeton>` ; le test ouvre directement cette adresse, comme le ferait le scanner après lecture.
  Le scanner lui-même reste à tester sur de vrais téléphones (Android, iPhone).
- **Signalement** : le formulaire public demande Turnstile et le secret des visiteurs, vides dans les tests. Le
  signalement est posé dans la base locale, comme s'il venait d'un visiteur ; l'admin le traite ensuite à l'écran.
- **Clôture du mois** : la tâche planifiée du 1er du mois passe les relevés « à payer » ; le test le fait en SQL
  (base locale seulement) avant que l'admin marque le relevé payé.
- **WhatsApp** : aucune variable `WHATSAPP_*` dans les tests : les messages restent « en attente » dans la base locale
  (c'est le « faux envoi WhatsApp » de la carte, §3). Rien ne part.
- **Arabe** : la commande complète se fait en arabe côté client (`commande-arabe.spec.ts`) ; l'espace commerçant
  reste en français (décision 4 de US-26), la boutique joue donc son rôle en français.
- **Bon déjà reçu** (`remise-sans-qr.spec.ts`, 2e test) : le bon de 300 DA est posé dans la base locale, comme après
  un parrainage validé (le parcours complet qui le fait gagner est déjà dans `parrainage.spec.ts`).

## Données de test

Chaque test crée ses propres données dans la base locale (`e2e/outils/donnees.ts`) : boutique, articles, comptes
« client A », « client B », « boutique T », « admin » (carte, §3), avec des noms, e-mails et numéros **uniques**.
On peut donc relancer les tests sans vider la base. Les comptes sont confirmés d'avance ; la connexion passe par le
**vrai lien e-mail**, lu dans la boîte de test locale (Mailpit / Inbucket, fournie par Supabase en local).

Réglages posés par les tests dans la base **locale** seulement : parrainage ouvert, budget du mois très haut (les
tests relancés ne doivent pas l'épuiser).

## Lancer les tests (sur le PC)

À faire une fois :
1. Installer **Docker Desktop** (gratuit pour un usage personnel ou une petite entreprise) et le lancer.
2. Dans le dossier du projet : `npm install`, puis `npx playwright install chromium`.

À chaque fois :
1. `npx supabase start` (dans le dossier du projet). La première fois, il télécharge les images (quelques minutes).
   Il lit `supabase/config.toml` et applique **toutes les migrations** de `supabase/migrations/` à une base vide.
2. `npm run test:e2e`. Le script `e2e/lancer.mjs` lit les adresses et les clés **locales** (`supabase status`),
   refuse toute adresse qui n'est pas `127.0.0.1` / `localhost`, construit le site dans `.next-e2e` (le site normal
   `.next` n'est pas touché) et le lance sur **http://127.0.0.1:3100**, puis joue les parcours.
3. Voir le navigateur pendant les tests : `npm run test:e2e:voir`. Rapport (captures et traces des échecs) :
   `npm run test:e2e:rapport`.
4. Fini : `npx supabase stop`. Pour repartir d'une base vide : `npx supabase db reset` (base locale seulement).

Un seul fichier : `npm run test:e2e -- e2e/boutique.spec.ts`.

Le port du site des tests (3100, ou `E2E_PORT`) doit être **libre** : Playwright construit et lance le site de ce
commit, et s'arrête tout de suite avec une erreur si un autre site occupe déjà le port. Avant, il réutilisait en
silence ce site, construit depuis un autre commit ou un autre dossier : les écrans récents manquaient et un test
s'arrêtait sur « Test timeout » (échec ponctuel de `e2e/avis.spec.ts`, 10/10). Le processus Next.js s'appelle
`next-server`, pas `next start` : arrêtez-le par son numéro (`ss -ltnp "sport = :3100"`), seulement si c'est le
vôtre. Réutiliser exprès un site déjà lancé **depuis ce commit** : `E2E_REUTILISER=1 npm run test:e2e`.

`.env.local` n'est pas utilisé par les tests : `playwright.config.ts` donne au site les clés locales et vide les
secrets (Turnstile, WhatsApp, IA, carte, visiteurs, codes). Même si `.env.local` contient des clés de production,
le site de test ne les lit pas.

Garde-fous « jamais la production » : `e2e/lancer.mjs`, `playwright.config.ts` et `e2e/outils/env.ts` refusent une
adresse Supabase ou une base qui n'est pas locale.

## Sur chaque PR (facultatif, à activer par le propriétaire)

La carte demande qu'une PR qui casse un parcours ne puisse pas être fusionnée. Proposition (non activée : elle
consomme des minutes GitHub Actions, comprises dans l'offre gratuite d'un dépôt privé, environ 2 000 minutes par
mois ; un passage complet prend environ 6 à 8 minutes) :

1. Ajouter le fichier `.github/workflows/parcours.yml` ci-dessous (une PR suffit).
2. Sur GitHub : **Settings → Branches → Add branch ruleset** (ou « Branch protection rule ») pour `main` →
   cocher « Require status checks to pass » → choisir **parcours**.

```yaml
name: parcours
on:
  pull_request:
    branches: [main]
jobs:
  parcours:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx --yes supabase@2.120.0 start
      - run: npm run test:e2e
        env: { CI: "1" }
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: rapport-playwright, path: playwright-report, retention-days: 7 }
```

Aucun secret n'est nécessaire : tout tourne dans la machine de GitHub, avec les clés de démonstration de Supabase en
local. Les tests ne visent **pas** l'adresse de prévisualisation Vercel : elle utilise la base de dev (voir
`docs/environnements.md`) et les tests y laisseraient des données ; la base locale est vide à chaque passage.

## Agents IA par personnage (carte, §2) : proposition légère

Les tests ci-dessus sont fixes et gratuits ; ils ne font **aucun appel payant** à une IA. Les agents par personnage
sont un **complément manuel**, lancé par le propriétaire quand il le souhaite (avant une mise en ligne, après une
grosse série de PR), jamais dans `npm run test:e2e` ni dans la CI :

- **Où** : sur le site local (`npm run dev` avec `npx supabase start`) ou sur une prévisualisation Vercel branchée
  sur **bledeal-dev** (jamais la production).
- **Avec quoi** : l'abonnement Claude du propriétaire (Claude dans Chrome, ou Claude Code avec un navigateur), sans
  clé d'API dans le dépôt ni dans Vercel.
- **Comment** : le propriétaire colle la fiche du personnage ci-dessous ; l'agent joue le rôle en 375 px, note ce qu'il
  voit et rend un **rapport classé** : 🔴 bloquant (impossible d'aller au bout), 🟠 gênant (il y arrive mais se trompe
  ou hésite), 🟡 confort (texte, lisibilité), 🔒 sécurité (un contournement marche). Chaque point : page, geste,
  attendu, obtenu, capture.
- **Ensuite** : un point reproductible devient un test Playwright (dans `e2e/`) ou une carte Trello.

Fiches (à coller telles quelles, avec l'adresse du site et les comptes de test) :

1. **Maman pressée, en arabe** : « Tu es une maman d'Oran, sur ton téléphone, en arabe. Tu as 10 minutes pour trouver
   un cadeau de l'Aïd pour ton fils de 8 ans, moins de 4 000 DA, et le réserver. Passe le site en arabe, cherche,
   choisis une taille, commande. Note tout ce qui te ralentit ou que tu ne comprends pas. »
2. **Commerçant mal à l'aise avec le numérique** : « Tu tiens une boutique de vêtements. Tu te connectes à ton espace
   pour la première fois et tu ajoutes tes 3 premiers articles avec photo, prix et tailles. Tu lis peu, tu appuies
   sur ce qui est gros. Ensuite tu confirmes une commande et tu la remets au client avec son code. »
3. **Client distrait** : « Tu commandes, tu oublies, tu reviens le lendemain : retrouve ta commande, ton QR code ;
   essaie d'annuler une commande déjà prête ; ajoute au panier un article d'une autre boutique. »
4. **Petit malin** : « Tu cherches à tricher : te parrainer toi-même (ton numéro, ton code), changer de parrain après
   ta commande, utiliser deux fois le même bon, un bon sous 1 000 DA, récupérer un bon en annulant, deviner le code à
   6 chiffres d'une autre commande, réutiliser un lien de retrait déjà servi, ouvrir l'espace d'une autre boutique
   ou une page admin. Pour chaque essai : ce que tu as tenté, ce que le site a répondu. »
5. **Admin** : « Valide une boutique en attente, rattache son commerçant, traite les signalements, ouvre une ville,
   lis les relevés de bons du mois et marque-en un payé. Note ce qui manque pour décider vite. »

Si un jour ces agents doivent tourner tout seuls (par exemple chaque nuit), il faudra une clé d'API avec un plafond de
dépenses : c'est une décision du propriétaire, pas prévue ici.

## Ce que les tests ne remplacent pas (carte, §4)

Les tests en vrai avec des commerçants et des clients d'Oran, sur leurs téléphones (réseau lent, luminosité,
scanner, WhatsApp réel).

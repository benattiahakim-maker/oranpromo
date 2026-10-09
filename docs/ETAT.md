# État du projet OranPromo

> À lire en premier pour reprendre le travail. Mis à jour le 9 octobre 2026.
> Tableau des tâches : https://trello.com/b/w1W1Amkb/oranpromo

## Où on en est

- Les **19 user stories du MVP sont codées** (US-01 à US-19) et relues. Elles sont dans la colonne Trello « À vérifier » : codées, mais pas encore toutes testées en vrai.
- 444 tests passent, `npm run lint` et `npm run build` passent.
- Dernier commit : `c0e12ba Formulaire article : couleurs, tailles par catégorie, photos, erreurs, brouillon`.
- Déjà testé en vrai :
  - la page d'accueil ;
  - la fiche article ;
  - la réservation WhatsApp.
- Pas encore re-testé : la connexion par lien e-mail (corrigée le 9/10) et le nouveau formulaire d'article.

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

1. **Test** : tester tout le parcours en vrai sur le PC (checklist dans la carte).
2. **Tech** : miniatures et photos redimensionnées à 1200 px, pour réduire le trafic et respecter la limite Vercel de 4,5 Mo.
3. **Design** : barre de défilement grise sous la galerie photo.
4. **IA** : le propriétaire crée la clé API Claude et la colle dans `.env.local` (US-19).

Backlog : mise en ligne (Vercel, domaine, envoi d'e-mails), limitation des envois en masse, suppression des données de test, SMS (V2), idées de vidéos marketing.

## Documents de référence

- `CLAUDE.md` : règles pour les agents.
- `docs/user-stories.md` : stories et critères d'acceptation.
- `docs/architecture.md` : tables, règles métier, organisation du code.
- `docs/maquettes/` : maquettes des écrans.

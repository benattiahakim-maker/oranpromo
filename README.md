# OranPromo

Le click & collect des boutiques de vêtements d'Oran : les promos des boutiques en ligne, la réservation par WhatsApp, l'essai et le paiement en boutique.

- **Site** : Next.js 16 (TypeScript, Tailwind)
- **Base, connexion, photos** : Supabase (projet `oranpromo`, région Paris)
- **IA** : API Claude, côté serveur

## Installer sur un nouvel ordinateur

1. Installer [Node.js](https://nodejs.org) (version LTS).
2. Dans le dossier du projet :
   ```
   npm.cmd install
   ```
3. Copier `.env.example` en `.env.local` et remplir les valeurs Supabase (Project Settings › API). La clé Claude est facultative : sans clé, les formulaires restent utilisables à la main. Ne jamais commiter `.env.local`.
4. Lancer le site :
   ```
   npm.cmd run dev
   ```
   puis ouvrir http://localhost:3000

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm.cmd run dev` | site en local |
| `npm.cmd test` | tests automatiques |
| `npm.cmd run build` | vérifie que le site compile |
| `npm.cmd run lint` | vérifie le style du code |
| `npm.cmd run db:types` | régénère `lib/supabase/types.ts` après une migration |

Pour lancer la version de production en local : `npm.cmd run build`, puis `npm.cmd start`.

## Pages du site

| Page | Adresse | Accès |
| --- | --- | --- |
| Promos du moment | `/` | Public |
| Recherche et catalogue | `/catalogue` | Public |
| Fiche article | `/a/<id>` | Public, selon la visibilité de l’article |
| Vitrine boutique | `/b/<slug>` | Public, boutique validée |
| Connexion par lien e-mail | `/espace/connexion` | Public |
| Mes articles | `/espace` | Compte connecté, articles de sa boutique |
| Ajouter un article | `/espace/articles/nouveau` | Compte rattaché à une boutique |
| Modifier un article et sa promo | `/espace/articles/<id>` | Boutique propriétaire |
| Statistiques | `/espace/statistiques` | Boutique propriétaire |
| Tableau de bord | `/admin` | Administrateur |
| Gestion des boutiques | `/admin/boutiques` | Administrateur ou ambassadeur |
| Modération | `/admin/moderation` | Administrateur |

Les pages publiques partagent le logo et le lien Rechercher. Les espaces commerçant et administrateur disposent de leur menu. Les adresses inconnues affichent « Page introuvable » ; une erreur inattendue propose « Réessayer ».

L’IA utilise les routes serveur `POST /api/ia/fiche` et `POST /api/ia/traduire`. `ANTHROPIC_MODELE` choisit le modèle ; la clé reste côté serveur. Les tests simulent les réponses et n’appellent pas Claude.

## Faire travailler un agent

Donne-lui **une seule story** à la fois, par exemple :

> Réalise la story US-07 décrite dans docs/user-stories.md, en suivant CLAUDE.md.

Les règles des agents sont dans `CLAUDE.md` (Claude Code) et `.clinerules` (Cline). La documentation est dans `docs/`.

## Avant la mise en ligne

- Configurer les liens de connexion par e-mail et leur URL de retour `/auth/callback` dans Supabase. Prévoir un fournisseur SMTP pour dépasser les limites d’envoi du service intégré.
- Créer le compte administrateur : se connecter une fois, puis passer son profil en `admin` dans Supabase (Table Editor › profils).

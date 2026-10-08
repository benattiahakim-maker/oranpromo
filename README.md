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
3. Copier `.env.example` en `.env.local` et remplir les valeurs (Supabase : Project Settings › API ; Claude : console.anthropic.com). Ne jamais commiter `.env.local`.
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

## Faire travailler un agent

Donne-lui **une seule story** à la fois, par exemple :

> Réalise la story US-07 décrite dans docs/user-stories.md, en suivant CLAUDE.md.

Les règles des agents sont dans `CLAUDE.md` (Claude Code) et `.clinerules` (Cline). La documentation est dans `docs/`.

## Avant la mise en ligne

- Configurer la connexion par SMS dans Supabase (Authentication › Sign In / Providers › Phone) avec un fournisseur SMS qui couvre l'Algérie.
- Créer le compte administrateur : se connecter une fois, puis passer son profil en `admin` dans Supabase (Table Editor › profils).

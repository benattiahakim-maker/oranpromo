// Données des tests de parcours, créées par les tests eux-mêmes dans la base LOCALE (jamais la production) :
// comptes par l'API d'administration de l'authentification locale, le reste en SQL (comme le tableau de bord).
// Chaque test prend des noms, e-mails et numéros uniques : on peut relancer sans vider la base.
import { randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { E2E } from "./env";

let pool: Pool | null = null;
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(requete: string, valeurs: unknown[] = []): Promise<T[]> {
  pool ??= new Pool({ connectionString: E2E.baseDeDonnees, max: 2 });
  return (await pool.query(requete, valeurs)).rows as T[];
}
export async function fermerBase() { await pool?.end(); pool = null; }

/** Suffixe unique pour ce test (e-mails, noms, slugs). */
export function unique(): string { return `${Date.now().toString(36)}${randomInt(1000, 9999)}`; }
/** Mobile algérien au hasard, au format de la base (+2135…, +2136…, +2137…). */
export function telephone(): string { return `+213${randomInt(5, 8)}${String(randomInt(0, 1e8)).padStart(8, "0")}`; }

export type Role = "client" | "commercant" | "admin";
export type Compte = { id: string; email: string; nom: string; telephone: string };

/** Compte confirmé (connexion ensuite par le vrai lien e-mail, lu dans Mailpit). Numéro vérifié par défaut. */
export async function creerCompte(options: { role?: Role; nom?: string; boutique?: string; verifie?: boolean; prefixe?: string } = {}): Promise<Compte> {
  const email = `${options.prefixe ?? options.role ?? "client"}-${unique()}@bledeal.test`;
  // API d'administration de l'authentification locale (clé de service locale, jamais celle de la production).
  const reponse = await fetch(`${E2E.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: E2E.cleService, authorization: `Bearer ${E2E.cleService}`, "content-type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const data = { user: await reponse.json() as { id?: string; msg?: string } };
  if (!reponse.ok || !data.user.id) throw new Error(`Compte de test impossible : ${data.user.msg ?? reponse.status}`);
  const nom = options.nom ?? "Amine";
  const tel = telephone();
  await sql(`update profils set role = $2, boutique_id = $3, nom = $4, telephone = $5,
               telephone_verifie_le = case when $6 then now() end where id = $1`,
    [data.user.id, options.role ?? "client", options.boutique ?? null, nom, tel, options.verifie ?? true]);
  return { id: data.user.id, email, nom, telephone: tel };
}

export type Boutique = { id: string; nom: string; slug: string };
export async function creerBoutique(options: { nom?: string; statut?: "validee" | "en_attente"; ville?: string; latitude?: number; longitude?: number } = {}): Promise<Boutique> {
  const u = unique();
  const nom = options.nom ?? `Boutique Test ${u}`;
  const slug = `boutique-test-${u}`;
  const [b] = await sql<{ id: string }>(`insert into boutiques (nom, slug, quartier, adresse, whatsapp, statut, ville, latitude, longitude)
    values ($1, $2, 'Gambetta', '12 rue de Mostaganem', $3, $4, $5, $6, $7) returning id`,
  [nom, slug, telephone(), options.statut ?? "validee", options.ville ?? "oran", options.latitude ?? 35.70, options.longitude ?? -0.63]);
  return { id: b.id, nom, slug };
}

export type Article = { id: string; titre: string; prix: number };
export async function creerArticle(boutique: string, options: { titre?: string; prix?: number; categorie?: string; genre?: string; tailles?: Record<string, number> } = {}): Promise<Article> {
  const titre = options.titre ?? `Polo bleu ${unique()}`;
  const prix = options.prix ?? 3500;
  const [a] = await sql<{ id: string }>(`insert into articles (boutique_id, titre, categorie, genre, prix, description)
    values ($1, $2, $3, $4, $5, 'Coton, coupe droite.') returning id`,
  [boutique, titre, options.categorie ?? "T-shirts et polos", options.genre ?? "homme", prix]);
  for (const [libelle, quantite] of Object.entries(options.tailles ?? { M: 5, L: 5 })) {
    await sql("insert into tailles (article_id, libelle, disponible, quantite) values ($1, $2, true, $3)", [a.id, libelle, quantite]);
  }
  return { id: a.id, titre, prix };
}

/** Parrainage ouvert (réglage que le propriétaire pose en SQL en production, voir docs/ETAT.md). */
export async function ouvrirParrainage() {
  await sql("insert into prive.reglages (cle, valeur) values ('parrainage', 'on') on conflict (cle) do update set valeur = 'on'");
}

export { randomUUID };

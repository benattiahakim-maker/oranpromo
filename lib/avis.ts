// US-32 : avis clients sur les boutiques. Les règles (QR code, 14 jours, un avis par commande, filtre de contenu)
// sont dans la base (donner_avis, migration 20261019090000_avis.sql) ; ici : la même règle pour savoir s'il faut
// afficher le bouton, la vérification de la saisie avant l'envoi, et les messages.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";

export const CRITERES_AVIS = ["accueil", "article_conforme", "rapidite"] as const;
export type CritereAvis = (typeof CRITERES_AVIS)[number];
export const COMMENTAIRE_AVIS_MAX = 300;
export const DELAI_AVIS_JOURS = 14;

export const MESSAGES_AVIS = {
  publie: "Merci, votre avis est publié.",
  note: "Choisissez une note de 1 à 5 étoiles.",
  critere: "Critère inconnu.",
  commentaire: `Le commentaire doit contenir ${COMMENTAIRE_AVIS_MAX} caractères au plus.`,
  impossible: "Impossible de publier votre avis. Réessayez.",
  session: "Votre session a expiré. Reconnectez-vous.",
} as const;

type CommandeNotable = Pick<Tables<"commandes">, "statut" | "mode_remise" | "terminee_le">;

/** Même règle que donner_avis : commande récupérée par QR code, depuis 14 jours au plus (la base décide à l'envoi). */
export function avisPossible(commande: CommandeNotable, maintenant: number = Date.now()): boolean {
  if (commande.statut !== "recuperee" || commande.mode_remise !== "qr" || !commande.terminee_le) return false;
  const recuperee = Date.parse(commande.terminee_le);
  return Number.isFinite(recuperee) && maintenant - recuperee <= DELAI_AVIS_JOURS * 24 * 3600 * 1000;
}

export type SaisieAvis = { note: number; criteres: string[]; commentaire: string };

/** Saisie vérifiée (note entière 1 à 5, critères connus sans doublon rangés, commentaire ≤ 300 sans espaces autour). */
export function verifierSaisieAvis(saisie: unknown): { note: number; criteres: CritereAvis[]; commentaire: string | null } {
  const s = (saisie ?? {}) as Partial<SaisieAvis>;
  if (typeof s.note !== "number" || !Number.isInteger(s.note) || s.note < 1 || s.note > 5) throw new Error(MESSAGES_AVIS.note);
  const criteres = s.criteres ?? [];
  if (!Array.isArray(criteres) || criteres.some(c => !(CRITERES_AVIS as readonly unknown[]).includes(c)) || new Set(criteres).size !== criteres.length) {
    throw new Error(MESSAGES_AVIS.critere);
  }
  if (s.commentaire !== undefined && typeof s.commentaire !== "string") throw new Error(MESSAGES_AVIS.commentaire);
  const commentaire = (s.commentaire ?? "").trim();
  if (commentaire.length > COMMENTAIRE_AVIS_MAX) throw new Error(MESSAGES_AVIS.commentaire);
  return { note: s.note, criteres: CRITERES_AVIS.filter(c => criteres.includes(c)), commentaire: commentaire || null };
}

type ErreurBase = { code?: string; message?: string } | null | undefined;
// Erreurs levées volontairement par donner_avis (messages en français, traduits par lib/textes/messages.ts).
const CODES_AVIS = new Set(["42501", "P0002", "22023", "23505"]);
export function messageErreurAvis(error: ErreurBase, defaut: string = MESSAGES_AVIS.impossible): string {
  return error?.code && CODES_AVIS.has(error.code) && error.message ? error.message : defaut;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Publie l'avis du client connecté sur sa commande ; renvoie l'identifiant de l'avis. */
export async function donnerAvis(client: SupabaseClient<Database>, commande: string, saisie: unknown): Promise<string> {
  if (typeof commande !== "string" || !UUID.test(commande)) throw new Error("Commande introuvable.");
  const { note, criteres, commentaire } = verifierSaisieAvis(saisie);
  const { data, error } = await client.rpc("donner_avis", { commande, note, criteres, commentaire: commentaire ?? undefined });
  const id = (data as { avis?: unknown } | null)?.avis;
  if (error || typeof id !== "string") throw new Error(messageErreurAvis(error));
  return id;
}

/** Notes déjà données par le client connecté, par commande (la base ne lui montre que ses avis). */
export async function lireMesNotes(client: SupabaseClient<Database>, commandes: string[]): Promise<Map<string, number>> {
  const ids = commandes.filter(id => UUID.test(id));
  if (!ids.length) return new Map();
  const { data, error } = await client.from("avis").select("commande_id, note").in("commande_id", ids);
  if (error) throw new Error("Impossible de charger vos avis. Réessayez.");
  return new Map((data ?? []).map(a => [a.commande_id, a.note]));
}

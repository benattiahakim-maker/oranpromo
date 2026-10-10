// US-31.4 : signaux des inscriptions en boutique pour /admin/remboursements (jamais bloquants : l'admin regarde,
// puis décide avec « Mettre de côté » / « Refuser » sur les lignes de relevé, comme pour les autres bons).
// Les nombres viennent de la base (signaux_inscriptions(), admin seulement) ; ici : seuils et phrases.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export type InscriptionsBoutique = {
  boutique_id: string; boutique: string; slug: string; inscrits: number;
  /** Inscrits depuis plus de 7 jours sans aucune commande. */
  sans_commande: number;
  /** Inscrits qui ont récupéré des commandes seulement dans la boutique qui les a inscrits. */
  jamais_ailleurs: number;
  /** Commandes avec un bon d'inscription récupérées moins de 30 minutes après leur création. */
  remises_rapides: number;
  /** Inscriptions faites dans une minute où la boutique en a eu au moins 3. */
  meme_minute: number;
};

/** Seuils d'affichage (90 derniers jours). */
export const SEUIL_SANS_COMMANDE = 5;
export const SEUIL_JAMAIS_AILLEURS = 3;

export async function lireSignauxInscriptions(client: SupabaseClient<Database>): Promise<InscriptionsBoutique[]> {
  const { data, error } = await client.rpc("signaux_inscriptions");
  if (error) throw new Error("Impossible de charger les signaux des inscriptions.");
  return (Array.isArray(data) ? data : []) as unknown as InscriptionsBoutique[];
}

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/** Phrases des signaux d'une boutique (vide : rien à signaler). */
export function signauxInscriptions(b: InscriptionsBoutique): string[] {
  const s: string[] = [];
  if (b.sans_commande >= SEUIL_SANS_COMMANDE && b.sans_commande * 2 >= b.inscrits)
    s.push(`${b.sans_commande} inscrit${pluriel(b.sans_commande, "", "s")} sans aucune commande après 7 jours`);
  if (b.jamais_ailleurs >= SEUIL_JAMAIS_AILLEURS)
    s.push(`${b.jamais_ailleurs} inscrit${pluriel(b.jamais_ailleurs, " n’achète", "s n’achètent")} que dans cette boutique`);
  if (b.remises_rapides > 0)
    s.push(`${b.remises_rapides} commande${pluriel(b.remises_rapides, "", "s")} avec bon d’inscription remise${pluriel(b.remises_rapides, "", "s")} moins de 30 min après la commande`);
  if (b.meme_minute > 0)
    s.push(`${b.meme_minute} inscription${pluriel(b.meme_minute, "", "s")} groupée${pluriel(b.meme_minute, "", "s")} (3 ou plus dans la même minute)`);
  return s;
}

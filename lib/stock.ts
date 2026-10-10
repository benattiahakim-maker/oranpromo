import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "./supabase/types";

// US-20.1 : stock indicatif par taille (tailles.quantite). La base calcule « disponible » (quantite > 0)
// et passe l’article « Vendu » quand toutes ses tailles tombent à 0 (migration 20261009180000_stock_par_taille.sql).
export const QUANTITE_STOCK_MAX = 999;

export type TailleStock = { id: string; libelle: string; quantite: number };

export function quantiteValide(quantite: number): boolean {
  return Number.isInteger(quantite) && quantite >= 0 && quantite <= QUANTITE_STOCK_MAX;
}

/** Nouvelle quantité après un appui sur « − » (-1) ou « + » (+1), bornée à 0 … QUANTITE_STOCK_MAX. */
export function ajusterQuantite(quantite: number, ecart: number): number {
  return Math.min(QUANTITE_STOCK_MAX, Math.max(0, Math.trunc(quantite) + Math.trunc(ecart)));
}

export function stockTotal(tailles: { quantite: number }[]): number {
  return tailles.reduce((total, taille) => total + Math.max(0, taille.quantite), 0);
}

export function tailleEpuisee(taille: { quantite: number }): boolean {
  return taille.quantite <= 0;
}

/** Texte court pour la liste du commerçant : « 3 pièces », « 1 pièce », « Épuisé ». */
export function libelleStock(quantite: number, t: { epuise: string; piece: string; pieces: string } = { epuise: "Épuisé", piece: "1 pièce", pieces: "{n} pièces" }): string {
  if (quantite <= 0) return t.epuise;
  return quantite === 1 ? t.piece : t.pieces.replace("{n}", String(quantite));
}

/** Enregistre la quantité d’une taille ; renvoie la quantité gardée par la base et le statut de l’article. */
export async function modifierStock(client: SupabaseClient<Database>, articleId: string, tailleId: string, quantite: number): Promise<{ quantite: number; statut: Enums<"statut_article"> }> {
  if (!quantiteValide(quantite)) throw new Error(`La quantité doit être un nombre entier entre 0 et ${QUANTITE_STOCK_MAX}.`);
  const { data, error } = await client.from("tailles").update({ quantite }).eq("id", tailleId).eq("article_id", articleId).select("quantite").maybeSingle();
  if (error || !data) throw new Error("Impossible d’enregistrer le stock. Réessayez.");
  // Le statut peut changer (Vendu à 0, Disponible au retour du stock) : relire celui que la base a gardé.
  const { data: article, error: erreurArticle } = await client.from("articles").select("statut").eq("id", articleId).maybeSingle();
  if (erreurArticle || !article) throw new Error("Le stock est enregistré, mais le statut de l’article n’a pas pu être relu. Rechargez la page.");
  return { quantite: data.quantite, statut: article.statut };
}

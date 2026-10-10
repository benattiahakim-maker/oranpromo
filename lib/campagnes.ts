// US-33.3 : bons de campagne avec code (Aïd, rentrée…). Règles dans la base (migration 20261018110000_campagnes.sql) :
// code, dates, budget, une fois par numéro vérifié, 5 codes faux par heure ; raisons au panier sur les prix réels.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { RESULTATS_BON, type ResultatBon } from "./bons";

export type UniversBon = "femme" | "homme" | "enfant" | "beaute";
/** Campagne ouverte telle que la renvoie campagnes_ouvertes() : seulement ce qui est affiché. */
export type CampagneOuverte = {
  nom_fr: string; nom_ar: string; code: string; montant: number; minimum_achat: number;
  univers: UniversBon | null; villes: string[]; debut: string; fin: string | null;
};

export async function lireCampagnesOuvertes(client: SupabaseClient<Database>, ville?: string | null): Promise<CampagneOuverte[]> {
  const { data, error } = await client.rpc("campagnes_ouvertes", ville ? { ville } : {});
  if (error) throw new Error("Impossible de charger les campagnes.");
  return Array.isArray(data) ? (data as unknown as CampagneOuverte[]) : [];
}

/** Code tapé par le client : « ajoute » (avec le bon), « inconnu », « deja », « trop », « numero ». */
export type EtatCode = "ajoute" | "inconnu" | "deja" | "trop" | "numero";
export type ReponseCode = { etat: EtatCode; nom_fr?: string; nom_ar?: string; montant?: number; minimum_achat?: number };
const ETATS_CODE: EtatCode[] = ["ajoute", "inconnu", "deja", "trop", "numero"];

/** Code saisi propre (majuscules, sans espaces) ; null s'il ne peut pas être un code (4 à 16 lettres ou chiffres). */
export function normaliserCodeBon(saisie: unknown): string | null {
  if (typeof saisie !== "string") return null;
  const code = saisie.replace(/\s/g, "").toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

export function reponseCode(valeur: unknown): ReponseCode | null {
  if (!valeur || typeof valeur !== "object") return null;
  const r = valeur as ReponseCode;
  return ETATS_CODE.includes(r.etat) ? r : null;
}

export async function ajouterCodeBon(client: SupabaseClient<Database>, code: string): Promise<ReponseCode> {
  const { data, error } = await client.rpc("ajouter_code_bon", { code });
  const reponse = error ? null : reponseCode(data);
  if (!reponse) throw new Error("Impossible d’ajouter ce code. Réessayez.");
  return reponse;
}

/** Raison de chaque bon disponible pour ce panier (« ok » ou la raison), calculée par la base. */
export type RaisonPanier = Exclude<ResultatBon, "applique" | "aucun_bon" | "deja"> | "ok";
export async function lireRaisonsBonsPanier(client: SupabaseClient<Database>, boutique: string, lignes: { article_id: string; quantite: number }[]): Promise<Record<string, RaisonPanier>> {
  const { data, error } = await client.rpc("bons_panier", { boutique, lignes });
  if (error || !Array.isArray(data)) throw new Error("Impossible de vérifier tes bons.");
  const raisons: Record<string, RaisonPanier> = {};
  for (const item of data as { id?: unknown; raison?: unknown }[]) {
    if (typeof item?.id === "string" && (item.raison === "ok" || (RESULTATS_BON as readonly unknown[]).includes(item.raison))) raisons[item.id] = item.raison as RaisonPanier;
  }
  return raisons;
}

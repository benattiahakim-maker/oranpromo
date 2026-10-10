import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { adresseSite, slugValide } from "./lien-boutique";

/** US-31.3 : inscription en boutique (affiche → /i/<slug> → vitrine → connexion → suivi et rattachement). */

/** Cookie posé par /i/<slug> : slug de la boutique dont le client a scanné l'affiche (aucune lecture de la base). */
export const COOKIE_INSCRIPTION = "inscription_boutique";
export const DUREE_COOKIE_INSCRIPTION = 24 * 60 * 60; // 24 h

/** Lien du QR code de l'affiche : https://<site>/i/<slug>. */
export function lienInscription(slug: string, siteUrl?: string): string {
  return `${adresseSite(siteUrl)}/i/${encodeURIComponent(slug)}`;
}

/** Slug lisible d'un segment d'adresse (décodé), ou null. */
export function slugDuLien(brut: string): string | null {
  try {
    const slug = decodeURIComponent(brut).trim().toLowerCase();
    return slugValide(slug) ? slug : null;
  } catch { return null; }
}

/** Réponse de rattacher_inscription(slug). US-31.4 : bon = « donne » (bon de bienvenue reçu), « numero » (à recevoir après
 *  la vérification du numéro) ou null (pas d'offre, ou compte non rattaché). */
export type BonInscription = "donne" | "numero" | null;
export type ResultatInscription = { suivie_nouvelle: boolean; rattache: boolean; bon: BonInscription };
export function lireResultatInscription(data: unknown): ResultatInscription {
  const objet = (data ?? {}) as Record<string, unknown>;
  const bon = objet.bon === "donne" || objet.bon === "numero" ? objet.bon : null;
  return { suivie_nouvelle: objet.suivie_nouvelle === true, rattache: objet.rattache === true, bon };
}

/** US-31.4 : offre du bandeau de l'affiche (montant et minimum du bon), ou null (programme fermé, plafond, boutique sans bons, erreur). */
export type OffreInscription = { montant: number; minimum_achat: number };
export function lireOffre(data: unknown): OffreInscription | null {
  const v = data as Partial<OffreInscription> | null;
  return v && typeof v === "object" && typeof v.montant === "number" && v.montant > 0 && typeof v.minimum_achat === "number" ? { montant: v.montant, minimum_achat: v.minimum_achat } : null;
}
export async function lireOffreInscription(client: SupabaseClient<Database>, slug: string): Promise<OffreInscription | null> {
  try {
    const { data, error } = await client.rpc("offre_inscription", { slug_boutique: slug });
    return error ? null : lireOffre(data);
  } catch { return null; }
}

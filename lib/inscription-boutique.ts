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

/** Réponse de rattacher_inscription(slug). */
export type ResultatInscription = { suivie_nouvelle: boolean; rattache: boolean };
export function lireResultatInscription(data: unknown): ResultatInscription {
  const objet = (data ?? {}) as Record<string, unknown>;
  return { suivie_nouvelle: objet.suivie_nouvelle === true, rattache: objet.rattache === true };
}

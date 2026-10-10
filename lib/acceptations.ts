// US-34.2 et US-34.3 : acceptation datée des textes juridiques (preuve du consentement : loi 18-05, art. 33).
// Règles dans la base (migration 20261017200000_acceptations.sql) : versions en vigueur, textes par rôle, historique
// jamais modifié. Ici : lecture de ce qui reste à accepter, envoi, et contrôle de ce que le navigateur a montré.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { DOCUMENTS_JURIDIQUES, VERSIONS, type DocumentJuridique } from "./juridique";

export type DocumentAAccepter = { document: DocumentJuridique; version: string };
export type ContexteAcceptation = "inscription" | "commande" | "espace";

/** Textes du client (inscription par téléphone, panier) et du commerçant (espace), dans cet ordre. */
export const DOCUMENTS_CLIENT: readonly DocumentJuridique[] = ["conditions", "confidentialite"];
export const DOCUMENTS_COMMERCANT: readonly DocumentJuridique[] = ["conditions_commercants", "confidentialite"];

export const MESSAGE_CASE_INSCRIPTION = "Cochez la case pour créer votre compte.";
export const MESSAGE_CONDITIONS_A_ACCEPTER = "Nos conditions ont changé : acceptez-les pour commander.";
export const MESSAGE_CONDITIONS_CHANGEES = "Les conditions ont changé : rechargez la page.";

const estDocument = (valeur: unknown): valeur is DocumentJuridique =>
  typeof valeur === "string" && (DOCUMENTS_JURIDIQUES as readonly string[]).includes(valeur);
const estVersion = (valeur: unknown): valeur is string => typeof valeur === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valeur);

/** Liste reçue (de la base ou du navigateur) → textes connus, sans doublon ; null si un élément est invalide. */
export function documentsValides(valeur: unknown): DocumentAAccepter[] | null {
  if (!Array.isArray(valeur) || valeur.length > DOCUMENTS_JURIDIQUES.length) return null;
  const vus = new Set<string>();
  const liste: DocumentAAccepter[] = [];
  for (const element of valeur) {
    if (!element || typeof element !== "object") return null;
    const { document, version } = element as Record<string, unknown>;
    if (!estDocument(document) || !estVersion(version) || vus.has(document)) return null;
    vus.add(document);
    liste.push({ document, version });
  }
  return liste;
}

/** Textes que le compte connecté doit (re)accepter (vide pour un visiteur, un admin, un ambassadeur). */
export async function lireDocumentsAAccepter(client: SupabaseClient<Database>): Promise<DocumentAAccepter[]> {
  const { data, error } = await client.rpc("documents_a_accepter");
  if (error) throw new Error("Impossible de vérifier les conditions acceptées. Réessayez.");
  const liste = documentsValides(data ?? []);
  if (!liste) throw new Error("Impossible de vérifier les conditions acceptées. Réessayez.");
  return liste;
}

/**
 * Tout ce qui reste à accepter a-t-il été montré et coché, dans la même version ? (Le navigateur envoie ce qu'il a
 * affiché ; si une version a changé entre-temps, le client doit recharger la page et relire.)
 */
export function acceptationCouvre(aAccepter: readonly DocumentAAccepter[], acceptes: readonly DocumentAAccepter[]): boolean {
  return aAccepter.every(d => acceptes.some(a => a.document === d.document && a.version === d.version));
}

/** Enregistre l'acceptation (la base vérifie le rôle et la version en vigueur ; une acceptation ne change jamais). */
export async function accepterDocuments(client: SupabaseClient<Database>, documents: readonly DocumentAAccepter[], contexte: ContexteAcceptation): Promise<void> {
  if (documents.length === 0) return;
  const { error } = await client.rpc("accepter_documents", {
    documents: documents.map(d => d.document), versions: documents.map(d => d.version), contexte,
  });
  if (error) throw new Error(error.message.includes("Les conditions ont changé") ? MESSAGE_CONDITIONS_CHANGEES : "Impossible d’enregistrer votre accord. Réessayez.");
}

/** Versions affichées à l'inscription (celles du code, les mêmes que dans la base). */
export function documentsInscription(): DocumentAAccepter[] {
  return DOCUMENTS_CLIENT.map(document => ({ document, version: VERSIONS[document] }));
}

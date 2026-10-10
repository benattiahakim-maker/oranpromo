// US-34.4 : registre des acceptations pour l'admin (répondre à une demande ou à un litige). Lecture seule : la base
// laisse l'admin lire toutes les acceptations et tous les profils (règles d'accès de US-34.2) ; rien n'est modifiable.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { DOCUMENTS_JURIDIQUES, type DocumentJuridique } from "./juridique";

type Client = SupabaseClient<Database>;
export type CompteVersion = { document: DocumentJuridique; version: string; enVigueurLe: string; nombre: number };
export type CompteAcceptations = { id: string; nom: string | null; telephone: string | null; role: string;
  accords: { document: DocumentJuridique; version: string; accepteLe: string; contexte: string }[] };

const estDocument = (d: string): d is DocumentJuridique => (DOCUMENTS_JURIDIQUES as readonly string[]).includes(d);

/** Nombre d'acceptations pour chaque version de chaque texte (la plus récente d'abord). */
export async function compterAcceptations(client: Client): Promise<CompteVersion[]> {
  const { data, error } = await client.from("versions_documents").select("document, version, en_vigueur_le").order("document").order("version", { ascending: false });
  if (error) throw new Error("Impossible de charger les acceptations. Réessayez.");
  const versions = (data ?? []).filter(v => estDocument(v.document));
  return Promise.all(versions.map(async v => {
    const { count, error: e } = await client.from("acceptations").select("profil_id", { count: "exact", head: true }).eq("document", v.document).eq("version", v.version);
    if (e) throw new Error("Impossible de charger les acceptations. Réessayez.");
    return { document: v.document as DocumentJuridique, version: v.version, enVigueurLe: v.en_vigueur_le, nombre: count ?? 0 };
  }));
}

/** Recherche « numéro ou nom » : chiffres (+213…, 0555…) ou lettres ; au moins 3 caractères utiles. */
export function nettoyerRecherche(saisie: string | undefined): string | null {
  // Ni virgule, ni parenthèse, ni joker : la valeur va dans un filtre « or » de PostgREST.
  const texte = (saisie ?? "").replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  const chiffres = texte.replace(/[\s+]/g, "");
  if (/^\d+$/.test(chiffres)) { const sans0 = chiffres.replace(/^(213|0)/, ""); return sans0.length >= 3 ? sans0 : null; }
  return texte.length >= 3 ? texte : null;
}

/** Comptes qui correspondent (20 au plus) et leurs acceptations, de la plus ancienne à la plus récente. */
export async function chercherAcceptations(client: Client, saisie: string | undefined): Promise<CompteAcceptations[] | null> {
  const q = nettoyerRecherche(saisie);
  if (!q) return null;
  const filtre = /^\d+$/.test(q) ? `telephone.ilike.*${q}*` : `nom.ilike.*${q}*,telephone.ilike.*${q}*`;
  const { data: profils, error } = await client.from("profils").select("id, nom, telephone, role").or(filtre).order("cree_le", { ascending: false }).limit(20);
  if (error) throw new Error("Impossible de chercher ce compte. Réessayez.");
  if (!profils?.length) return [];
  const { data: accords, error: e } = await client.from("acceptations").select("profil_id, document, version, accepte_le, contexte")
    .in("profil_id", profils.map(p => p.id)).order("accepte_le", { ascending: true });
  if (e) throw new Error("Impossible de chercher ce compte. Réessayez.");
  return profils.map(p => ({ id: p.id, nom: p.nom, telephone: p.telephone, role: p.role,
    accords: (accords ?? []).filter(a => a.profil_id === p.id && estDocument(a.document))
      .map(a => ({ document: a.document as DocumentJuridique, version: a.version, accepteLe: a.accepte_le, contexte: a.contexte })) }));
}

export const CONTEXTES: Record<string, string> = { inscription: "à l’inscription", commande: "avant une commande", espace: "dans l’espace commerçant" };

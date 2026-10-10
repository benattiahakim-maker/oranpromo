// US-34.4 (partie sans décision en attente) : « Mes données » dans /compte : ce que BleDeal garde sur le compte, avec les
// dates (loi 18-07, art. 34 : droit d'accès). Lecture seule, par les règles d'accès existantes (chacun lit ses lignes).
// « Fermer mon compte » n'est PAS codé : il attend les durées de conservation (question 5 de US-34, avocat et comptable).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { DOCUMENTS_JURIDIQUES, type DocumentJuridique } from "./juridique";

type Client = SupabaseClient<Database>;
export type Compteur = { nombre: number; dernier: string | null };
export type AccordLu = { document: DocumentJuridique; version: string; accepteLe: string; contexte: string };
export type MesDonnees = {
  nom: string | null; telephone: string | null; telephoneVerifieLe: string | null; creeLe: string;
  commandes: Compteur; bons: Compteur; avis: Compteur;
  boutiques: { nom: string; depuis: string }[];
  accords: AccordLu[];
};

const ERREUR = "Impossible de charger vos données. Réessayez.";
const estDocument = (d: string): d is DocumentJuridique => (DOCUMENTS_JURIDIQUES as readonly string[]).includes(d);

/** null : pas connecté. Toute lecture impossible : erreur (jamais une page à moitié vide qui ferait croire à « rien »). */
export async function lireMesDonnees(client: Client): Promise<MesDonnees | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const [profil, commandes, avis, bons, boutiques, accords] = await Promise.all([
    client.from("profils").select("nom, telephone, telephone_verifie_le, cree_le").eq("id", user.id).maybeSingle(),
    client.from("commandes").select("cree_le", { count: "exact" }).eq("client_id", user.id).order("cree_le", { ascending: false }).limit(1),
    client.from("avis").select("cree_le", { count: "exact" }).eq("client_id", user.id).order("cree_le", { ascending: false }).limit(1),
    client.rpc("mes_bons"),
    client.from("abonnements_boutique").select("cree_le, boutiques(nom)").eq("profil_id", user.id).order("cree_le", { ascending: true }),
    client.from("acceptations").select("document, version, accepte_le, contexte").eq("profil_id", user.id).order("accepte_le", { ascending: true }),
  ]);
  if (profil.error || !profil.data || commandes.error || avis.error || bons.error || boutiques.error || accords.error) throw new Error(ERREUR);
  const listeBons = (Array.isArray(bons.data) ? bons.data : []) as unknown as { cree_le: string }[];
  const dernierBon = listeBons.map(b => b.cree_le).filter(Boolean).sort().at(-1) ?? null;
  return {
    nom: profil.data.nom, telephone: profil.data.telephone, telephoneVerifieLe: profil.data.telephone_verifie_le, creeLe: profil.data.cree_le,
    commandes: { nombre: commandes.count ?? 0, dernier: commandes.data?.[0]?.cree_le ?? null },
    avis: { nombre: avis.count ?? 0, dernier: avis.data?.[0]?.cree_le ?? null },
    bons: { nombre: listeBons.length, dernier: dernierBon },
    boutiques: ((boutiques.data ?? []) as unknown as { cree_le: string; boutiques: { nom: string } | null }[])
      .map(b => ({ nom: b.boutiques?.nom ?? "—", depuis: b.cree_le })),
    accords: (accords.data ?? []).filter(a => estDocument(a.document))
      .map(a => ({ document: a.document as DocumentJuridique, version: a.version, accepteLe: a.accepte_le, contexte: a.contexte })),
  };
}

/** « 10/10/2026 » (heure d'Alger). */
export function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Algiers", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(iso));
}

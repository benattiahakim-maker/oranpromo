// US-29.4 : lectures et actions de /admin/villes (ouvrir ou fermer une ville, ville d'un ambassadeur) et liste des villes
// des formulaires boutique. Les droits sont aussi dans la base : seul l'admin change « ouverte » et la ville d'un profil.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";
import { lireRoleAdministration } from "./boutique";
import type { ZoneVille } from "./position";

export type VilleAdmin = ZoneVille & { code: string; nom_ar: string; numero_wilaya: number | null; ouverte: boolean; ordre: number };
export type VilleAvecCompte = VilleAdmin & { validees: number; enAttente: number };
export type AmbassadeurVille = { id: string; nom: string | null; telephone: string | null; ville: string | null };

const COLONNES_VILLE = "code, nom, nom_ar, numero_wilaya, ouverte, ordre, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng";

/** Toutes les villes (ouvertes ou non), dans l'ordre de la feuille de route. Admin et ambassadeur les lisent toutes. */
export async function listerVilles(client: SupabaseClient<Database>): Promise<VilleAdmin[]> {
  const { data, error } = await client.from("villes").select(COLONNES_VILLE).order("ordre").order("code");
  if (error) throw new Error("Impossible de charger les villes. Réessayez.");
  return data ?? [];
}

/** Ajoute à chaque ville le nombre de boutiques validées et en attente (lu par l'admin, qui voit toutes les boutiques). */
export function compterParVille(villes: VilleAdmin[], boutiques: Pick<Tables<"boutiques">, "ville" | "statut">[]): VilleAvecCompte[] {
  return villes.map(ville => ({
    ...ville,
    validees: boutiques.filter(b => b.ville === ville.code && b.statut === "validee").length,
    enAttente: boutiques.filter(b => b.ville === ville.code && b.statut === "en_attente").length,
  }));
}

export async function listerVillesAvecComptes(client: SupabaseClient<Database>): Promise<VilleAvecCompte[]> {
  const [villes, { data, error }] = await Promise.all([listerVilles(client), client.from("boutiques").select("ville, statut")]);
  if (error) throw new Error("Impossible de compter les boutiques. Réessayez.");
  return compterParVille(villes, data ?? []);
}

/** Texte « Wilaya 31 · 12 validées · 2 en attente » de la maquette. */
export function resumeVille(ville: Pick<VilleAvecCompte, "numero_wilaya" | "validees" | "enAttente">): string {
  return [
    ville.numero_wilaya ? `Wilaya ${ville.numero_wilaya}` : null,
    `${ville.validees} ${ville.validees > 1 ? "validées" : "validée"}`,
    ville.enAttente ? `${ville.enAttente} en attente` : null,
  ].filter(Boolean).join(" · ");
}

/** Texte de confirmation (maquette 16) : question en gras, puis la conséquence. */
export function texteConfirmationVille(nom: string, ouvrir: boolean): { question: string; suite: string } {
  return ouvrir
    ? { question: `Ouvrir ${nom} ?`, suite: "Ses boutiques validées apparaîtront dans le choix des villes, l’accueil, le catalogue et la carte." }
    : { question: `Fermer ${nom} ?`, suite: "Ses boutiques disparaîtront du choix des villes, de l’accueil, du catalogue et de la carte. Rien n’est supprimé." };
}

async function exigerAdmin(client: SupabaseClient<Database>) {
  if (await lireRoleAdministration(client) !== "admin") throw new Error("Action réservée aux administrateurs.");
}

export async function changerOuvertureVille(client: SupabaseClient<Database>, code: string, ouverte: boolean): Promise<void> {
  await exigerAdmin(client);
  if (typeof code !== "string" || !code || typeof ouverte !== "boolean") throw new Error("Ville inconnue.");
  const { data, error } = await client.from("villes").update({ ouverte }).eq("code", code).select("code").maybeSingle();
  if (error || !data) throw new Error("Impossible de changer la ville. Réessayez.");
}

/** Ambassadeurs et leur ville (null : toutes les villes). */
export async function listerAmbassadeurs(client: SupabaseClient<Database>): Promise<AmbassadeurVille[]> {
  await exigerAdmin(client);
  const { data, error } = await client.from("profils").select("id, nom, telephone, ville").eq("role", "ambassadeur").order("cree_le");
  if (error) throw new Error("Impossible de charger les ambassadeurs. Réessayez.");
  return data ?? [];
}

export async function changerVilleAmbassadeur(client: SupabaseClient<Database>, id: string, ville: string | null): Promise<void> {
  await exigerAdmin(client);
  if (typeof id !== "string" || !id || (ville !== null && (typeof ville !== "string" || !ville))) throw new Error("Ville inconnue.");
  const { data, error } = await client.from("profils").update({ ville }).eq("id", id).eq("role", "ambassadeur").select("id").maybeSingle();
  if (error?.code === "23503") throw new Error("Ville inconnue.");
  if (error || !data) throw new Error("Impossible de changer la ville de l’ambassadeur. Réessayez.");
}

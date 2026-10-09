import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";
import { normaliserWhatsAppAlgerien } from "./boutique";

// US-20.2 / US-20.4 : profil client (nom, téléphone WhatsApp), no-shows et blocage.
// no_shows et bloque ne sont modifiables que par la base et l’admin (règle dans la base).
export const NO_SHOWS_MAX = 5;

export type ProfilClient = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "no_shows" | "bloque" | "role" | "boutique_id">;
export type SaisieProfilClient = { nom: string; telephone: string };
export type ErreursProfilClient = Partial<Record<keyof SaisieProfilClient, string>>;
export class ErreurValidationProfil extends Error { constructor(public champs: ErreursProfilClient) { super("Vérifiez votre nom et votre numéro."); } }

export function essaisRestants(noShows: number): number {
  return Math.max(0, NO_SHOWS_MAX - noShows);
}

/** Avertissement affiché au client, ou null s’il n’a aucun no-show. */
export function messageNoShows(noShows: number, bloque: boolean): string | null {
  if (bloque) return `Votre compte est bloqué après ${NO_SHOWS_MAX} commandes non récupérées : vous ne pouvez plus commander. Contactez OranPromo pour le débloquer.`;
  if (noShows <= 0) return null;
  const restants = essaisRestants(noShows);
  return `Attention : ${noShows} commande${noShows > 1 ? "s" : ""} non récupérée${noShows > 1 ? "s" : ""}. Il vous reste ${restants} essai${restants > 1 ? "s" : ""} avant le blocage de votre compte.`;
}

export function profilComplet(profil: Pick<ProfilClient, "nom" | "telephone"> | null | undefined): boolean {
  return Boolean(profil?.nom && profil.telephone && /^\+213[1-9]\d{8}$/.test(profil.telephone));
}

export function validerProfilClient(saisie: SaisieProfilClient): ErreursProfilClient {
  const erreurs: ErreursProfilClient = {};
  const nom = saisie.nom.trim();
  if (nom.length < 2 || nom.length > 80) erreurs.nom = "Votre nom doit contenir entre 2 et 80 caractères.";
  if (!normaliserWhatsAppAlgerien(saisie.telephone)) erreurs.telephone = "Saisissez un numéro algérien valide, par exemple 0555 12 34 56.";
  return erreurs;
}

/** Numéro +213… au format lisible 0555 12 34 56. */
export function telephoneLisible(telephone: string): string {
  const m = /^\+213(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(telephone);
  return m ? `0${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}` : telephone;
}

export async function lireProfilClient(client: SupabaseClient<Database>): Promise<ProfilClient | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data, error: erreurProfil } = await client.from("profils").select("id, nom, telephone, no_shows, bloque, role, boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de charger votre profil. Réessayez.");
  return data;
}

export async function enregistrerProfilClient(client: SupabaseClient<Database>, saisie: SaisieProfilClient) {
  const erreurs = validerProfilClient(saisie);
  if (Object.keys(erreurs).length) throw new ErreurValidationProfil(erreurs);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data, error: erreurMaj } = await client.from("profils").update({ nom: saisie.nom.trim(), telephone: normaliserWhatsAppAlgerien(saisie.telephone)! }).eq("id", user.id).select("id").maybeSingle();
  if (erreurMaj || !data) throw new Error("Impossible d’enregistrer votre profil. Réessayez.");
}

// --- US-20.4 : clients à surveiller (admin) ----------------------------------
export type ClientSurveille = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "no_shows" | "bloque" | "bloque_le">;

/** Clients bloqués puis clients avec des no-shows (lecture réservée à l’admin par la base). */
export async function listerClientsSurveilles(client: SupabaseClient<Database>): Promise<{ bloques: ClientSurveille[]; avecNoShows: ClientSurveille[] }> {
  const { data, error } = await client.from("profils").select("id, nom, telephone, no_shows, bloque, bloque_le").or("bloque.eq.true,no_shows.gt.0").order("bloque", { ascending: false }).order("no_shows", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les clients. Réessayez.");
  const lignes = data ?? [];
  return { bloques: lignes.filter(c => c.bloque), avecNoShows: lignes.filter(c => !c.bloque && c.no_shows > 0) };
}

export async function debloquerClient(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("debloquer_client", { client: id });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de débloquer ce client. Réessayez.");
}

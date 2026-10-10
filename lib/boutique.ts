import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "./supabase/types";
import { emailValide } from "./connexion";
import { baseSlug, candidatSlug } from "./lien-boutique";
import { arrondirCoordonnee, dansZone, lireCoordonnee, MESSAGE_HORS_ORAN, MESSAGE_POSITION_INCOMPLETE, MESSAGE_POSITION_PUBLIEE, messageHorsVille, validerPosition, ZONE_ORAN, type ZoneVille } from "./position";
import { villeLue } from "./ville";

// Nom de boutique : 2 à 80 caractères (même limite à l’écran, sur le serveur et dans la base, contrainte boutiques.nom).
export const NOM_BOUTIQUE_MIN = 2;
export const NOM_BOUTIQUE_MAX = 80;
export const MESSAGE_NOM_BOUTIQUE = `Le nom de la boutique doit contenir entre ${NOM_BOUTIQUE_MIN} et ${NOM_BOUTIQUE_MAX} caractères.`;
export function nomBoutiqueValide(nom: string): boolean {
  const longueur = Array.from(nom.trim()).length; // caractères comme char_length de PostgreSQL (un émoji compte pour 1)
  return longueur >= NOM_BOUTIQUE_MIN && longueur <= NOM_BOUTIQUE_MAX;
}
export const STATUTS_BOUTIQUE = { en_attente: "En attente", validee: "Validée", suspendue: "Suspendue" } as const;
export type RoleAdministration = "admin" | "ambassadeur";
// US-29.4 : « ville » = code de la ville (wilaya) de la boutique, choisi à la création.
export type SaisieBoutique = { nom: string; quartier: string; adresse: string; latitude: string; longitude: string; horaires: string; whatsapp: string; instagram: string; facebook: string; ville: string };
export const MESSAGE_VILLE_BOUTIQUE = "Choisissez la ville (wilaya) de la boutique.";
export const MESSAGE_VILLE_AMBASSADEUR = "Vous ne pouvez créer des boutiques que dans votre ville.";
export type ErreursBoutique = Partial<Record<keyof SaisieBoutique, string>>;
export class ErreurValidationBoutique extends Error { constructor(public champs: ErreursBoutique) { super("Vérifiez les champs du formulaire."); } }

export function roleAdministration(role: string | null | undefined): role is RoleAdministration { return role === "admin" || role === "ambassadeur"; }
export function filtreBoutiques(statut: string | string[] | undefined, role: RoleAdministration): Enums<"statut_boutique"> | null {
  if (typeof statut === "string" && Object.hasOwn(STATUTS_BOUTIQUE, statut)) return statut as Enums<"statut_boutique">;
  return statut === "tous" || role === "admin" ? null : "en_attente";
}
export function slugBoutique(nom: string): string {
  return nom.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || "boutique";
}
export function normaliserWhatsAppAlgerien(valeur: string): string | null {
  if (!/^[+\d\s().-]+$/.test(valeur)) return null;
  const chiffres = valeur.replace(/[\s().-]/g, "");
  let national = chiffres;
  if (national.startsWith("+213")) national = national.slice(4);
  else if (national.startsWith("00213")) national = national.slice(5);
  else if (national.startsWith("213")) national = national.slice(3);
  else if (national.startsWith("0")) national = national.slice(1);
  else return null;
  return /^[1-9]\d{8}$/.test(national) ? `+213${national}` : null;
}
function coordonnee(valeur: string): number | null {
  const lue = lireCoordonnee(valeur);
  return lue === null || Number.isNaN(lue) ? lue : arrondirCoordonnee(lue);
}
function lienSocial(valeur: string, reseau: "instagram" | "facebook"): string | null {
  if (!valeur.trim()) return null;
  try {
    const url = new URL(valeur.trim());
    const domaine = url.hostname.replace(/^www\./, "");
    if (url.protocol !== "https:" || url.username || url.password || (reseau === "instagram" ? domaine !== "instagram.com" : !["facebook.com", "m.facebook.com", "fb.me"].includes(domaine))) return null;
    return url.toString();
  } catch { return null; }
}
// US-29.4 : « zone » = bornes de la ville choisie (Oran par défaut : mêmes points acceptés et refusés, même message).
export function validerBoutique(saisie: SaisieBoutique, zone: ZoneVille = ZONE_ORAN): ErreursBoutique {
  const erreurs: ErreursBoutique = {};
  if (!nomBoutiqueValide(saisie.nom)) erreurs.nom = MESSAGE_NOM_BOUTIQUE;
  if (!saisie.ville?.trim()) erreurs.ville = MESSAGE_VILLE_BOUTIQUE;
  if (!saisie.quartier.trim()) erreurs.quartier = "Saisissez le quartier.";
  if (!saisie.adresse.trim()) erreurs.adresse = "Saisissez l’adresse.";
  if (!normaliserWhatsAppAlgerien(saisie.whatsapp)) erreurs.whatsapp = "Saisissez un numéro algérien valide, par exemple 0555 12 34 56.";
  const latitude = coordonnee(saisie.latitude), longitude = coordonnee(saisie.longitude);
  if (latitude !== null && !Number.isFinite(latitude)) erreurs.latitude = "Saisissez la latitude en degrés décimaux, par exemple 35,697120.";
  if (longitude !== null && !Number.isFinite(longitude)) erreurs.longitude = "Saisissez la longitude en degrés décimaux, par exemple −0,633750.";
  if (latitude !== null && longitude === null) erreurs.longitude = "Saisissez aussi la longitude.";
  if (longitude !== null && latitude === null) erreurs.latitude = "Saisissez aussi la latitude.";
  // US-24 / US-29.4 : position dans la wilaya de la ville (même rectangle que la base).
  if (!erreurs.latitude && !erreurs.longitude && latitude !== null && longitude !== null && !dansZone(zone, latitude, longitude)) erreurs.latitude = messageHorsVille(zone.nom);
  if (saisie.instagram.trim() && !lienSocial(saisie.instagram, "instagram")) erreurs.instagram = "Saisissez un lien Instagram en https://.";
  if (saisie.facebook.trim() && !lienSocial(saisie.facebook, "facebook")) erreurs.facebook = "Saisissez un lien Facebook en https://.";
  return erreurs;
}

export async function lireRoleAdministration(client: SupabaseClient<Database>): Promise<RoleAdministration> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("role").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de vérifier votre accès. Réessayez.");
  if (!roleAdministration(profil?.role)) throw new Error("Accès réservé");
  return profil.role;
}
// US-29.4 : rôle et ville (facultative) de l'admin ou de l'ambassadeur connecté.
export async function lireAdministrateur(client: SupabaseClient<Database>): Promise<{ role: RoleAdministration; ville: string | null }> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("role, ville").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de vérifier votre accès. Réessayez.");
  if (!roleAdministration(profil?.role)) throw new Error("Accès réservé");
  return { role: profil.role, ville: profil.ville ?? null };
}
const COLONNES_ZONE = "nom, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng";
/** US-29.4 : bornes et centre d'une ville (ouverte ou non : l'admin et l'ambassadeur lisent toutes les villes). */
export async function lireZoneVille(client: SupabaseClient<Database>, code: string): Promise<ZoneVille | null> {
  const { data, error } = await client.from("villes").select(COLONNES_ZONE).eq("code", code).maybeSingle();
  if (error) throw new Error("Impossible de lire la ville. Réessayez.");
  return data;
}
export async function creerBoutique(client: SupabaseClient<Database>, saisie: SaisieBoutique): Promise<Tables<"boutiques">> {
  const { role, ville: villeAmbassadeur } = await lireAdministrateur(client);
  // Un ambassadeur à qui l'admin a donné une ville crée dans cette ville seulement (règle aussi dans la base).
  if (role === "ambassadeur" && villeAmbassadeur && saisie.ville && saisie.ville !== villeAmbassadeur) throw new ErreurValidationBoutique({ ville: MESSAGE_VILLE_AMBASSADEUR });
  const code = role === "ambassadeur" && villeAmbassadeur ? villeAmbassadeur : saisie.ville?.trim();
  if (!code) throw new ErreurValidationBoutique({ ville: MESSAGE_VILLE_BOUTIQUE });
  const zone = await lireZoneVille(client, code);
  if (!zone) throw new ErreurValidationBoutique({ ville: MESSAGE_VILLE_BOUTIQUE });
  const erreurs = validerBoutique({ ...saisie, ville: code }, zone);
  if (Object.keys(erreurs).length) throw new ErreurValidationBoutique(erreurs);
  // US-22 : slug lisible (nom, nom-2 … nom-9, puis suffixe aléatoire) ; la contrainte unique en base reste l’arbitre.
  const base = baseSlug(slugBoutique(saisie.nom));
  for (let tentative = 0; tentative < 11; tentative++) {
    const slug = candidatSlug(base, tentative);
    const { data, error } = await client.from("boutiques").insert({ nom: saisie.nom.trim(), quartier: saisie.quartier.trim(), adresse: saisie.adresse.trim(), latitude: coordonnee(saisie.latitude), longitude: coordonnee(saisie.longitude), horaires: saisie.horaires.trim() || null, whatsapp: normaliserWhatsAppAlgerien(saisie.whatsapp)!, instagram: lienSocial(saisie.instagram, "instagram"), facebook: lienSocial(saisie.facebook, "facebook"), slug, statut: "en_attente", ville: code }).select("*").single();
    if (!error && data) return data;
    if (error?.code === "23514" && error.message.includes(MESSAGE_NOM_BOUTIQUE)) throw new ErreurValidationBoutique({ nom: MESSAGE_NOM_BOUTIQUE });
    if (error?.code === "23514" && /wilaya|boutiques_position/.test(error.message)) throw new ErreurValidationBoutique({ latitude: messageHorsVille(zone.nom) });
    if (error?.code === "42501") throw new ErreurValidationBoutique({ ville: MESSAGE_VILLE_AMBASSADEUR });
    if (error?.code !== "23505") throw new Error("Impossible de créer la boutique. Réessayez.");
  }
  throw new Error("Impossible de générer une adresse unique pour la boutique. Réessayez.");
}
export async function changerStatutBoutique(client: SupabaseClient<Database>, id: string, statut: Enums<"statut_boutique">) {
  if (await lireRoleAdministration(client) !== "admin") throw new Error("Action réservée aux administrateurs.");
  if (!["validee", "suspendue"].includes(statut)) throw new Error("Choisissez un statut valide.");
  const { data, error } = await client.from("boutiques").update({ statut }).eq("id", id).select("id").single();
  if (error || !data) throw new Error("Impossible de modifier le statut. Réessayez.");
}
export async function rattacherCommercant(client: SupabaseClient<Database>, id: string, email: string) {
  if (await lireRoleAdministration(client) !== "admin") throw new Error("Action réservée aux administrateurs.");
  if (!emailValide(email)) throw new Error("Saisissez une adresse e-mail valide.");
  const { error } = await client.rpc("rattacher_commercant", { email_commercant: email.trim(), boutique: id });
  if (error) throw new Error(error.message);
}
// US-29.4 : « ville » = code de la ville du filtre (null : toutes).
export async function listerBoutiques(client: SupabaseClient<Database>, statut: Enums<"statut_boutique"> | null, ville: string | null = null) {
  const boutiques: Tables<"boutiques">[] = [];
  for (let offset = 0; ; offset += 500) {
    let requete = client.from("boutiques").select("*").order("statut", { ascending: true }).order("nom", { ascending: true }).order("id", { ascending: true });
    if (statut) requete = requete.eq("statut", statut);
    if (ville) requete = requete.eq("ville", ville);
    const { data, error } = await requete.range(offset, offset + 499);
    if (error || !data) throw new Error("Impossible de charger les boutiques. Réessayez.");
    boutiques.push(...data);
    if (data.length < 500) return boutiques;
  }
}

// US-24.2 : enregistrer (ou retirer, avec deux null) la position d'une boutique. Le serveur ne reçoit que deux nombres,
// les valide (validerPosition) et la base revérifie : bornes d'Oran, et position d'une boutique publiée réservée à l'admin.
export function messageErreurPosition(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23514") return error.message?.includes("aucune des deux") ? MESSAGE_POSITION_INCOMPLETE : /^La position doit être dans la wilaya /.test(error.message ?? "") ? error.message! : MESSAGE_HORS_ORAN;
  if (error?.code === "42501") return MESSAGE_POSITION_PUBLIEE;
  return "Impossible d’enregistrer la position. Réessayez.";
}
async function ecrirePosition(client: SupabaseClient<Database>, id: string, latitude: unknown, longitude: unknown) {
  // US-29.4 : bornes de la ville de la boutique (illisible : Oran, la base revérifie de toute façon).
  const { data: lue } = await client.from("boutiques").select(`villes(${COLONNES_ZONE})`).eq("id", id).maybeSingle();
  const zone = villeLue(lue?.villes) ?? ZONE_ORAN;
  const position = validerPosition(typeof latitude === "number" ? latitude : latitude == null ? null : Number.NaN, typeof longitude === "number" ? longitude : longitude == null ? null : Number.NaN, zone);
  if (!position.ok) throw new Error(position.message);
  const { data, error } = await client.from("boutiques").update({ latitude: position.latitude, longitude: position.longitude }).eq("id", id).select("id").maybeSingle();
  // Aucune ligne : la règle RLS a écarté la boutique (pas la sienne).
  if (error || !data) throw new Error(messageErreurPosition(error));
}
// Admin : n'importe quelle boutique, même publiée.
export async function modifierPositionBoutiqueAdmin(client: SupabaseClient<Database>, id: string, latitude: unknown, longitude: unknown) {
  if (await lireRoleAdministration(client) !== "admin") throw new Error("Action réservée aux administrateurs.");
  if (typeof id !== "string" || !id) throw new Error("Boutique introuvable.");
  await ecrirePosition(client, id, latitude, longitude);
}
// Commerçant : sa boutique seulement (lue dans son profil, jamais envoyée par le navigateur), tant qu'elle est en attente.
export async function modifierPositionMaBoutique(client: SupabaseClient<Database>, latitude: unknown, longitude: unknown) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de vérifier votre accès. Réessayez.");
  if (!profil?.boutique_id) throw new Error("Votre compte n’est rattaché à aucune boutique.");
  const { data: boutique } = await client.from("boutiques").select("statut").eq("id", profil.boutique_id).maybeSingle();
  if (boutique && boutique.statut !== "en_attente") throw new Error(MESSAGE_POSITION_PUBLIEE);
  await ecrirePosition(client, profil.boutique_id, latitude, longitude);
}

// US-29.4 : l'admin change la ville d'une boutique (la base revérifie sa position dans les bornes de la nouvelle ville).
export async function changerVilleBoutique(client: SupabaseClient<Database>, id: string, ville: string) {
  if (await lireRoleAdministration(client) !== "admin") throw new Error("Action réservée aux administrateurs.");
  if (typeof id !== "string" || !id || typeof ville !== "string" || !ville) throw new Error(MESSAGE_VILLE_BOUTIQUE);
  const { data, error } = await client.from("boutiques").update({ ville }).eq("id", id).select("id").maybeSingle();
  if (error?.code === "23514") throw new Error(`${messageErreurPosition(error)} Retirez ou corrigez d’abord la position.`);
  if (error?.code === "23503") throw new Error(MESSAGE_VILLE_BOUTIQUE);
  if (error || !data) throw new Error("Impossible de changer la ville. Réessayez.");
}

/** US-29.4 : filtre « ?ville= » de /admin/boutiques (code connu, sinon toutes). */
export function filtreVille(ville: string | string[] | undefined, codes: readonly string[]): string | null {
  return typeof ville === "string" && codes.includes(ville) ? ville : null;
}

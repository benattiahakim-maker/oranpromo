import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "./supabase/types";
import { emailValide } from "./connexion";

export const STATUTS_BOUTIQUE = { en_attente: "En attente", validee: "Validée", suspendue: "Suspendue" } as const;
export type RoleAdministration = "admin" | "ambassadeur";
export type SaisieBoutique = { nom: string; quartier: string; adresse: string; latitude: string; longitude: string; horaires: string; whatsapp: string; instagram: string; facebook: string };
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
  if (!valeur.trim()) return null;
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(valeur.trim())) return NaN;
  return Number(valeur.trim().replace(",", "."));
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
export function validerBoutique(saisie: SaisieBoutique): ErreursBoutique {
  const erreurs: ErreursBoutique = {};
  if (saisie.nom.trim().length < 2 || saisie.nom.trim().length > 120) erreurs.nom = "Le nom doit contenir entre 2 et 120 caractères.";
  if (!saisie.quartier.trim()) erreurs.quartier = "Saisissez le quartier.";
  if (!saisie.adresse.trim()) erreurs.adresse = "Saisissez l’adresse.";
  if (!normaliserWhatsAppAlgerien(saisie.whatsapp)) erreurs.whatsapp = "Saisissez un numéro algérien valide, par exemple 0555 12 34 56.";
  const latitude = coordonnee(saisie.latitude), longitude = coordonnee(saisie.longitude);
  if (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) erreurs.latitude = "La latitude doit être comprise entre −90 et 90.";
  if (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) erreurs.longitude = "La longitude doit être comprise entre −180 et 180.";
  if (latitude !== null && longitude === null) erreurs.longitude = "Saisissez aussi la longitude.";
  if (longitude !== null && latitude === null) erreurs.latitude = "Saisissez aussi la latitude.";
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
export async function creerBoutique(client: SupabaseClient<Database>, saisie: SaisieBoutique): Promise<Tables<"boutiques">> {
  await lireRoleAdministration(client);
  const erreurs = validerBoutique(saisie);
  if (Object.keys(erreurs).length) throw new ErreurValidationBoutique(erreurs);
  for (let tentative = 0; tentative < 3; tentative++) {
    // Le suffixe UUID évite les collisions, la contrainte unique en base reste l’arbitre.
    const slug = `${slugBoutique(saisie.nom)}-${crypto.randomUUID()}`;
    const { data, error } = await client.from("boutiques").insert({ nom: saisie.nom.trim(), quartier: saisie.quartier.trim(), adresse: saisie.adresse.trim(), latitude: coordonnee(saisie.latitude), longitude: coordonnee(saisie.longitude), horaires: saisie.horaires.trim() || null, whatsapp: normaliserWhatsAppAlgerien(saisie.whatsapp)!, instagram: lienSocial(saisie.instagram, "instagram"), facebook: lienSocial(saisie.facebook, "facebook"), slug, statut: "en_attente" }).select("*").single();
    if (!error && data) return data;
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
export async function listerBoutiques(client: SupabaseClient<Database>, statut: Enums<"statut_boutique"> | null) {
  const boutiques: Tables<"boutiques">[] = [];
  for (let offset = 0; ; offset += 500) {
    let requete = client.from("boutiques").select("*").order("statut", { ascending: true }).order("nom", { ascending: true }).order("id", { ascending: true });
    if (statut) requete = requete.eq("statut", statut);
    const { data, error } = await requete.range(offset, offset + 499);
    if (error || !data) throw new Error("Impossible de charger les boutiques. Réessayez.");
    boutiques.push(...data);
    if (data.length < 500) return boutiques;
  }
}

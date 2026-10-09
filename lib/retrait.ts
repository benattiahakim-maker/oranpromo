import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { Langue } from "./langue";
import { adresseDonneesSvg, adresseSite, qrCodeSvg } from "./lien-boutique";

// US-26 : retrait par QR code. Le jeton (128 bits, base64url, 22 caractères) et le code à 4 chiffres sont créés
// par la base au passage « prête » (prive.retraits) ; voir docs/architecture.md, « Retrait par QR code (US-26) ».

type Client = SupabaseClient<Database>;

export const FORMAT_JETON_RETRAIT = /^[A-Za-z0-9_-]{22}$/;
export const FORMAT_CODE_RETRAIT = /^[0-9]{4}$/;

export function jetonRetraitValide(jeton: unknown): jeton is string {
  return typeof jeton === "string" && FORMAT_JETON_RETRAIT.test(jeton);
}

export function codeRetraitValide(code: unknown): code is string {
  return typeof code === "string" && FORMAT_CODE_RETRAIT.test(code);
}

/** Page du client ou du proche, sans connexion : https://<site>/retrait/<jeton> (lien à partager, bouton du message WhatsApp). */
export function lienRetrait(jeton: string, siteUrl?: string): string {
  return `${adresseSite(siteUrl)}/retrait/${jeton}`;
}

/** Contenu du QR code : la page de la commande dans l'espace de la boutique (scanner du site ou appareil photo du téléphone). */
export function lienScanRetrait(jeton: string, siteUrl?: string): string {
  return `${adresseSite(siteUrl)}/espace/retrait/${jeton}`;
}

/** QR code du retrait (SVG en adresse data:), généré côté serveur avec la bibliothèque de US-22. */
export async function qrCodeRetrait(jeton: string, siteUrl?: string): Promise<string> {
  return adresseDonneesSvg(await qrCodeSvg(lienScanRetrait(jeton, siteUrl)));
}

const MESSAGE_PARTAGE: Record<Langue, (numero: number, boutique: string, lien: string) => string> = {
  fr: (numero, boutique, lien) => `Peux-tu récupérer ma commande n° ${numero} chez ${boutique} ? Montre ce QR code au vendeur (ou donne-lui le code) et paie sur place : ${lien}`,
  ar: (numero, boutique, lien) => `تقدر تدّيلي الطلبية رقم ${numero} من ${boutique}؟ ورّي هاد QR للبيّاع (ولا عطيه الرقم) وخلّص تمّا: ${lien}`,
};

/** Envoi à un proche sur WhatsApp, sans destinataire : le client choisit le contact. */
export function lienPartageRetrait(langue: Langue, numero: number, boutique: string, lien: string): string {
  return `https://wa.me/?text=${encodeURIComponent(MESSAGE_PARTAGE[langue](numero, boutique, lien))}`;
}

export type LigneRetrait = { titre: string; taille: string; quantite: number; prix_unitaire: number };
export type EtatRetraitLien = "prete" | "recuperee" | "annulee" | "expiree";
export type RetraitParLien = {
  etat: EtatRetraitLien; numero: number; total: number; expire_le: string | null; terminee_le: string | null;
  boutique: { nom: string; slug: string; quartier: string; adresse: string | null };
  lignes: LigneRetrait[]; code: string | null;
  /** US-27.4 : bon parrainage déduit (0 sans bon). */
  remise_bon?: number;
};

const ETATS_LIEN: readonly EtatRetraitLien[] = ["prete", "recuperee", "annulee", "expiree"];

/** Page du proche : null si le jeton est inconnu ou mal formé (la base répond pareil). */
export async function lireRetraitParLien(client: Client, jeton: string): Promise<RetraitParLien | null> {
  if (!jetonRetraitValide(jeton)) return null;
  const { data, error } = await client.rpc("retrait_par_lien", { jeton });
  if (error) throw new Error("Retrait indisponible.");
  const vue = data as RetraitParLien | null;
  return vue && ETATS_LIEN.includes(vue.etat) ? vue : null;
}

/** Jeton et code du client pour sa commande prête (rien sinon : autre compte, commande plus prête, date passée). */
export async function lireRetraitClient(client: Client, commandeId: string): Promise<{ jeton: string; code: string } | null> {
  const { data, error } = await client.rpc("retrait_client", { commande: commandeId });
  if (error) throw new Error("Retrait indisponible.");
  const ligne = data?.[0];
  return ligne && jetonRetraitValide(ligne.jeton) && codeRetraitValide(ligne.code) ? { jeton: ligne.jeton, code: ligne.code } : null;
}

// ---------------------------------------------------------------------------
// US-26.3 : côté boutique (scanner, code à 4 chiffres, « Remis au client »). Espace commerçant en français.
// ---------------------------------------------------------------------------

/**
 * Jeton lu dans un QR code scanné, ou null : on n'accepte que <site>/espace/retrait/<jeton> (même origine).
 * Tout autre QR code (affiche de la boutique, paiement…) est refusé sans appel au serveur.
 */
export function jetonDepuisQr(texte: unknown, siteUrl?: string): string | null {
  if (typeof texte !== "string" || texte.length > 300) return null;
  let url: URL;
  try { url = new URL(texte.trim()); } catch { return null; }
  if (url.origin !== adresseSite(siteUrl)) return null;
  const trouve = /^\/espace\/retrait\/([A-Za-z0-9_-]{22})\/?$/.exec(url.pathname);
  return trouve ? trouve[1] : null;
}

export type EtatRetraitBoutique = "ok" | "remise" | "invalide" | "deja_remise" | "annulee" | "expiree";
export type ResumeRetrait = {
  etat: EtatRetraitBoutique; commande?: string; numero?: number; prenom?: string; total?: number;
  expire_le?: string | null; terminee_le?: string | null; mode_remise?: string | null; lignes?: LigneRetrait[];
};
export type CleRetrait = { jeton: string } | { code: string };

const ETATS_BOUTIQUE: readonly EtatRetraitBoutique[] = ["ok", "remise", "invalide", "deja_remise", "annulee", "expiree"];
export const MESSAGE_CONNEXION_BOUTIQUE = "Connectez-vous à votre espace boutique.";

function parametres(cle: CleRetrait): { jeton?: string; code?: string } {
  if ("jeton" in cle) {
    if (!jetonRetraitValide(cle.jeton)) return {};
    return { jeton: cle.jeton };
  }
  return codeRetraitValide(cle.code) ? { code: cle.code } : {};
}

async function appelerRetrait(client: Client, fonction: "retrait_boutique" | "remettre_commande", cle: CleRetrait): Promise<ResumeRetrait> {
  const args = parametres(cle);
  // Mauvais format : même réponse que la base pour un jeton ou un code inconnu, sans appel.
  if (!args.jeton && !args.code) return { etat: "invalide" };
  const { data, error } = await client.rpc(fonction, args);
  if (error) throw new Error(error.code === "42501" ? MESSAGE_CONNEXION_BOUTIQUE : "Impossible de lire cette commande. Réessayez.");
  const vue = data as ResumeRetrait | null;
  if (!vue || !ETATS_BOUTIQUE.includes(vue.etat)) throw new Error("Impossible de lire cette commande. Réessayez.");
  return vue;
}

/** Résumé pour la boutique connectée (lecture seule : ne remet rien). */
export function lireRetraitBoutique(client: Client, cle: CleRetrait): Promise<ResumeRetrait> {
  return appelerRetrait(client, "retrait_boutique", cle);
}

/** « Remis au client » : prête → récupérée par la base (mode « qr » ou « code »), contrôles refaits par la base. */
export function remettreRetrait(client: Client, cle: CleRetrait): Promise<ResumeRetrait> {
  return appelerRetrait(client, "remettre_commande", cle);
}

/** « 10/10 à 17 h 05 », heure d'Oran. */
export function formaterDateRemise(iso: string): string {
  const parties = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Algiers", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const p = (type: string) => parties.find(x => x.type === type)?.value ?? "";
  return `${p("day")}/${p("month")} à ${p("hour")} h ${p("minute")}`;
}

/** Message pour un retrait qui ne peut pas être remis (jamais d'erreur technique, jamais d'indice sur une autre boutique). */
export function messageRetraitBoutique(resume: ResumeRetrait, parCode: boolean): string | null {
  switch (resume.etat) {
    case "invalide": return parCode ? "Code faux. Vérifiez les 4 chiffres avec le client." : "Ce QR code n’est pas valide pour votre boutique.";
    case "deja_remise": return resume.terminee_le ? `Déjà remise le ${formaterDateRemise(resume.terminee_le)}.` : "Cette commande a déjà été remise.";
    case "annulee": return "Cette commande a été annulée.";
    case "expiree": return "Cette commande a expiré : elle n’est plus à remettre.";
    default: return null;
  }
}

export const MESSAGE_PAS_QR_RETRAIT = "Ce n’est pas un QR code de retrait OranPromo.";
export const MESSAGE_CAMERA_BLOQUEE = "La caméra est bloquée. Autorisez-la dans les réglages du navigateur (cadenas à côté de l’adresse), ou tapez le code.";
export const NOTE_REMISE_SANS_QR = "Remise sans QR code";

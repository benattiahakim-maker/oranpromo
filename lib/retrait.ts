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

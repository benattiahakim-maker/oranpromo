import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { Langue } from "./langue";
import { adresseDonneesSvg, adresseSite, qrCodeSvg } from "./lien-boutique";
import { normaliserTelephoneClient } from "./telephone";

// US-27 : parrainage (décisions du propriétaire du 9/10). Règles dans la base (migration 20261012090000_parrainage.sql) ;
// ici : saisie du parrain, lien d'invitation /p/<code>, message de partage et lecture de ce que voit le client.
// Voir docs/architecture.md, « Parrainage (US-27) ».

type Client = SupabaseClient<Database>;

/** 6 caractères sans 0/O, 1/I/L (même règle que la contrainte de profils.code_parrainage). */
export const FORMAT_CODE_PARRAINAGE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
/** Cookie posé par /p/<code> : le code seul, 30 jours. */
export const COOKIE_PARRAIN = "parrain";
export const DUREE_COOKIE_PARRAIN = 60 * 60 * 24 * 30;

export const MESSAGE_PARRAIN_ENREGISTRE = "C'est noté. Si ce numéro est celui d'un client OranPromo, il deviendra ton parrain après ton premier retrait en boutique.";
export const MESSAGE_SAISIE_PARRAIN_INVALIDE = "Écris le numéro WhatsApp de ton parrain (05, 06 ou 07 et 8 chiffres) ou son code de 6 caractères.";
export const MESSAGE_PARRAIN_IMPOSSIBLE = "Impossible d'enregistrer ton parrain. Réessaie.";

/** Code de parrainage tapé ou lu dans un lien (espaces ignorés, minuscules acceptées), ou null. */
export function normaliserCodeParrainage(saisie: string | null | undefined): string | null {
  if (typeof saisie !== "string" || saisie.length > 20) return null;
  const code = saisie.replace(/[\s-]/g, "").toUpperCase();
  return FORMAT_CODE_PARRAINAGE.test(code) ? code : null;
}

/** Saisie du filleul : numéro de mobile algérien (→ +213XXXXXXXXX) ou code de 6 caractères ; null sinon. */
export function normaliserSaisieParrain(saisie: string | null | undefined): string | null {
  return normaliserTelephoneClient(saisie) ?? normaliserCodeParrainage(saisie);
}

/** Lien d'invitation : https://<site>/p/<code> (ni nom ni numéro dedans). */
export function lienParrainage(code: string, siteUrl?: string): string {
  return `${adresseSite(siteUrl)}/p/${encodeURIComponent(code)}`;
}

const MESSAGE_PARTAGE: Record<Langue, (lien: string) => string> = {
  fr: lien => `Je t'invite sur OranPromo, les promos des boutiques d'Oran : ${lien}`,
  ar: lien => `نعرضك لـ OranPromo، التخفيضات تاع حوانيت وهران: ${lien}`,
};

export function messagePartageParrainage(langue: Langue, lien: string): string {
  return MESSAGE_PARTAGE[langue](lien);
}

/** Partage sur WhatsApp sans destinataire (le client choisit le contact ou son statut ; OranPromo n'écrit à personne). */
export function lienPartageParrainage(langue: Langue, lien: string): string {
  return `https://wa.me/?text=${encodeURIComponent(messagePartageParrainage(langue, lien))}`;
}

export type StatutParrainage = "en_attente" | "valide" | "plafond" | "en_file" | "non_valide" | "expire" | "refuse" | "annule";
export type FilleulVisible = { prenom: string; valide_le: string | null; statut: StatutParrainage };
/** Réponse de mon_parrainage() : jamais un numéro ; prénom + initiale des filleuls récompensés. */
export type MonParrainage = {
  actif: boolean; peut_parrainer: boolean; code: string | null; parrain_saisi: boolean; saisies: number;
  peut_choisir: boolean; choix_jusqu_au: string | null; filleuls: FilleulVisible[]; en_attente: number; plafond_atteint: boolean;
};

/** Saisies restantes (3 au plus : la première, puis 2 modifications). */
export const SAISIES_MAX = 3;
export function modificationsRestantes(saisies: number): number {
  return Math.max(0, SAISIES_MAX - Math.max(0, saisies));
}

/** Compteurs du bloc « Mon parrainage » : filleuls récompensés (bon du parrain émis ou en file) et filleuls en attente. */
export function compteursParrainage(p: Pick<MonParrainage, "filleuls" | "en_attente">): { valides: number; enAttente: number } {
  return { valides: p.filleuls.length, enAttente: Math.max(0, p.en_attente) };
}

/** Le bloc « Mon parrainage » s'affiche si le client peut parrainer (interrupteur ouvert) ou a déjà des filleuls. */
export function afficherMonParrainage(p: MonParrainage | null): boolean {
  return Boolean(p && ((p.actif && p.peut_parrainer) || p.filleuls.length > 0 || p.en_attente > 0));
}

/** Interrupteur `parrainage` (lisible sans connexion) ; une erreur vaut « fermé » : rien n'est annoncé. */
export async function parrainageOuvert(client: Client): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("parrainage_ouvert");
    return !error && data === true;
  } catch { return false; }
}

export async function lireMonParrainage(client: Client): Promise<MonParrainage | null> {
  const { data, error } = await client.rpc("mon_parrainage");
  if (error) throw new Error("Impossible de charger ton parrainage. Réessaie.");
  return (data ?? null) as MonParrainage | null;
}

/** Code du client (créé par la base à la première demande) ; null si le client ne peut pas parrainer. */
export async function lireMonCode(client: Client): Promise<string | null> {
  const { data, error } = await client.rpc("mon_code_parrainage");
  if (error || typeof data !== "string") return null;
  return normaliserCodeParrainage(data);
}

/** Saisie du parrain : toujours la même réponse si la base l'accepte (pas d'énumération). */
export async function choisirParrain(client: Client, saisie: string): Promise<void> {
  const valeur = normaliserSaisieParrain(saisie);
  if (!valeur) throw new Error(MESSAGE_SAISIE_PARRAIN_INVALIDE);
  const { data, error } = await client.rpc("choisir_parrain", { saisie: valeur });
  if (error) throw new Error(["42501", "23514", "54000", "22023", "55000"].includes(error.code ?? "") && error.message ? error.message : MESSAGE_PARRAIN_IMPOSSIBLE);
  if (data !== "enregistre") throw new Error(MESSAGE_PARRAIN_IMPOSSIBLE);
}

/** Lien d'invitation complet du client connecté (code créé à la première demande), ou null s'il ne peut pas parrainer. */
export async function preparerInvitation(client: Client, langue: Langue, options: { qr?: boolean; siteUrl?: string } = {}): Promise<{ code: string; lien: string; whatsapp: string; qr: string | null } | null> {
  const code = await lireMonCode(client);
  if (!code) return null;
  const lien = lienParrainage(code, options.siteUrl);
  return { code, lien, whatsapp: lienPartageParrainage(langue, lien), qr: options.qr ? adresseDonneesSvg(await qrCodeSvg(lien)) : null };
}

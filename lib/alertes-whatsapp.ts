import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

// US-31.5 : alerte WhatsApp « nouvelles promos » des boutiques suivies (modèle Marketing, accord séparé).
// Éteinte par défaut : la base ne propose la case qu'avec le réglage 'alertes_whatsapp' (voir la migration
// 20261020100000_alertes_whatsapp.sql et docs/architecture.md, « Alerte WhatsApp (US-31.5) »).

type Client = SupabaseClient<Database>;

/** Modèles Meta (Marketing) de l'alerte : français, et arabe une fois approuvé. */
export const MODELES_ALERTE = ["bledeal_nouvelles_promos", "bledeal_nouvelles_promos_ar"] as const;
export function estModeleAlerte(modele: string): boolean {
  return (MODELES_ALERTE as readonly string[]).includes(modele);
}

/** Jeton du lien « Ne plus recevoir » : 48 caractères hexadécimaux (aléatoire, gardé en base). */
const FORMAT_JETON = /^[0-9a-f]{48}$/;
export function jetonAlertesValide(jeton: unknown): jeton is string {
  return typeof jeton === "string" && FORMAT_JETON.test(jeton);
}

/** État pour l'écran : alertes proposées (réglage de la base) et actives pour ce compte. */
export type EtatAlertes = { proposees: boolean; actives: boolean };
export const ETAT_ALERTES_ETEINTES: EtatAlertes = { proposees: false, actives: false };
export function lireEtat(data: unknown): EtatAlertes {
  const v = (data ?? {}) as Record<string, unknown>;
  return { proposees: v.proposees === true, actives: v.actives === true };
}
/** En cas d'erreur : rien n'est proposé (jamais de case affichée par défaut). */
export async function lireEtatAlertes(client: Client): Promise<EtatAlertes> {
  try {
    const { data, error } = await client.rpc("etat_alertes_whatsapp");
    return error ? ETAT_ALERTES_ETEINTES : lireEtat(data);
  } catch { return ETAT_ALERTES_ETEINTES; }
}

/** Le bloc d'accord apparaît après « Suivre » seulement si les alertes sont proposées et pas déjà actives. */
export function proposerApresSuivi(etat: EtatAlertes): boolean {
  return etat.proposees && !etat.actives;
}
/** Bloc « Alertes WhatsApp » de /compte/boutiques : si proposées, ou si actives (on peut toujours les arrêter). */
export function afficherBlocCompte(etat: EtatAlertes): boolean {
  return etat.proposees || etat.actives;
}

export type ErreurAlertes = "connexion" | "nonProposees" | "erreur";
export function erreurAlertes(error: { code?: string } | null | undefined): ErreurAlertes {
  if (error?.code === "42501") return "connexion";
  if (error?.code === "55000") return "nonProposees";
  return "erreur";
}

/** Page du lien : « actives », « desactivees », ou null (lien inconnu). */
export type EtatLien = "actives" | "desactivees" | null;
export function lireEtatLien(data: unknown): EtatLien {
  return data === "actives" || data === "desactivees" ? data : null;
}
export async function lireEtatParLien(client: Client, jeton: string): Promise<EtatLien> {
  if (!jetonAlertesValide(jeton)) return null;
  const { data, error } = await client.rpc("etat_alertes_par_lien", { jeton });
  if (error) throw new Error("Alertes indisponibles.");
  return lireEtatLien(data);
}

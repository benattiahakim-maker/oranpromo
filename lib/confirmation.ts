import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

// US-20.6 : confirmer une commande depuis le message WhatsApp « nouvelle commande » (bouton lien « Confirmer »).
// Lien = <commande>.<expiration en secondes, base 36>.<signature HMAC-SHA256 avec CONFIRMATION_SECRET, base64url>.
// Fabriqué au moment de l'envoi du message, vérifié ici ; jamais stocké. La base exige en plus le secret du serveur.
// Voir docs/architecture.md, « Confirmer depuis WhatsApp (US-20.6) ».

type Client = SupabaseClient<Database>;
type Env = Record<string, string | undefined>;

export const DUREE_LIEN_MS = 24 * 60 * 60 * 1000;
export const MODELE_CONFIRMER = "oranpromo_nouvelle_commande_confirmer";
export const MODELE_SANS_BOUTON = "oranpromo_nouvelle_commande";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MESSAGES_CONFIRMATION = {
  confirmee: "Commande confirmée : le stock est mis à jour. Pensez à la préparer.",
  deja_confirmee: "Cette commande est déjà confirmée.",
  annulee: "Cette commande a été annulée : il n’y a rien à confirmer.",
  expiree: "Cette commande a expiré : il n’y a rien à confirmer.",
  lien_expire: "Ce lien a expiré. Confirmez la commande dans votre espace OranPromo, rubrique Commandes.",
  invalide: "Ce lien n’est pas valide.",
  indisponible: "La confirmation par lien n’est pas disponible pour le moment. Confirmez la commande dans votre espace OranPromo, rubrique Commandes.",
  erreur: "La commande n’a pas pu être confirmée. Réessayez, ou confirmez-la dans votre espace OranPromo.",
} as const;

export function secretConfirmation(env: Env = process.env): string | null {
  const secret = env.CONFIRMATION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function signer(commandeId: string, expiration: string, secret: string): string {
  return createHmac("sha256", secret).update(`confirmer:${commandeId}:${expiration}`).digest("base64url");
}

export function creerLienConfirmation(commandeId: string, secret: string, maintenant: number = Date.now()): string {
  const expiration = Math.floor((maintenant + DUREE_LIEN_MS) / 1000).toString(36);
  return `${commandeId}.${expiration}.${signer(commandeId, expiration, secret)}`;
}

export type LectureLien = { etat: "valide"; commandeId: string } | { etat: "expire" } | { etat: "invalide" };

/** Vérifie la signature d'abord (une date d'expiration modifiée rend le lien invalide), puis l'expiration. */
export function lireLienConfirmation(jeton: string, secret: string, maintenant: number = Date.now()): LectureLien {
  if (typeof jeton !== "string" || jeton.length > 200) return { etat: "invalide" };
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) return { etat: "invalide" };
  const [commandeId, expiration, signature] = morceaux;
  if (!UUID.test(commandeId) || !/^[0-9a-z]{1,10}$/.test(expiration) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return { etat: "invalide" };
  const attendue = Buffer.from(signer(commandeId, expiration, secret));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return { etat: "invalide" };
  if (parseInt(expiration, 36) * 1000 <= maintenant) return { etat: "expire" };
  return { etat: "valide", commandeId };
}

export type LigneAConfirmer = { titre: string; taille: string; quantite: number; prix_unitaire: number };
export type CommandeAConfirmer = {
  numero: number; boutique: string; client: string; statut: Database["public"]["Enums"]["statut_commande"];
  total: number; note: string | null; cree_le: string; lignes: LigneAConfirmer[];
};

export async function lireCommandeAConfirmer(client: Client, commandeId: string, secret: string): Promise<CommandeAConfirmer | null> {
  const { data, error } = await client.rpc("commande_a_confirmer", { jeton: secret, commande: commandeId });
  if (error) throw new Error(MESSAGES_CONFIRMATION.indisponible);
  return (data as CommandeAConfirmer | null) ?? null;
}

export type EtatConfirmation = "confirmee" | "deja_confirmee" | "annulee" | "expiree";
export type ResultatConfirmation = { succes: boolean; etat: EtatConfirmation | "lien_expire" | "invalide" | "stock" | "indisponible" | "erreur"; message: string };

const ETATS: readonly EtatConfirmation[] = ["confirmee", "deja_confirmee", "annulee", "expiree"];

/** Touche « Confirmer la commande » : revérifie le lien, puis confirme avec les règles du bouton du site (base). */
export async function confirmerParLien(client: Client, jeton: string, env: Env = process.env, maintenant: number = Date.now()): Promise<ResultatConfirmation> {
  const secret = secretConfirmation(env);
  if (!secret) return { succes: false, etat: "indisponible", message: MESSAGES_CONFIRMATION.indisponible };
  const lien = lireLienConfirmation(jeton, secret, maintenant);
  if (lien.etat === "expire") return { succes: false, etat: "lien_expire", message: MESSAGES_CONFIRMATION.lien_expire };
  if (lien.etat === "invalide") return { succes: false, etat: "invalide", message: MESSAGES_CONFIRMATION.invalide };
  const { data, error } = await client.rpc("confirmer_commande_par_lien", { jeton: secret, commande: lien.commandeId });
  if (error) {
    if (error.code === "23514" && error.message.startsWith("Stock insuffisant")) return { succes: false, etat: "stock", message: error.message };
    if (error.code === "P0002") return { succes: false, etat: "invalide", message: MESSAGES_CONFIRMATION.invalide };
    if (error.code === "42501") return { succes: false, etat: "indisponible", message: MESSAGES_CONFIRMATION.indisponible };
    return { succes: false, etat: "erreur", message: MESSAGES_CONFIRMATION.erreur };
  }
  const etat = ETATS.find(e => e === data);
  if (!etat) return { succes: false, etat: "erreur", message: MESSAGES_CONFIRMATION.erreur };
  return { succes: etat === "confirmee", etat, message: MESSAGES_CONFIRMATION[etat] };
}

/**
 * Message « nouvelle commande » avec bouton : le 5e paramètre (identifiant de la commande) devient le lien signé,
 * paramètre du bouton. Sans CONFIRMATION_SECRET, on envoie l'ancien modèle sans bouton (aucun message perdu).
 */
export function preparerBoutonConfirmer<M extends { modele: string; parametres: string[]; bouton?: string }>(message: M, secret: string | null, maintenant: number = Date.now()): M {
  if (message.modele !== MODELE_CONFIRMER) return message;
  const [commandeId] = message.parametres.slice(4);
  const corps = message.parametres.slice(0, 4);
  if (!secret || !commandeId || !UUID.test(commandeId)) return { ...message, modele: MODELE_SANS_BOUTON, parametres: corps };
  return { ...message, parametres: corps, bouton: creerLienConfirmation(commandeId, secret, maintenant) };
}

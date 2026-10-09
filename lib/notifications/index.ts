import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { creerFournisseurMeta } from "./meta";
import type { FournisseurWhatsApp, MessageWhatsApp } from "./types";

export type { FournisseurWhatsApp, MessageWhatsApp, ResultatEnvoi } from "./types";

type Env = Record<string, string | undefined>;

/**
 * Fournisseur configuré par les variables d'environnement (serveur seulement), ou null :
 * sans configuration, les messages restent dans la file `messages_whatsapp` (statut a_envoyer) et rien n'est envoyé.
 */
export function fournisseurWhatsApp(env: Env = process.env): FournisseurWhatsApp | null {
  const nom = (env.WHATSAPP_FOURNISSEUR || "meta").trim().toLowerCase();
  if (nom !== "meta") return null; // twilio : prévu, pas encore branché
  const token = env.WHATSAPP_TOKEN?.trim(), phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return creerFournisseurMeta({ token, phoneNumberId, langue: env.WHATSAPP_LANGUE?.trim() || "fr", version: env.WHATSAPP_API_VERSION?.trim() || "v23.0" });
}

type LigneFile = { id: string; reservation: string | null; destinataire: string; modele: string; parametres: unknown; texte: string };

export function lireMessages(lignes: LigneFile[] | null | undefined): MessageWhatsApp[] {
  return (lignes ?? []).filter(l => l.reservation).map(l => ({
    id: l.id, reservation: l.reservation as string, destinataire: l.destinataire, modele: l.modele, texte: l.texte,
    parametres: Array.isArray(l.parametres) ? l.parametres.map(p => String(p ?? "")) : [],
  }));
}

/** Jeton de la tâche d’envoi (CRON_SECRET) : la base l’exige pour enregistrer un résultat (point 5 de la relecture). */
export function jetonNotifications(env: Env = process.env): string | null {
  const jeton = env.CRON_SECRET?.trim();
  return jeton && jeton.length >= 16 ? jeton : null;
}

/** Durée maximale d’un envoi (délai du fournisseur, 10 s chez Meta) plus une marge pour enregistrer le résultat. */
export const DUREE_ENVOI_MAX_MS = 12_000;

export type OptionsEnvoi = {
  /** Heure limite (ms) : aucun envoi ne commence s’il risque de la dépasser. Les messages non envoyés restent réservés 2 minutes puis repartent. */
  finAvant?: number;
  maintenant?: () => number;
};

/** Envoie les messages un par un et enregistre chaque résultat dans la base (avec le jeton du serveur). Ne lève jamais d'erreur. */
export async function envoyerMessages(client: SupabaseClient<Database>, messages: MessageWhatsApp[], fournisseur: FournisseurWhatsApp, jeton: string, options: OptionsEnvoi = {}) {
  const maintenant = options.maintenant ?? Date.now;
  let envoyes = 0, echecs = 0, reportes = 0;
  for (const message of messages) {
    // Arrêt avant la limite de durée de la fonction : un message coupé en plein envoi partirait deux fois.
    if (options.finAvant !== undefined && maintenant() + DUREE_ENVOI_MAX_MS > options.finAvant) { reportes++; continue; }
    let resultat;
    try { resultat = await fournisseur.envoyer(message); }
    catch { resultat = { succes: false as const, erreur: "Erreur d’envoi.", definitif: false }; }
    if (resultat.succes) envoyes++; else echecs++;
    const { error } = await client.rpc("resultat_message_whatsapp", resultat.succes
      ? { jeton, message: message.id, reservation: message.reservation, succes: true, identifiant: resultat.identifiant ?? undefined }
      : { jeton, message: message.id, reservation: message.reservation, succes: false, erreur: resultat.erreur, definitif: resultat.definitif });
    if (error) console.error("WhatsApp : résultat non enregistré", message.id, error.message);
  }
  return { envoyes, echecs, reportes };
}

/**
 * Juste après une action (commande passée, commande prête, client pas venu) : envoie les messages de cette commande.
 * Sans fournisseur ou sans jeton serveur, rien n’est envoyé : les messages restent en file pour la tâche planifiée.
 */
export async function envoyerMessagesCommande(client: SupabaseClient<Database>, commandeId: string, fournisseur = fournisseurWhatsApp(), jeton = jetonNotifications()) {
  if (!fournisseur || !jeton) return { envoyes: 0, echecs: 0, reportes: 0 };
  try {
    const { data, error } = await client.rpc("messages_whatsapp_commande", { commande: commandeId });
    if (error) throw error;
    return await envoyerMessages(client, lireMessages(data), fournisseur, jeton);
  } catch (error) {
    // Les messages restent en attente : la tâche planifiée les reprendra.
    console.error("WhatsApp : envoi après action impossible", error instanceof Error ? error.message : error);
    return { envoyes: 0, echecs: 0, reportes: 0 };
  }
}

/** Messages réservés par appel de la tâche planifiée : 5 × 10 s maximum, sous la limite de 60 s de la fonction. */
export const LIMITE_TACHE = 5;

/** Tâche planifiée : envoie les messages en attente (rappels, blocages, nouvelles tentatives). */
export async function envoyerMessagesEnAttente(client: SupabaseClient<Database>, jeton: string, fournisseur: FournisseurWhatsApp, options: OptionsEnvoi & { limite?: number } = {}) {
  const { data, error } = await client.rpc("messages_whatsapp_en_attente", { jeton, limite: options.limite ?? LIMITE_TACHE });
  if (error) throw new Error(error.code === "42501" ? "Accès refusé." : "File d’attente WhatsApp indisponible.");
  const messages = lireMessages(data);
  return { ...(await envoyerMessages(client, messages, fournisseur, jeton, options)), traites: messages.length };
}

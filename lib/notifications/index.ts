import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { creerFournisseurMeta } from "./meta";
import { preparerBoutonConfirmer, secretConfirmation } from "@/lib/confirmation";
import { jetonRetraitValide } from "@/lib/retrait";
import { estModeleAlerte, jetonAlertesValide } from "@/lib/alertes-whatsapp";
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

/** Messages réservés, prêts à partir. « Nouvelle commande » avec bouton : le lien signé est fabriqué ici (US-20.6). */
export function lireMessages(lignes: LigneFile[] | null | undefined, secret: string | null = secretConfirmation(), maintenant: number = Date.now()): MessageWhatsApp[] {
  return (lignes ?? []).filter(l => l.reservation).map(l => preparerBoutonConfirmer({
    id: l.id, reservation: l.reservation as string, destinataire: l.destinataire, modele: l.modele, texte: l.texte,
    parametres: Array.isArray(l.parametres) ? l.parametres.map(p => String(p ?? "")) : [],
  }, secret, maintenant));
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

export const MODELE_RETRAIT = "oranpromo_commande_prete_retrait";
export const MODELE_PRETE_SANS_BOUTON = "oranpromo_commande_prete";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * US-26.4 : « commande prête » avec le bouton « Mon QR code ». Le 5e paramètre est l'identifiant de la commande ;
 * le jeton de retrait est demandé à la base au moment de l'envoi (avec CRON_SECRET) et sert seulement de paramètre
 * du bouton (https://<domaine>/retrait/<jeton>). Commande plus prête ou jeton absent : ancien modèle sans bouton.
 */
export async function preparerBoutonRetrait(client: SupabaseClient<Database>, message: MessageWhatsApp, jeton: string): Promise<MessageWhatsApp> {
  if (message.modele !== MODELE_RETRAIT) return message;
  const corps = message.parametres.slice(0, 4);
  const commandeId = message.parametres[4];
  const sansBouton = { ...message, modele: MODELE_PRETE_SANS_BOUTON, parametres: corps, bouton: undefined };
  if (!commandeId || !UUID.test(commandeId)) return sansBouton;
  try {
    const { data, error } = await client.rpc("jeton_retrait_envoi", { jeton, commande: commandeId });
    return !error && jetonRetraitValide(data) ? { ...message, parametres: corps, bouton: data } : sansBouton;
  } catch { return sansBouton; }
}

/**
 * US-31.5 : alerte « nouvelles promos » (modèle Marketing). Le 3e paramètre est l'identifiant du compte ; le jeton du
 * lien « Ne plus recevoir » est demandé à la base au moment de l'envoi (avec CRON_SECRET) et sert seulement de
 * paramètre du bouton (https://<domaine>/alertes/<jeton>). Alertes arrêtées entre-temps, jeton absent ou erreur :
 * null, le message ne part pas (jamais d'alerte sans lien de désabonnement).
 */
export async function preparerBoutonAlerte(client: SupabaseClient<Database>, message: MessageWhatsApp, jeton: string): Promise<MessageWhatsApp | null> {
  if (!estModeleAlerte(message.modele)) return message;
  const corps = message.parametres.slice(0, 2);
  const profil = message.parametres[2];
  if (!profil || !UUID.test(profil)) return null;
  try {
    const { data, error } = await client.rpc("jeton_alertes_envoi", { jeton, profil });
    return !error && jetonAlertesValide(data) ? { ...message, parametres: corps, bouton: data } : null;
  } catch { return null; }
}

export const ALERTE_ARRETEE = "Alertes arrêtées ou lien indisponible : non envoyé.";

/** Envoie les messages un par un et enregistre chaque résultat dans la base (avec le jeton du serveur). Ne lève jamais d'erreur. */
export async function envoyerMessages(client: SupabaseClient<Database>, messages: MessageWhatsApp[], fournisseur: FournisseurWhatsApp, jeton: string, options: OptionsEnvoi = {}) {
  const maintenant = options.maintenant ?? Date.now;
  let envoyes = 0, echecs = 0, reportes = 0;
  for (const message of messages) {
    // Arrêt avant la limite de durée de la fonction : un message coupé en plein envoi partirait deux fois.
    if (options.finAvant !== undefined && maintenant() + DUREE_ENVOI_MAX_MS > options.finAvant) { reportes++; continue; }
    let resultat;
    try {
      const pret = await preparerBoutonAlerte(client, await preparerBoutonRetrait(client, message, jeton), jeton);
      resultat = pret ? await fournisseur.envoyer(pret) : { succes: false as const, erreur: ALERTE_ARRETEE, definitif: true };
    }
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

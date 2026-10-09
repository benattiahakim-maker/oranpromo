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

/** Envoie les messages un par un et enregistre chaque résultat dans la base. Ne lève jamais d'erreur. */
export async function envoyerMessages(client: SupabaseClient<Database>, messages: MessageWhatsApp[], fournisseur: FournisseurWhatsApp) {
  let envoyes = 0, echecs = 0;
  for (const message of messages) {
    let resultat;
    try { resultat = await fournisseur.envoyer(message); }
    catch { resultat = { succes: false as const, erreur: "Erreur d’envoi.", definitif: false }; }
    if (resultat.succes) envoyes++; else echecs++;
    const { error } = await client.rpc("resultat_message_whatsapp", resultat.succes
      ? { message: message.id, reservation: message.reservation, succes: true, identifiant: resultat.identifiant ?? undefined }
      : { message: message.id, reservation: message.reservation, succes: false, erreur: resultat.erreur, definitif: resultat.definitif });
    if (error) console.error("WhatsApp : résultat non enregistré", message.id, error.message);
  }
  return { envoyes, echecs };
}

/** Juste après une action (commande passée, commande prête) : envoie les messages de cette commande. */
export async function envoyerMessagesCommande(client: SupabaseClient<Database>, commandeId: string, fournisseur = fournisseurWhatsApp()) {
  if (!fournisseur) return { envoyes: 0, echecs: 0 };
  try {
    const { data, error } = await client.rpc("messages_whatsapp_commande", { commande: commandeId });
    if (error) throw error;
    return await envoyerMessages(client, lireMessages(data), fournisseur);
  } catch (error) {
    // Les messages restent en attente : la tâche planifiée les reprendra.
    console.error("WhatsApp : envoi après action impossible", error instanceof Error ? error.message : error);
    return { envoyes: 0, echecs: 0 };
  }
}

/** Tâche planifiée : envoie tous les messages en attente (rappels, blocages, nouvelles tentatives). */
export async function envoyerMessagesEnAttente(client: SupabaseClient<Database>, jeton: string, fournisseur: FournisseurWhatsApp, limite = 50) {
  const { data, error } = await client.rpc("messages_whatsapp_en_attente", { jeton, limite });
  if (error) throw new Error(error.code === "42501" ? "Accès refusé." : "File d’attente WhatsApp indisponible.");
  const messages = lireMessages(data);
  return { ...(await envoyerMessages(client, messages, fournisseur)), traites: messages.length };
}

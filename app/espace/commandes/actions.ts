"use server";
import { after } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { envoyerMessagesCommande } from "@/lib/notifications";
import { changerStatutCommande, lireCommande, verifierActionBoutique, type MotifBoutique, type StatutCommande } from "@/lib/commandes";
import { boutiqueDuCompte } from "@/lib/gestion-articles";

export type ResultatAction = { succes: boolean; message: string };

export async function changerStatutCommandeBoutique(id: string, statut: StatutCommande, motif: MotifBoutique | null, note: string): Promise<ResultatAction> {
  try {
    if (typeof id !== "string" || typeof statut !== "string" || typeof note !== "string") throw new Error("Demande invalide.");
    const client = await creerClientServeur();
    const boutiqueId = await boutiqueDuCompte(client);
    const commande = await lireCommande(client, id);
    if (!commande || commande.boutique_id !== boutiqueId) throw new Error("Commande introuvable.");
    const refus = verifierActionBoutique(commande.statut, statut, motif);
    if (refus) throw new Error(refus);
    await changerStatutCommande(client, id, statut, { motif: statut === "annulee" ? motif : null, note });
    // « Commande prête » : WhatsApp au client après la réponse (US-20.5).
    if (statut === "prete") after(() => envoyerMessagesCommande(client, id));
    return { succes: true, message: "Commande mise à jour." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de modifier la commande. Réessayez." }; }
}

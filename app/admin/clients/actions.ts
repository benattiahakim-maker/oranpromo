"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { annulerNoShow, bloquerClient, debloquerClient } from "@/lib/clients";
import { verifierAdministrateur } from "@/lib/moderation";

export async function debloquerCompteClient(id: string) {
  try {
    if (typeof id !== "string") throw new Error("Client invalide.");
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    await debloquerClient(client, id);
    return { succes: true, message: "Client débloqué : son compteur repart de 0." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de débloquer ce client. Réessayez." }; }
}

/** Annule un no-show déclaré par une boutique : le compteur baisse, le compte est débloqué sous 5. */
export async function annulerNoShowClient(commandeId: string) {
  try {
    if (typeof commandeId !== "string") throw new Error("Commande invalide.");
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    await annulerNoShow(client, commandeId);
    return { succes: true, message: "No-show annulé." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’annuler ce no-show. Réessayez." }; }
}

/** Relecture n°2 : l’admin bloque un compte (par exemple un numéro partagé par plusieurs comptes). */
export async function bloquerCompteClient(id: string) {
  try {
    if (typeof id !== "string") throw new Error("Client invalide.");
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    await bloquerClient(client, id);
    return { succes: true, message: "Client bloqué : il ne peut plus commander." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de bloquer ce client. Réessayez." }; }
}

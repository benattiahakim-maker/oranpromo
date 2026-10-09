"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { debloquerClient } from "@/lib/clients";
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

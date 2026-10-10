"use server";
import { enLangue } from "@/lib/langue-serveur";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { modifierPositionMaBoutique } from "@/lib/boutique";

export async function deconnecter() {
  const client = await creerClientServeur();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/espace?erreur=deconnexion");
  redirect("/espace/connexion");
}

// US-24.2 : position de ma boutique, tant qu'elle est en attente (deux nombres, ou deux null pour la retirer).
export async function enregistrerPositionMaBoutique(...a: Parameters<typeof enregistrerPositionMaBoutiqueInterne>): Promise<{ succes: boolean; message: string }> { return enLangue(await enregistrerPositionMaBoutiqueInterne(...a)); }
async function enregistrerPositionMaBoutiqueInterne(latitude: number | null, longitude: number | null): Promise<{ succes: boolean; message: string }> {
  try {
    await modifierPositionMaBoutique(await creerClientServeur(), latitude, longitude);
    return { succes: true, message: latitude === null ? "Position retirée." : "Position enregistrée." };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : "Impossible d’enregistrer la position. Réessayez." };
  }
}

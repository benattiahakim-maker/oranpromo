"use server";

// US-29.4 : actions de /admin/villes (admin seulement, vérifié ici et dans la base).
import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/server";
import { changerOuvertureVille, changerVilleAmbassadeur } from "@/lib/villes-admin";

export type ResultatVille = { succes: boolean; message: string };
async function resultat(action: () => Promise<void>, message: string): Promise<ResultatVille> {
  try { await action(); return { succes: true, message }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’effectuer cette action. Réessayez." }; }
}

export async function ouvrirVille(code: string, ouverte: boolean) {
  return resultat(async () => {
    await changerOuvertureVille(await creerClientServeur(), code, ouverte);
    // Le choix des villes, l'accueil, le catalogue et la carte lisent les villes ouvertes à chaque requête.
    revalidatePath("/", "layout");
  }, ouverte ? "Ville ouverte." : "Ville fermée.");
}

export async function definirVilleAmbassadeur(id: string, ville: string | null) {
  return resultat(async () => { await changerVilleAmbassadeur(await creerClientServeur(), id, ville); }, "Ville de l’ambassadeur enregistrée.");
}

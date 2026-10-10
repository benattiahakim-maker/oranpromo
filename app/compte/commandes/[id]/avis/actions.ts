"use server";
import { enLangue } from "@/lib/langue-serveur";
import { creerClientServeur } from "@/lib/supabase/server";
import { donnerAvis, MESSAGES_AVIS } from "@/lib/avis";

export type ResultatAvis = { succes: boolean; message: string };

/** US-32.2 : publier l'avis du client connecté (toutes les règles sont vérifiées par la base). */
export async function donnerMonAvis(commande: string, saisie: unknown): Promise<ResultatAvis> {
  let resultat: ResultatAvis;
  try {
    await donnerAvis(await creerClientServeur(), commande, saisie);
    resultat = { succes: true, message: MESSAGES_AVIS.publie };
  } catch (error) {
    resultat = { succes: false, message: error instanceof Error ? error.message : MESSAGES_AVIS.impossible };
  }
  return enLangue(resultat);
}

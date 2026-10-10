"use server";
import { enLangue, getLangue } from "@/lib/langue-serveur";
import { creerClientServeur } from "@/lib/supabase/server";
import { donnerAvis, messageBonAvis, MESSAGES_AVIS } from "@/lib/avis";
import { traduireMessage } from "@/lib/textes/messages";

export type ResultatAvis = { succes: boolean; message: string; bon?: string };

/** US-32.2 : publier l'avis du client connecté (toutes les règles sont vérifiées par la base).
 *  US-32.5 : « Votre bon de 150 DA est dans votre compte. » quand la base a donné un bon « avis ». */
export async function donnerMonAvis(commande: string, saisie: unknown): Promise<ResultatAvis> {
  let resultat: ResultatAvis;
  try {
    const { bon } = await donnerAvis(await creerClientServeur(), commande, saisie);
    resultat = { succes: true, message: MESSAGES_AVIS.publie };
    if (bon) resultat.bon = traduireMessage(messageBonAvis(bon), await getLangue());
  } catch (error) {
    resultat = { succes: false, message: error instanceof Error ? error.message : MESSAGES_AVIS.impossible };
  }
  return enLangue(resultat);
}

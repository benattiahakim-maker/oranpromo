"use server";
import { enLangue } from "@/lib/langue-serveur";

import { creerClientServeur } from "@/lib/supabase/server";
import { MESSAGES_REPONSE, repondreAvis } from "@/lib/avis";

// US-32.4 : réponse publique de la boutique (une seule, non modifiable ; la base vérifie la boutique et le filtre).
export async function publierReponse(...a: Parameters<typeof publierReponseInterne>): Promise<{ succes: boolean; message: string }> { return enLangue(await publierReponseInterne(...a)); }
async function publierReponseInterne(avisId: string, texte: string): Promise<{ succes: boolean; message: string }> {
  try {
    await repondreAvis(await creerClientServeur(), avisId, texte);
    return { succes: true, message: MESSAGES_REPONSE.publiee };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : MESSAGES_REPONSE.impossible };
  }
}

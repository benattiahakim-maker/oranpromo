"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { confirmerParLien, MESSAGES_CONFIRMATION, type ResultatConfirmation } from "@/lib/confirmation";

// US-20.6 : touche « Confirmer la commande » de la page du lien WhatsApp (sans connexion : le lien signé suffit).
export async function confirmerCommandeDepuisLien(jeton: string): Promise<ResultatConfirmation> {
  try {
    if (typeof jeton !== "string") return { succes: false, etat: "invalide", message: MESSAGES_CONFIRMATION.invalide };
    return await confirmerParLien(await creerClientServeur(), jeton);
  } catch {
    return { succes: false, etat: "erreur", message: MESSAGES_CONFIRMATION.erreur };
  }
}

"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { jetonAlertesValide } from "@/lib/alertes-whatsapp";

// US-31.5 : « Ne plus recevoir » depuis le lien du message WhatsApp, sans connexion. Effet immédiat ; la page affichée
// sert d'accusé de réception (loi 18-05, art. 32). POST seulement (action serveur) : un aperçu de lien ou un robot qui
// ouvre la page ne désabonne personne.
export type ResultatLien = "desactivees" | "invalide" | "erreur";

export async function nePlusRecevoir(jeton: string): Promise<ResultatLien> {
  if (!jetonAlertesValide(jeton)) return "invalide";
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("desactiver_alertes_par_lien", { jeton });
  if (error) return "erreur";
  return data === "desactivees" ? "desactivees" : "invalide";
}

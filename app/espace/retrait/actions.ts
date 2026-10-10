"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { codeRetraitValide, jetonRetraitValide, lireRetraitBoutique, MESSAGE_CODE_FAUX, messageRetraitBoutique, remettreRetrait, type ResumeRetrait } from "@/lib/retrait";

// US-26.3 : actions du scanner de la boutique. La base refait tous les contrôles (boutique connectée, commande de
// cette boutique, prête, date limite). Suivi de la relecture n°6 : la base refuse le code après 20 codes faux en une heure
// (boutique) ou 5 codes faux proches du code d'une commande (cette commande, 15 minutes) ; son message est repris tel quel.
// Le QR code n'est jamais limité. Ces actions sont des POST : la base n'accepte pas le code en lecture seule (GET).

export type ResultatRetrait = { succes: boolean; message: string; resume?: ResumeRetrait };

/** Code à 6 chiffres tapé : résumé affiché dans la page du scanner (le jeton n'est jamais renvoyé au navigateur). */
export async function lireRetraitParCode(code: string): Promise<ResultatRetrait> {
  try {
    if (!codeRetraitValide(code)) return { succes: false, message: "Tapez les 6 chiffres du code." };
    const resume = await lireRetraitBoutique(await creerClientServeur(), { code });
    const message = messageRetraitBoutique(resume, true);
    return message ? { succes: false, message } : { succes: true, message: "", resume };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de lire cette commande. Réessayez." }; }
}

/** « Remis au client » : par le jeton (QR code) ou par le code à 6 chiffres. Ouvrir ou scanner ne remet jamais rien. */
export async function remettreCommandeRetrait(cle: { jeton: string } | { code: string }): Promise<ResultatRetrait> {
  try {
    const parCode = typeof cle === "object" && cle !== null && "code" in cle;
    const valide = parCode ? codeRetraitValide((cle as { code: unknown }).code) : jetonRetraitValide((cle as { jeton?: unknown })?.jeton);
    if (!valide) return { succes: false, message: parCode ? MESSAGE_CODE_FAUX : "Ce QR code n’est pas valide pour votre boutique." };
    const resume = await remettreRetrait(await creerClientServeur(), cle);
    if (resume.etat === "remise") return { succes: true, message: "Commande remise", resume };
    return { succes: false, message: messageRetraitBoutique(resume, parCode) ?? "Impossible de remettre cette commande. Réessayez.", resume };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de remettre cette commande. Réessayez." }; }
}

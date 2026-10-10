"use server";
import { cookies } from "next/headers";
import { enLangue, getLangue } from "@/lib/langue-serveur";
import { creerClientServeur } from "@/lib/supabase/server";
import { choisirParrain as choisirParrainBase, COOKIE_PARRAIN, MESSAGE_PARRAIN_ENREGISTRE, MESSAGE_PARRAIN_IMPOSSIBLE, vouvoyerMessageParrain } from "@/lib/parrainage";

export type ResultatParrain = { succes: boolean; message: string };

// US-27.2 : même message pour tout numéro ou code accepté par la base (on ne révèle jamais qui est inscrit).
async function choisirParrainEnFrancais(saisie: string): Promise<ResultatParrain> {
  try {
    if (typeof saisie !== "string") throw new Error(MESSAGE_PARRAIN_IMPOSSIBLE);
    await choisirParrainBase(await creerClientServeur(), saisie);
    // Le lien d'invitation a servi : on oublie le code gardé par /p/<code>.
    try { (await cookies()).delete(COOKIE_PARRAIN); } catch { /* cookie déjà absent */ }
    return { succes: true, message: MESSAGE_PARRAIN_ENREGISTRE };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : MESSAGE_PARRAIN_IMPOSSIBLE };
  }
}

// `vous` : depuis /compte (vouvoiement) ; les pages du parrainage tutoient.
export async function choisirParrain(saisie: string, vous = false): Promise<ResultatParrain> {
  const resultat = await choisirParrainEnFrancais(saisie);
  if (vous === true && await getLangue() === "fr") return { ...resultat, message: vouvoyerMessageParrain(resultat.message) };
  return enLangue(resultat);
}

"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { envoyerCodeConnexionClient, ErreurCode, MESSAGE_CODE_ENVOYE, verifierCodeConnexionClient } from "@/lib/codes-telephone";
import { cheminSuiteClient } from "@/lib/connexion";

// US-21.2 : connexion du client par numéro et code à 6 chiffres (mode CONNEXION_CLIENT=telephone).
export type ResultatCode = { succes: boolean; message: string; numero?: string; suite?: string };

export async function envoyerCodeConnexion(telephone: string, jetonCaptcha: string | null): Promise<ResultatCode> {
  try {
    const envoi = await envoyerCodeConnexionClient(await creerClientServeur(), telephone, jetonCaptcha);
    return { succes: true, message: MESSAGE_CODE_ENVOYE, numero: envoi.numero };
  } catch (error) {
    return { succes: false, message: error instanceof ErreurCode ? error.message : "Impossible d’envoyer le code. Réessayez dans quelques instants." };
  }
}

export async function verifierCodeConnexion(telephone: string, code: string, suite: string | null): Promise<ResultatCode> {
  try {
    await verifierCodeConnexionClient(await creerClientServeur(), telephone, code);
    return { succes: true, message: "Vous êtes connecté.", suite: cheminSuiteClient(typeof suite === "string" ? suite : null) };
  } catch (error) {
    return { succes: false, message: error instanceof ErreurCode ? error.message : "Impossible de vérifier le code. Réessayez dans quelques instants." };
  }
}

"use server";
import { enLangue } from "@/lib/langue-serveur";

import { headers } from "next/headers";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurSignalement, MESSAGE_SIGNALEMENT_ECHEC, mesurerEvenement, signalerArticle, signalerAvis, type TypeEvenement } from "@/lib/visiteurs";

// Actions des visiteurs (connectés ou non) : mesures de statistiques et signalements, limités par visiteur dans la base.
export async function enregistrerMesure(type: TypeEvenement, boutiqueId: string, articleId?: string, taille?: string): Promise<boolean> {
  try {
    return await mesurerEvenement(await creerClientServeur(), await headers(), { type, boutiqueId, ...(articleId ? { articleId } : {}), ...(taille ? { taille } : {}) });
  } catch { return false; }
}

async function envoyerSignalementEnFrancais(articleId: string, motif: string, commentaire: string): Promise<{ succes: boolean; message: string }> {
  try {
    await signalerArticle(await creerClientServeur(), await headers(), { articleId, motif, commentaire });
    return { succes: true, message: "Merci, nous allons vérifier." };
  } catch (error) {
    return { succes: false, message: error instanceof ErreurSignalement ? error.message : MESSAGE_SIGNALEMENT_ECHEC };
  }
}

// US-23 : message dans la langue du visiteur.
export async function envoyerSignalement(articleId: string, motif: string, commentaire: string): Promise<{ succes: boolean; message: string }> {
  return enLangue(await envoyerSignalementEnFrancais(articleId, motif, commentaire));
}

// US-32.4 : signaler un avis (client, visiteur ou boutique), mêmes limites que pour un article.
export async function envoyerSignalementAvis(avisId: string, motif: string, commentaire: string): Promise<{ succes: boolean; message: string }> {
  let resultat: { succes: boolean; message: string };
  try {
    await signalerAvis(await creerClientServeur(), await headers(), { avisId, motif, commentaire });
    resultat = { succes: true, message: "Merci, nous allons vérifier." };
  } catch (error) {
    resultat = { succes: false, message: error instanceof ErreurSignalement ? error.message : MESSAGE_SIGNALEMENT_ECHEC };
  }
  return enLangue(resultat);
}

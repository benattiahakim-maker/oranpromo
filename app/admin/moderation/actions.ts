"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { ajouterMotInterdit, modererArticle, modererAvis, retirerMotInterdit, type ActionModeration, type ActionModerationAvis } from "@/lib/moderation";

export async function traiterSignalements(articleId: string, ids: string[], action: ActionModeration) {
  try { await modererArticle(await creerClientServeur(), articleId, ids, action); return { succes: true, message: "Décisions enregistrées." }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de traiter les signalements. Réessayez." }; }
}

// US-32.4 : modération d'un avis signalé (masquer l'avis, masquer la réponse, classer), en une transaction dans la base.
export async function traiterSignalementsAvis(avisId: string, ids: string[], action: ActionModerationAvis) {
  try { await modererAvis(await creerClientServeur(), avisId, ids, action); return { succes: true, message: "Décisions enregistrées." }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de traiter les signalements. Réessayez." }; }
}

// Mots interdits du filtre des avis (onglet « Mots interdits ») : admin seulement, vérifié dans la base.
export async function ajouterMot(mot: string) {
  try { const enregistre = await ajouterMotInterdit(await creerClientServeur(), mot); return { succes: true, message: `« ${enregistre} » ajouté à la liste.` }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’ajouter ce mot. Réessayez." }; }
}
export async function retirerMot(mot: string) {
  try { await retirerMotInterdit(await creerClientServeur(), mot); return { succes: true, message: `« ${mot} » retiré de la liste.` }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de retirer ce mot. Réessayez." }; }
}

"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { modererArticle, type ActionModeration } from "@/lib/moderation";

export async function traiterSignalements(articleId: string, ids: string[], action: ActionModeration) {
  try { await modererArticle(await creerClientServeur(), articleId, ids, action); return { succes: true, message: "Décisions enregistrées." }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de traiter les signalements. Réessayez." }; }
}

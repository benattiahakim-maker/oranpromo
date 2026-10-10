"use server";

import { creerClientServeur } from "@/lib/supabase/server";
import { changerStatutBoutique, changerVilleBoutique, creerBoutique, ErreurValidationBoutique, modifierPositionBoutiqueAdmin, rattacherCommercant, type ErreursBoutique, type SaisieBoutique } from "@/lib/boutique";
import type { Enums } from "@/lib/supabase/types";

export type ResultatBoutique = { succes: boolean; message: string; erreurs?: ErreursBoutique };
async function resultat(action: () => Promise<void>, message: string): Promise<ResultatBoutique> {
  try { await action(); return { succes: true, message }; }
  catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’effectuer cette action. Réessayez.", ...(error instanceof ErreurValidationBoutique ? { erreurs: error.champs } : {}) }; }
}
export async function ajouterBoutique(saisie: SaisieBoutique) {
  return resultat(async () => { await creerBoutique(await creerClientServeur(), saisie); }, "Boutique créée, en attente de validation.");
}
export async function modifierStatutBoutique(id: string, statut: Enums<"statut_boutique">) {
  return resultat(async () => { await changerStatutBoutique(await creerClientServeur(), id, statut); }, "Statut enregistré.");
}
export async function rattacherCompteBoutique(id: string, email: string) {
  return resultat(async () => { await rattacherCommercant(await creerClientServeur(), id, email); }, "Compte du commerçant rattaché.");
}
// US-24.2 : position d'une boutique (deux nombres, ou deux null pour la retirer).
export async function modifierPositionBoutique(id: string, latitude: number | null, longitude: number | null) {
  return resultat(async () => { await modifierPositionBoutiqueAdmin(await creerClientServeur(), id, latitude, longitude); }, latitude === null ? "Position retirée." : "Position enregistrée.");
}
// US-29.4 : l'admin change la ville d'une boutique (la base revérifie la position dans les bornes de la nouvelle ville).
export async function changerVilleBoutiqueAdmin(id: string, ville: string) {
  return resultat(async () => { await changerVilleBoutique(await creerClientServeur(), id, ville); }, "Ville enregistrée.");
}

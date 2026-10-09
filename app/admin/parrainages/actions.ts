"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { annulerBons, exclureDuParrainage, reglerBudget, retirerBoutique, validerMontantBudget } from "@/lib/parrainage-admin";

// US-27.5 : actions admin du parrainage. Les règles (admin seulement, motif, bons utilisés intouchables) sont dans la base.
type Resultat = { succes: boolean; message: string };
async function agir(defaut: string, action: (client: Awaited<ReturnType<typeof creerClientServeur>>) => Promise<string>): Promise<Resultat> {
  try {
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    return { succes: true, message: await action(client) };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : defaut }; }
}
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const identifiant = (v: unknown, erreur: string) => { if (typeof v !== "string" || !v) throw new Error(erreur); return v; };

export async function reglerBudgetParrainage(saisie: string): Promise<Resultat> {
  return agir("Impossible d’enregistrer le budget. Réessayez.", async client => {
    const montant = validerMontantBudget(texte(saisie));
    await reglerBudget(client, montant);
    return montant === 0 ? "Budget à 0 : aucun nouveau bon ne sera créé." : "Budget enregistré.";
  });
}

export async function annulerBonsParrainage(filleul: string, motif: string): Promise<Resultat> {
  return agir("Impossible d’annuler les bons. Réessayez.", async client => {
    const n = await annulerBons(client, identifiant(filleul, "Parrainage invalide."), texte(motif));
    return n ? `${n} bon${n > 1 ? "s" : ""} annulé${n > 1 ? "s" : ""}.` : "Parrainage annulé (aucun bon à annuler).";
  });
}

export async function exclureCompteDuParrainage(profil: string, exclu: boolean): Promise<Resultat> {
  return agir("Impossible de modifier l’exclusion. Réessayez.", async client => {
    await exclureDuParrainage(client, identifiant(profil, "Compte invalide."), exclu === true);
    return exclu === true ? "Compte exclu du parrainage." : "Compte de nouveau admis au parrainage.";
  });
}

export async function retirerBoutiqueDesBons(boutique: string, retiree: boolean): Promise<Resultat> {
  return agir("Impossible de modifier la boutique. Réessayez.", async client => {
    await retirerBoutique(client, identifiant(boutique, "Boutique invalide."), retiree === true);
    return retiree === true ? "Boutique retirée des bons : ses nouvelles commandes ne peuvent plus porter de bon. Prévenez-la." : "Boutique de nouveau acceptée pour les bons.";
  });
}

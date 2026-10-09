"use server";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { contesterNoShow, enregistrerProfilClient, ErreurValidationProfil, type ErreursProfilClient, type SaisieProfilClient } from "@/lib/clients";
import { annulerCommandeClient } from "@/lib/commandes";

export type ResultatCompte = { succes: boolean; message: string; erreurs?: ErreursProfilClient };

export async function enregistrerProfil(saisie: SaisieProfilClient): Promise<ResultatCompte> {
  try {
    if (!saisie || typeof saisie.nom !== "string" || typeof saisie.telephone !== "string") throw new Error("Vérifiez votre nom et votre numéro.");
    await enregistrerProfilClient(await creerClientServeur(), { nom: saisie.nom, telephone: saisie.telephone });
    return { succes: true, message: "Profil enregistré." };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : "Impossible d’enregistrer votre profil. Réessayez.", ...(error instanceof ErreurValidationProfil ? { erreurs: error.champs } : {}) };
  }
}

export async function annulerMaCommande(id: string, note: string): Promise<ResultatCompte> {
  try {
    if (typeof id !== "string" || typeof note !== "string") throw new Error("Commande invalide.");
    await annulerCommandeClient(await creerClientServeur(), id, note);
    return { succes: true, message: "Commande annulée." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’annuler la commande. Réessayez." }; }
}

/** Contester un no-show déclaré par la boutique (motif court, une fois par no-show). */
export async function contesterMonNoShow(id: string, motif: string): Promise<ResultatCompte> {
  try {
    if (typeof id !== "string" || typeof motif !== "string") throw new Error("Contestation invalide.");
    await contesterNoShow(await creerClientServeur(), id, motif);
    return { succes: true, message: "Contestation envoyée : OranPromo va l’examiner. En attendant, cette commande ne compte pas dans vos commandes non récupérées." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’envoyer votre contestation. Réessayez." }; }
}

export async function deconnecterClient() {
  const client = await creerClientServeur();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/compte?erreur=deconnexion");
  redirect("/");
}

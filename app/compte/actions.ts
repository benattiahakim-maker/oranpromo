"use server";
import { enLangue } from "@/lib/langue-serveur";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { contesterNoShow, enregistrerNomClient, enregistrerProfilClient, ErreurValidationProfil, type ErreursProfilClient, type SaisieProfilClient } from "@/lib/clients";
import { annulerCommandeClient } from "@/lib/commandes";
import { envoyerCodeVerificationClient, ErreurCode, MESSAGE_CODE_ENVOYE, verifierCodeVerificationClient } from "@/lib/codes-telephone";

export type ResultatCompte = { succes: boolean; message: string; erreurs?: ErreursProfilClient };

async function enregistrerProfilEnFrancais(saisie: SaisieProfilClient): Promise<ResultatCompte> {
  try {
    if (!saisie || typeof saisie.nom !== "string" || typeof saisie.telephone !== "string") throw new Error("Vérifiez votre nom et votre numéro.");
    await enregistrerProfilClient(await creerClientServeur(), { nom: saisie.nom, telephone: saisie.telephone });
    return { succes: true, message: "Profil enregistré." };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : "Impossible d’enregistrer votre profil. Réessayez.", ...(error instanceof ErreurValidationProfil ? { erreurs: error.champs } : {}) };
  }
}

/** Mode téléphone ou numéro déjà vérifié : seul le nom se modifie ici (le numéro change par code). */
async function enregistrerNomEnFrancais(nom: string): Promise<ResultatCompte> {
  try {
    if (typeof nom !== "string") throw new Error("Vérifiez votre nom.");
    await enregistrerNomClient(await creerClientServeur(), nom);
    return { succes: true, message: "Profil enregistré." };
  } catch (error) {
    return { succes: false, message: error instanceof Error ? error.message : "Impossible d’enregistrer votre profil. Réessayez.", ...(error instanceof ErreurValidationProfil ? { erreurs: error.champs } : {}) };
  }
}

/** US-21.2 : vérifier le numéro d'un compte déjà connecté (compte e-mail, ou changement de numéro). */
export async function envoyerCodeVerification(telephone: string): Promise<ResultatCompte & { numero?: string }> {
  try {
    const envoi = await envoyerCodeVerificationClient(await creerClientServeur(), telephone);
    return { succes: true, message: MESSAGE_CODE_ENVOYE, numero: envoi.numero };
  } catch (error) {
    return { succes: false, message: error instanceof ErreurCode ? error.message : "Impossible d’envoyer le code. Réessayez dans quelques instants." };
  }
}

async function verifierCodeVerificationEnFrancais(telephone: string, code: string): Promise<ResultatCompte> {
  try {
    await verifierCodeVerificationClient(await creerClientServeur(), telephone, code);
    return { succes: true, message: "Numéro vérifié." };
  } catch (error) {
    return { succes: false, message: error instanceof ErreurCode ? error.message : "Impossible de vérifier le code. Réessayez dans quelques instants." };
  }
}

async function annulerMaCommandeEnFrancais(id: string, note: string): Promise<ResultatCompte> {
  try {
    if (typeof id !== "string" || typeof note !== "string") throw new Error("Commande invalide.");
    await annulerCommandeClient(await creerClientServeur(), id, note);
    return { succes: true, message: "Commande annulée." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’annuler la commande. Réessayez." }; }
}

/** Contester un no-show déclaré par la boutique (motif court, une fois par no-show). */
async function contesterMonNoShowEnFrancais(id: string, motif: string): Promise<ResultatCompte> {
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

// US-23 : messages dans la langue du visiteur.
export async function enregistrerProfil(saisie: SaisieProfilClient): Promise<ResultatCompte> {
  return enLangue(await enregistrerProfilEnFrancais(saisie));
}

export async function enregistrerNom(nom: string): Promise<ResultatCompte> {
  return enLangue(await enregistrerNomEnFrancais(nom));
}

export async function verifierCodeVerification(telephone: string, code: string): Promise<ResultatCompte> {
  return enLangue(await verifierCodeVerificationEnFrancais(telephone, code));
}

export async function annulerMaCommande(id: string, note: string): Promise<ResultatCompte> {
  return enLangue(await annulerMaCommandeEnFrancais(id, note));
}

export async function contesterMonNoShow(id: string, motif: string): Promise<ResultatCompte> {
  return enLangue(await contesterMonNoShowEnFrancais(id, motif));
}

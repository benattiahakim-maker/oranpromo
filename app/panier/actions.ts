"use server";
import { enLangue, getLangue } from "@/lib/langue-serveur";
import { after } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { envoyerMessagesCommande } from "@/lib/notifications";
import { definirLangueCommande, passerCommande, type LigneEnvoyee } from "@/lib/commandes";
import { LIGNES_PANIER_MAX, NOTE_COMMANDE_MAX, QUANTITE_LIGNE_MAX } from "@/lib/panier";

export type ResultatCommande = { id?: string; erreur?: string; connexion?: boolean };

function lignesValides(lignes: unknown): lignes is LigneEnvoyee[] {
  return Array.isArray(lignes) && lignes.length >= 1 && lignes.length <= LIGNES_PANIER_MAX && lignes.every(l => l && typeof l === "object"
    && typeof l.article_id === "string" && l.article_id.length <= 64 && typeof l.taille === "string" && l.taille.length <= 40
    && Number.isInteger(l.quantite) && l.quantite >= 1 && l.quantite <= QUANTITE_LIGNE_MAX);
}

async function commanderPanierEnFrancais(boutiqueId: string, lignes: LigneEnvoyee[], note: string): Promise<ResultatCommande> {
  try {
    if (typeof boutiqueId !== "string" || !lignesValides(lignes)) return { erreur: "Votre panier est invalide : videz-le et réessayez." };
    if (typeof note !== "string" || note.trim().length > NOTE_COMMANDE_MAX) return { erreur: `La note pour la boutique doit faire ${NOTE_COMMANDE_MAX} caractères au plus.` };
    const client = await creerClientServeur();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return { connexion: true, erreur: "Connectez-vous pour commander." };
    const id = await passerCommande(client, boutiqueId, lignes.map(l => ({ article_id: l.article_id, taille: l.taille, quantite: l.quantite })), note);
    // US-23 : commande passée en arabe → messages au client en arabe (si les modèles arabes sont approuvés).
    // Un échec ne bloque pas la commande : les messages partiront en français.
    if (await getLangue() === "ar") {
      try { await definirLangueCommande(client, id, "ar"); }
      catch (erreurLangue) { console.error("Langue de la commande non enregistrée", id, erreurLangue instanceof Error ? erreurLangue.message : erreurLangue); }
    }
    // WhatsApp à la boutique après la réponse (US-20.5) ; sans configuration, le message reste en file d'attente.
    after(() => envoyerMessagesCommande(client, id));
    return { id };
  } catch (error) { return { erreur: error instanceof Error ? error.message : "Impossible d’envoyer la commande. Réessayez." }; }
}

// US-23 : messages dans la langue du visiteur.
export async function commanderPanier(boutiqueId: string, lignes: LigneEnvoyee[], note: string): Promise<ResultatCommande> {
  return enLangue(await commanderPanierEnFrancais(boutiqueId, lignes, note));
}

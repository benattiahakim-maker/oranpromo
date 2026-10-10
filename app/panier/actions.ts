"use server";
import { enLangue, getLangue } from "@/lib/langue-serveur";
import { after } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { envoyerMessagesCommande } from "@/lib/notifications";
import { definirLangueCommande, passerCommande, type LigneEnvoyee } from "@/lib/commandes";
import { LIGNES_PANIER_MAX, NOTE_COMMANDE_MAX, QUANTITE_LIGNE_MAX } from "@/lib/panier";
import { raisonBonNonApplique, utiliserBon, type RaisonBonNonApplique } from "@/lib/bons";
import { acceptationCouvre, accepterDocuments, documentsValides, lireDocumentsAAccepter, MESSAGE_CONDITIONS_A_ACCEPTER, MESSAGE_CONDITIONS_CHANGEES, type DocumentAAccepter } from "@/lib/acceptations";

/** bon : raison si le bon coché n'a pas pu être posé (la commande reste valable, au prix plein). */
/** conditions : des textes restent à accepter (US-34.2) ; la page se recharge pour les montrer. */
export type ResultatCommande = { id?: string; erreur?: string; connexion?: boolean; bon?: RaisonBonNonApplique; conditions?: boolean };

function lignesValides(lignes: unknown): lignes is LigneEnvoyee[] {
  return Array.isArray(lignes) && lignes.length >= 1 && lignes.length <= LIGNES_PANIER_MAX && lignes.every(l => l && typeof l === "object"
    && typeof l.article_id === "string" && l.article_id.length <= 64 && typeof l.taille === "string" && l.taille.length <= 40
    && Number.isInteger(l.quantite) && l.quantite >= 1 && l.quantite <= QUANTITE_LIGNE_MAX);
}

async function commanderPanierEnFrancais(boutiqueId: string, lignes: LigneEnvoyee[], note: string, avecBon: boolean, accepter: unknown): Promise<ResultatCommande> {
  try {
    if (typeof boutiqueId !== "string" || !lignesValides(lignes)) return { erreur: "Votre panier est invalide : videz-le et réessayez." };
    if (typeof note !== "string" || note.trim().length > NOTE_COMMANDE_MAX) return { erreur: `La note pour la boutique doit faire ${NOTE_COMMANDE_MAX} caractères au plus.` };
    const client = await creerClientServeur();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return { connexion: true, erreur: "Connectez-vous pour commander." };
    // US-34.2 : nouvelle version importante (ou compte créé avant US-34) : l'accord coché au panier, dans la version
    // affichée, est enregistré avant la commande ; sans lui, pas de commande. passer_commande ne change pas.
    const aAccepter = await lireDocumentsAAccepter(client);
    if (aAccepter.length > 0) {
      const acceptes = documentsValides(accepter);
      if (!acceptes || acceptes.length === 0) return { conditions: true, erreur: MESSAGE_CONDITIONS_A_ACCEPTER };
      if (!acceptationCouvre(aAccepter, acceptes)) return { conditions: true, erreur: MESSAGE_CONDITIONS_CHANGEES };
      await accepterDocuments(client, aAccepter, "commande");
    }
    const id = await passerCommande(client, boutiqueId, lignes.map(l => ({ article_id: l.article_id, taille: l.taille, quantite: l.quantite })), note);
    // US-23 : commande passée en arabe → messages au client en arabe (si les modèles arabes sont approuvés).
    // Un échec ne bloque pas la commande : les messages partiront en français.
    if (await getLangue() === "ar") {
      try { await definirLangueCommande(client, id, "ar"); }
      catch (erreurLangue) { console.error("Langue de la commande non enregistrée", id, erreurLangue instanceof Error ? erreurLangue.message : erreurLangue); }
    }
    // US-27.4 : bon parrainage posé juste après la commande (jamais dans passer_commande), avant l'envoi du message
    // à la boutique pour que celui-ci annonce le montant à encaisser. Un échec garde la commande au prix plein.
    let bon: RaisonBonNonApplique | undefined;
    if (avecBon === true) {
      const resultat = await utiliserBon(client, id);
      if (resultat !== "applique") bon = raisonBonNonApplique(resultat) ?? "erreur"; // US-33.1 : raisons nouvelles → message générique
    }
    // WhatsApp à la boutique après la réponse (US-20.5) ; sans configuration, le message reste en file d'attente.
    after(() => envoyerMessagesCommande(client, id));
    return bon ? { id, bon } : { id };
  } catch (error) { return { erreur: error instanceof Error ? error.message : "Impossible d’envoyer la commande. Réessayez." }; }
}

// US-23 : messages dans la langue du visiteur.
export async function commanderPanier(boutiqueId: string, lignes: LigneEnvoyee[], note: string, avecBon = false, accepter: DocumentAAccepter[] = []): Promise<ResultatCommande> {
  return enLangue(await commanderPanierEnFrancais(boutiqueId, lignes, note, avecBon, accepter));
}

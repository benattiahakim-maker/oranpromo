"use server";
import { enLangue } from "@/lib/langue-serveur";
import { after } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { envoyerMessagesCommande } from "@/lib/notifications";
import { changerStatutCommande, declarerNoShow, ETAPES_NORMALES, STATUTS_COMMANDE, lireCommande, peutDeclarerNoShow, verifierActionBoutique, type MotifBoutique, type StatutCommande } from "@/lib/commandes";
import { lireDemandeGroupee, type ResultatGroupe } from "@/lib/tableau-commandes";
import { boutiqueDuCompte } from "@/lib/gestion-articles";
import { NOTE_REMISE_SANS_QR } from "@/lib/retrait";

export type ResultatAction = { succes: boolean; message: string };

export async function changerStatutCommandeBoutique(...a: Parameters<typeof changerStatutCommandeBoutiqueInterne>): Promise<ResultatAction> { return enLangue(await changerStatutCommandeBoutiqueInterne(...a)); }
async function changerStatutCommandeBoutiqueInterne(id: string, statut: StatutCommande, motif: MotifBoutique | null, note: string): Promise<ResultatAction> {
  try {
    if (typeof id !== "string" || typeof statut !== "string" || typeof note !== "string") throw new Error("Demande invalide.");
    const client = await creerClientServeur();
    const boutiqueId = await boutiqueDuCompte(client);
    const commande = await lireCommande(client, id);
    if (!commande || commande.boutique_id !== boutiqueId) throw new Error("Commande introuvable.");
    const refus = verifierActionBoutique(commande.statut, statut, motif);
    if (refus) throw new Error(refus);
    // US-26.3 : le bouton manuel devient « Remis sans QR code » ; le suivi le dit (la base pose mode_remise = 'manuel').
    await changerStatutCommande(client, id, statut, { motif: statut === "annulee" ? motif : null, note: statut === "recuperee" ? NOTE_REMISE_SANS_QR : note });
    // « Commande prête » : WhatsApp au client après la réponse (US-20.5).
    if (statut === "prete") after(() => envoyerMessagesCommande(client, id));
    return { succes: true, message: "Commande mise à jour." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de modifier la commande. Réessayez." }; }
}

/** « Client pas venu » (relecture point 11, option C) : compte un no-show et avertit le client par WhatsApp. */
export async function declarerClientPasVenu(...a: Parameters<typeof declarerClientPasVenuInterne>): Promise<ResultatAction> { return enLangue(await declarerClientPasVenuInterne(...a)); }
async function declarerClientPasVenuInterne(id: string): Promise<ResultatAction> {
  try {
    if (typeof id !== "string") throw new Error("Demande invalide.");
    const client = await creerClientServeur();
    const boutiqueId = await boutiqueDuCompte(client);
    const commande = await lireCommande(client, id);
    if (!commande || commande.boutique_id !== boutiqueId) throw new Error("Commande introuvable.");
    if (!peutDeclarerNoShow(commande, Date.now())) throw new Error("« Client pas venu » est possible seulement quand la commande prête n’a pas été récupérée dans les 24 heures.");
    await declarerNoShow(client, id);
    after(() => envoyerMessagesCommande(client, id));
    return { succes: true, message: "C’est noté : le client est averti." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de signaler ce client. Réessayez." }; }
}

/**
 * US-28.2 : « Confirmer » ou « Marquer prêtes » sur plusieurs commandes (20 au plus).
 * Une seule action serveur (Next.js envoie les actions une à la fois depuis le navigateur) ;
 * chaque commande passe, de la plus ancienne à la plus récente, par les mêmes contrôles que le bouton d'une commande
 * et par la même fonction de la base (`changer_statut_commande`), dans sa propre transaction : un refus n'annule pas les autres.
 */
export async function changerStatutCommandesBoutique(...a: Parameters<typeof changerStatutCommandesBoutiqueInterne>): Promise<ResultatGroupe> { return enLangue(await changerStatutCommandesBoutiqueInterne(...a)); }
async function changerStatutCommandesBoutiqueInterne(ids: unknown, statut: unknown): Promise<ResultatGroupe> {
  try {
    const demande = lireDemandeGroupee(ids, statut);
    if ("refus" in demande) return { succes: false, message: demande.refus, reussies: [], echecs: [] };
    const client = await creerClientServeur();
    const boutiqueId = await boutiqueDuCompte(client);
    const { data, error } = await client.from("commandes").select("id, numero, boutique_id, statut, cree_le").in("id", demande.ids);
    if (error) throw new Error("Impossible de modifier les commandes. Réessayez.");
    const lues = new Map(((data ?? []) as { id: string; numero: number; boutique_id: string; statut: StatutCommande; cree_le: string }[]).map(c => [c.id, c]));
    // La plus ancienne d'abord : pour le stock, la première arrivée est servie d'abord.
    const cle = (id: string) => Date.parse(lues.get(id)?.cree_le ?? "") || Number.MAX_SAFE_INTEGER; // inconnues à la fin
    const ordre = [...demande.ids].sort((a, b) => cle(a) - cle(b));
    const resultat: ResultatGroupe = { succes: true, message: "", reussies: [], echecs: [] };
    for (const id of ordre) {
      const commande = lues.get(id);
      if (!commande || commande.boutique_id !== boutiqueId) { resultat.echecs.push({ id, numero: commande?.numero ?? null, message: "Commande introuvable.", deja: false }); continue; }
      // Changée entre-temps (autre appareil, lien WhatsApp, expiration) : « déjà confirmée », « annulée »…
      const deja = ETAPES_NORMALES.indexOf(commande.statut) >= ETAPES_NORMALES.indexOf(demande.statut);
      if (deja) { resultat.echecs.push({ id, numero: commande.numero, message: "", deja: true }); continue; }
      if (commande.statut === "annulee" || commande.statut === "expiree") { resultat.echecs.push({ id, numero: commande.numero, message: `la commande est ${STATUTS_COMMANDE[commande.statut].toLowerCase()}.`, deja: false }); continue; }
      const refus = verifierActionBoutique(commande.statut, demande.statut, null);
      if (refus) { resultat.echecs.push({ id, numero: commande.numero, message: refus, deja: false }); continue; }
      try {
        await changerStatutCommande(client, id, demande.statut);
        resultat.reussies.push({ id, numero: commande.numero });
      } catch (erreur) {
        resultat.echecs.push({ id, numero: commande.numero, message: erreur instanceof Error ? erreur.message : "Impossible de modifier la commande. Réessayez.", deja: false });
      }
    }
    // « Commande prête » : WhatsApp au client après la réponse, seulement pour les commandes devenues prêtes (US-20.5).
    if (demande.statut === "prete" && resultat.reussies.length) {
      const pretes = resultat.reussies.map(r => r.id);
      after(async () => { for (const id of pretes) await envoyerMessagesCommande(client, id); });
    }
    return resultat;
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de modifier les commandes. Réessayez.", reussies: [], echecs: [] }; }
}

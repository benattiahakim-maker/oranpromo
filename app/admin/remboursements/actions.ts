"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { deciderLigne, marquerPaye, mettreDeCote } from "@/lib/parrainage-admin";

// US-27.5 : relevés des boutiques. Un relevé payé est figé par la base.
type Resultat = { succes: boolean; message: string };
async function agir(defaut: string, action: (client: Awaited<ReturnType<typeof creerClientServeur>>) => Promise<string>): Promise<Resultat> {
  try {
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    return { succes: true, message: await action(client) };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : defaut }; }
}
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const identifiant = (v: unknown) => { if (typeof v !== "string" || !v) throw new Error("Ligne ou relevé invalide."); return v; };

export async function mettreLigneDeCote(ligne: string, motif: string): Promise<Resultat> {
  return agir("Impossible de mettre cette ligne de côté. Réessayez.", async client => {
    await mettreDeCote(client, identifiant(ligne), texte(motif));
    return "Ligne mise de côté : elle sort du relevé à payer et attend une décision.";
  });
}

export async function deciderLigneDeCote(ligne: string, decision: string, motif: string): Promise<Resultat> {
  return agir("Impossible d’enregistrer la décision. Réessayez.", async client => {
    if (decision !== "rembourser" && decision !== "refuser") throw new Error("Décision inconnue : rembourser ou refuser.");
    await deciderLigne(client, identifiant(ligne), decision, texte(motif));
    return decision === "rembourser" ? "Ligne remise à rembourser (relevé en cours de la boutique)." : "Ligne refusée : elle ne sera pas remboursée.";
  });
}

export async function marquerRelevePaye(releve: string, reference: string, payeLe: string): Promise<Resultat> {
  return agir("Impossible de marquer ce relevé comme payé. Réessayez.", async client => {
    await marquerPaye(client, identifiant(releve), texte(reference), texte(payeLe));
    return "Relevé marqué comme payé. Il n’est plus modifiable.";
  });
}

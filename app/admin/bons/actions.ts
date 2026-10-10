"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { arreterProgramme, creerCampagne, validerCampagne, type SaisieCampagne } from "@/lib/bons-admin";
import { listerVilles } from "@/lib/villes-admin";

// US-33.5 : créer une campagne, arrêter un programme (admin seulement ; la base vérifie aussi).
type Resultat = { succes: boolean; message: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texte = (v: unknown) => (typeof v === "string" ? v : "");

export async function creerCampagneAdmin(saisie: SaisieCampagne): Promise<Resultat> {
  try {
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    const propre: SaisieCampagne = { nom_fr: texte(saisie?.nom_fr), nom_ar: texte(saisie?.nom_ar), code: texte(saisie?.code), montant: texte(saisie?.montant),
      minimum: texte(saisie?.minimum), univers: texte(saisie?.univers), villes: Array.isArray(saisie?.villes) ? saisie.villes.filter(v => typeof v === "string") : [],
      debut: texte(saisie?.debut), fin: texte(saisie?.fin), validite: texte(saisie?.validite), budget: texte(saisie?.budget), plafond: texte(saisie?.plafond) };
    const verifie = validerCampagne(propre, (await listerVilles(client)).map(v => v.code));
    if ("erreur" in verifie) return { succes: false, message: verifie.erreur };
    await creerCampagne(client, verifie.args);
    return { succes: true, message: `Campagne ${verifie.args.nom_fr} créée (code ${verifie.args.code}).` };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible de créer la campagne. Réessayez." }; }
}

export async function arreterProgrammeAdmin(programme: string): Promise<Resultat> {
  try {
    if (typeof programme !== "string" || !UUID.test(programme)) return { succes: false, message: "Programme invalide." };
    const client = await creerClientServeur();
    await verifierAdministrateur(client);
    return await arreterProgramme(client, programme)
      ? { succes: true, message: "Arrêté : plus aucun nouveau bon. Les bons déjà donnés restent valables jusqu’à leur échéance." }
      : { succes: false, message: "Ce programme est déjà arrêté." };
  } catch (error) { return { succes: false, message: error instanceof Error ? error.message : "Impossible d’arrêter ce programme. Réessayez." }; }
}

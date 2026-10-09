// US-28.1 : tableau des commandes de la boutique (étapes, urgence, recherche).
// Lectures avec le client de la session : les règles RLS limitent déjà la boutique à ses commandes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STATUTS_COMMANDE, type CommandeRecue, type StatutCommande } from "@/lib/commandes";

export type EtapeCommande = "a_confirmer" | "a_preparer" | "pretes" | "terminees";
export const ORDRE_ETAPES: EtapeCommande[] = ["a_confirmer", "a_preparer", "pretes", "terminees"];
export const ETAPES: Record<EtapeCommande, { statuts: StatutCommande[]; libelle: string; vide: string; heure: string }> = {
  a_confirmer: { statuts: ["demandee"], libelle: "À confirmer", vide: "Aucune commande à confirmer.", heure: "Reçue" },
  a_preparer: { statuts: ["confirmee"], libelle: "À préparer", vide: "Aucune commande à préparer.", heure: "Confirmée" },
  pretes: { statuts: ["prete"], libelle: "Prêtes", vide: "Aucune commande prête.", heure: "Prête" },
  terminees: { statuts: ["recuperee", "annulee", "expiree"], libelle: "Terminées", vide: "Aucune commande terminée ces 7 derniers jours.", heure: "Terminée" },
};
export type CompteursEtapes = Record<EtapeCommande, number>;

/** Seuils du rouge (décision 1 du propriétaire, 9/10). */
export const SEUIL_CONFIRMER_MIN = 30;
export const SEUIL_PREPARER_MIN = 120;
export const SEUIL_PRETE_MIN = 180;
export const JOURS_TERMINEES = 7;
export const LIGNES_PAR_ETAPE = 100;
export const RESULTATS_RECHERCHE = 50;
export const RECHERCHE_MAX = 40;

const FUSEAU = "Africa/Algiers";
const MINUTE = 60_000;

export function etapeDeStatut(statut: StatutCommande): EtapeCommande {
  return ORDRE_ETAPES.find(e => ETAPES[e].statuts.includes(statut)) ?? "terminees";
}

/** `?etape=` ; l’ancienne adresse `?vue=terminees` mène à « Terminées » ; sinon null (étape par défaut). */
export function lireEtape(params: { etape?: string | string[]; vue?: string | string[] }): EtapeCommande | null {
  const etape = typeof params.etape === "string" ? params.etape : "";
  if ((ORDRE_ETAPES as string[]).includes(etape)) return etape as EtapeCommande;
  return params.vue === "terminees" ? "terminees" : null;
}

/** Décision 10 : la première étape non vide parmi À confirmer, À préparer, Prêtes ; sinon À confirmer. */
export function etapeParDefaut(compteurs: CompteursEtapes): EtapeCommande {
  return (["a_confirmer", "a_preparer", "pretes"] as const).find(e => compteurs[e] > 0) ?? "a_confirmer";
}

/** Jour à Oran, « 2026-10-09 ». */
function jourOran(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
/** Minuit à Oran (l’Algérie reste à UTC+1 toute l’année). */
export function debutJourOran(maintenant: number): string {
  return new Date(`${jourOran(maintenant)}T00:00:00+01:00`).toISOString();
}

/** « 13 h 23 » aujourd’hui, « hier 13 h 23 », sinon « 08/10 13 h 23 » (heure d’Oran). */
export function heureCourte(iso: string, maintenant: number): string {
  const ms = Date.parse(iso);
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find(x => x.type === t)?.value ?? "";
  const heure = `${Number(p("hour"))} h ${p("minute")}`;
  const jour = jourOran(ms);
  if (jour === jourOran(maintenant)) return heure;
  if (jour === jourOran(maintenant - 86_400_000)) return `hier ${heure}`;
  return `${p("day")}/${p("month")} ${heure}`;
}

/** « 42 min », « 2 h », « 2 h 05 ». */
export function formaterDuree(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return "moins d’1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), reste = m % 60;
  return reste ? `${h} h ${String(reste).padStart(2, "0")}` : `${h} h`;
}

export type Urgence = { texte: string; rouge: boolean };
type ChampsUrgence = Pick<CommandeRecue, "statut" | "cree_le" | "confirmee_le" | "expire_le">;

/** Texte d’urgence de la ligne ; le rouge est toujours accompagné de ce texte. */
export function urgence(commande: ChampsUrgence, maintenant: number): Urgence {
  const depuis = (iso: string) => (maintenant - Date.parse(iso)) / MINUTE;
  switch (commande.statut) {
    case "demandee": { const m = depuis(commande.cree_le); return { texte: `attend depuis ${formaterDuree(m)}`, rouge: m >= SEUIL_CONFIRMER_MIN }; }
    case "confirmee": { const m = depuis(commande.confirmee_le ?? commande.cree_le); return { texte: `confirmée il y a ${formaterDuree(m)}`, rouge: m >= SEUIL_PREPARER_MIN }; }
    case "prete": {
      if (!commande.expire_le) return { texte: "prête", rouge: false };
      const reste = (Date.parse(commande.expire_le) - maintenant) / MINUTE;
      return reste <= 0 ? { texte: "expirée, en attente", rouge: true } : { texte: `expire dans ${formaterDuree(reste)}`, rouge: reste < SEUIL_PRETE_MIN };
    }
    default: return { texte: STATUTS_COMMANDE[commande.statut], rouge: false };
  }
}

/** Heure de la ligne selon l’étape : reçue, confirmée, prête, terminée. */
export function heureEtape(commande: Pick<CommandeRecue, "statut" | "cree_le" | "confirmee_le" | "prete_le" | "terminee_le">): string {
  switch (commande.statut) {
    case "demandee": return commande.cree_le;
    case "confirmee": return commande.confirmee_le ?? commande.cree_le;
    case "prete": return commande.prete_le ?? commande.confirmee_le ?? commande.cree_le;
    default: return commande.terminee_le ?? commande.cree_le;
  }
}

/** Le prénom affiché dans les lignes : premier mot du nom saisi par le client. */
export function prenom(nom: string | null | undefined): string {
  return (nom ?? "").trim().split(/\s+/)[0] || "Client";
}

/** `%`, `_` et `\` neutralisés pour un motif ILIKE. */
export function echapperMotif(texte: string): string {
  return texte.replace(/[\\%_]/g, c => `\\${c}`);
}

export type Recherche = { numero: number } | { prefixe: string };
/** Un nombre (« 131 », « n° 131 », « #131 ») cherche le numéro exact ; sinon le début du nom (2 caractères au moins). */
export function lireRecherche(brute: string | string[] | undefined): Recherche | null {
  if (typeof brute !== "string") return null;
  const texte = brute.trim().slice(0, RECHERCHE_MAX);
  const numero = /^(?:n°|no|#)?\s*(\d{1,9})$/i.exec(texte);
  if (numero) return { numero: Number(numero[1]) };
  return texte.length >= 2 ? { prefixe: texte } : null;
}

const SELECTION = "*, lignes_commande(*)";
type Client = SupabaseClient<Database>;

/** Les commandes d’une étape, la plus urgente d’abord (100 au plus). */
export async function listerEtape(client: Client, boutiqueId: string, etape: EtapeCommande, maintenant: number): Promise<CommandeRecue[]> {
  let requete = client.from("commandes").select(SELECTION).eq("boutique_id", boutiqueId).in("statut", ETAPES[etape].statuts);
  if (etape === "a_confirmer") requete = requete.order("cree_le", { ascending: true });
  else if (etape === "a_preparer") requete = requete.order("confirmee_le", { ascending: true }).order("cree_le", { ascending: true });
  else if (etape === "pretes") requete = requete.order("expire_le", { ascending: true });
  else requete = requete.gte("terminee_le", new Date(maintenant - JOURS_TERMINEES * 86_400_000).toISOString()).order("terminee_le", { ascending: false });
  const { data, error } = await requete.limit(LIGNES_PAR_ETAPE);
  if (error) throw new Error("Impossible de charger les commandes. Réessayez.");
  return (data ?? []) as unknown as CommandeRecue[];
}

/** Les 4 compteurs (« Terminées » = terminées aujourd’hui, heure d’Oran), sans lire les lignes. */
export async function compterEtapes(client: Client, boutiqueId: string, maintenant: number): Promise<CompteursEtapes> {
  const compter = (etape: EtapeCommande) => {
    let requete = client.from("commandes").select("id", { count: "exact", head: true }).eq("boutique_id", boutiqueId).in("statut", ETAPES[etape].statuts);
    if (etape === "terminees") requete = requete.gte("terminee_le", debutJourOran(maintenant));
    return requete;
  };
  const resultats = await Promise.all(ORDRE_ETAPES.map(compter));
  if (resultats.some(r => r.error)) throw new Error("Impossible de charger les commandes. Réessayez.");
  return Object.fromEntries(ORDRE_ETAPES.map((e, i) => [e, resultats[i].count ?? 0])) as CompteursEtapes;
}

/** Recherche dans toutes les étapes, les plus récentes d’abord (50 au plus). */
export async function chercherCommandes(client: Client, boutiqueId: string, recherche: Recherche): Promise<CommandeRecue[]> {
  let requete = client.from("commandes").select(SELECTION).eq("boutique_id", boutiqueId);
  requete = "numero" in recherche ? requete.eq("numero", recherche.numero) : requete.ilike("client_nom", `${echapperMotif(recherche.prefixe)}%`);
  const { data, error } = await requete.order("cree_le", { ascending: false }).limit(RESULTATS_RECHERCHE);
  if (error) throw new Error("Impossible de chercher les commandes. Réessayez.");
  return (data ?? []) as unknown as CommandeRecue[];
}

// --- US-28.2 : actions groupées ------------------------------------------------
export const GROUPE_MAX = 20;
export type StatutGroupe = "confirmee" | "prete";
export const ACTION_GROUPEE: Partial<Record<EtapeCommande, StatutGroupe>> = { a_confirmer: "confirmee", a_preparer: "prete" };
export type ResultatGroupe = { succes: boolean; message: string; reussies: { id: string; numero: number }[]; echecs: { id: string; numero: number | null; message: string; deja: boolean }[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vérifie la demande avant toute lecture : 1 à 20 identifiants valides (doublons retirés), « confirmee » ou « prete » seulement. */
export function lireDemandeGroupee(ids: unknown, statut: unknown): { ids: string[]; statut: StatutGroupe } | { refus: string } {
  if (statut !== "confirmee" && statut !== "prete") return { refus: "Action impossible." };
  if (!Array.isArray(ids) || !ids.every(id => typeof id === "string" && UUID.test(id))) return { refus: "Demande invalide." };
  const uniques = [...new Set(ids as string[])];
  if (!uniques.length) return { refus: "Cochez au moins une commande." };
  if (uniques.length > GROUPE_MAX) return { refus: `${GROUPE_MAX} au plus à la fois.` };
  return { ids: uniques, statut };
}

/** Compte rendu : « 3 commandes confirmées. », puis une ligne par échec. */
export function compteRendu(resultat: ResultatGroupe, statut: StatutGroupe): { titre: string; lignes: { id: string; texte: string }[] } {
  const n = resultat.reussies.length;
  const fait = statut === "confirmee" ? (n > 1 ? "confirmées" : "confirmée") : (n > 1 ? "marquées prêtes" : "marquée prête");
  const titre = !resultat.succes ? resultat.message : n === 0 ? "Aucune commande modifiée." : `${n} commande${n > 1 ? "s" : ""} ${fait}.`;
  const deja = statut === "confirmee" ? "déjà confirmée" : "déjà prête";
  const non = statut === "confirmee" ? "non confirmée" : "non marquée prête";
  const lignes = resultat.echecs.map(e => ({ id: e.id, texte: e.numero === null ? e.message : e.deja ? `N° ${e.numero} : ${deja}.` : `N° ${e.numero} ${non} : ${e.message}` }));
  return { titre, lignes };
}

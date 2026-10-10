// US-28.1 : tableau des commandes de la boutique (étapes, urgence, recherche).
// Lectures avec le client de la session : les règles RLS limitent déjà la boutique à ses commandes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STATUTS_COMMANDE, type CommandeRecue, type StatutCommande } from "@/lib/commandes";
import { fr, type Textes } from "@/lib/textes/fr";
import { remplir, type Langue } from "@/lib/langue";

/** US-35 : textes du tableau (français par défaut ; l'espace passe ceux de la langue choisie). */
export type TextesTableau = Textes["espace"]["tableau"];

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
export function heureCourte(iso: string, maintenant: number, t: TextesTableau = fr.espace.tableau): string {
  const ms = Date.parse(iso);
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find(x => x.type === t)?.value ?? "";
  const heure = remplir(t.heure, { h: Number(p("hour")), m: p("minute") });
  const jour = jourOran(ms);
  if (jour === jourOran(maintenant)) return heure;
  if (jour === jourOran(maintenant - 86_400_000)) return remplir(t.hier, { heure });
  return `${p("day")}/${p("month")} ${heure}`;
}

/** « 42 min », « 2 h », « 2 h 05 ». */
export function formaterDuree(minutes: number, t: TextesTableau = fr.espace.tableau): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return t.moinsUneMinute;
  if (m < 60) return remplir(t.minutes, { m });
  const h = Math.floor(m / 60), reste = m % 60;
  return reste ? remplir(t.heuresMinutes, { h, m: String(reste).padStart(2, "0") }) : remplir(t.heures, { h });
}

export type Urgence = { texte: string; rouge: boolean };
type ChampsUrgence = Pick<CommandeRecue, "statut" | "cree_le" | "confirmee_le" | "expire_le">;

/** Texte d’urgence de la ligne ; le rouge est toujours accompagné de ce texte. */
export function urgence(commande: ChampsUrgence, maintenant: number, t: TextesTableau = fr.espace.tableau, statuts: Record<StatutCommande, string> = STATUTS_COMMANDE): Urgence {
  const depuis = (iso: string) => (maintenant - Date.parse(iso)) / MINUTE;
  switch (commande.statut) {
    case "demandee": { const m = depuis(commande.cree_le); return { texte: remplir(t.attend, { duree: formaterDuree(m, t) }), rouge: m >= SEUIL_CONFIRMER_MIN }; }
    case "confirmee": { const m = depuis(commande.confirmee_le ?? commande.cree_le); return { texte: remplir(t.confirmeeIlYa, { duree: formaterDuree(m, t) }), rouge: m >= SEUIL_PREPARER_MIN }; }
    case "prete": {
      if (!commande.expire_le) return { texte: t.prete, rouge: false };
      const reste = (Date.parse(commande.expire_le) - maintenant) / MINUTE;
      return reste <= 0 ? { texte: t.expiree, rouge: true } : { texte: remplir(t.expireDans, { duree: formaterDuree(reste, t) }), rouge: reste < SEUIL_PRETE_MIN };
    }
    default: return { texte: statuts[commande.statut], rouge: false };
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
export function compteRendu(resultat: ResultatGroupe, statut: StatutGroupe, t: TextesTableau = fr.espace.tableau, traduire: (message: string) => string = m => m): { titre: string; lignes: { id: string; texte: string }[] } {
  const n = resultat.reussies.length;
  const fait = statut === "confirmee" ? (n > 1 ? t.confirmeesPlusieurs : t.confirmees) : (n > 1 ? t.pretesPlusieurs : t.pretesUne);
  const titre = !resultat.succes ? traduire(resultat.message) : n === 0 ? t.aucuneModifiee : remplir(fait, { n });
  const deja = statut === "confirmee" ? t.dejaConfirmee : t.dejaPrete;
  const non = statut === "confirmee" ? t.nonConfirmee : t.nonPrete;
  const lignes = resultat.echecs.map(e => ({ id: e.id, texte: e.numero === null ? traduire(e.message) : e.deja ? remplir(deja, { n: e.numero }) : remplir(non, { n: e.numero, message: traduire(e.message) }) }));
  return { titre, lignes };
}

// --- US-28.3 : liste de préparation ----------------------------------------------
export type LignePreparee = Pick<CommandeRecue["lignes_commande"][number], "article_id" | "titre" | "taille" | "quantite"> & { articles?: { categorie: string } | null };
export type CommandeAPreparer = Pick<CommandeRecue, "id" | "numero" | "client_nom" | "total" | "remise_bon"> & { lignes_commande: LignePreparee[] };
export type TaillePreparee = { taille: string; quantite: number; commandes: { numero: number; prenom: string; quantite: number }[] };
export type ArticlePrepare = { cle: string; titre: string; categorie: string | null; total: number; tailles: TaillePreparee[] };
export type Preparation = { articles: ArticlePrepare[]; commandes: { numero: number; prenom: string; pieces: number; montant: number }[]; pieces: number };

const ORDRE_TAILLES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL"];
/** S < M < L… ; 38 < 40 ; « 50 ml » < « 100 ml » ; « 4 ans » < « 10 ans » ; « Unique » et le reste à la fin, par ordre alphabétique. */
function rangTaille(taille: string): [number, number, string] {
  const i = ORDRE_TAILLES.indexOf(taille.trim().toUpperCase());
  if (i >= 0) return [0, i, ""];
  const nombre = /^(\d+)/.exec(taille.trim());
  if (nombre) return [1, Number(nombre[1]), taille];
  return [2, 0, taille];
}
function comparerTailles(a: string, b: string): number {
  const [x, y] = [rangTaille(a), rangTaille(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], "fr");
}

/**
 * Regroupe les articles à sortir pour les commandes confirmées : par article (son identifiant ; le titre si l'article
 * a été supprimé depuis la commande), puis par taille / contenance. Articles triés par catégorie (ordre des rayons) puis par nom.
 */
export function grouperPreparation(commandes: CommandeAPreparer[], categories: readonly string[]): Preparation {
  const articles = new Map<string, ArticlePrepare>();
  for (const commande of commandes) {
    for (const ligne of commande.lignes_commande) {
      const cle = ligne.article_id ?? `titre:${ligne.titre.trim().toLowerCase()}`;
      const article = articles.get(cle) ?? { cle, titre: ligne.titre, categorie: ligne.articles?.categorie ?? null, total: 0, tailles: [] };
      articles.set(cle, article);
      article.total += ligne.quantite;
      let taille = article.tailles.find(t => t.taille === ligne.taille);
      if (!taille) { taille = { taille: ligne.taille, quantite: 0, commandes: [] }; article.tailles.push(taille); }
      taille.quantite += ligne.quantite;
      const deja = taille.commandes.find(c => c.numero === commande.numero);
      if (deja) deja.quantite += ligne.quantite; else taille.commandes.push({ numero: commande.numero, prenom: prenom(commande.client_nom), quantite: ligne.quantite });
    }
  }
  const rang = (c: string | null) => { const i = c ? categories.indexOf(c) : -1; return i < 0 ? categories.length : i; };
  const liste = [...articles.values()].sort((a, b) => rang(a.categorie) - rang(b.categorie) || a.titre.localeCompare(b.titre, "fr"));
  for (const a of liste) a.tailles.sort((x, y) => comparerTailles(x.taille, y.taille));
  const resume = commandes.map(c => ({ numero: c.numero, prenom: prenom(c.client_nom), pieces: c.lignes_commande.reduce((s, l) => s + l.quantite, 0), montant: Math.max(0, c.total - Math.max(0, c.remise_bon ?? 0)) }));
  return { articles: liste, commandes: resume, pieces: resume.reduce((s, c) => s + c.pieces, 0) };
}

/** Commandes confirmées de la boutique, avec la catégorie de chaque article (client de la session). */
export async function listerAPreparer(client: Client, boutiqueId: string): Promise<CommandeAPreparer[]> {
  const { data, error } = await client.from("commandes").select("id, numero, client_nom, total, remise_bon, lignes_commande(article_id, titre, taille, quantite, articles(categorie))")
    .eq("boutique_id", boutiqueId).eq("statut", "confirmee").order("confirmee_le", { ascending: true }).limit(LIGNES_PAR_ETAPE);
  if (error) throw new Error("Impossible de charger les commandes. Réessayez.");
  return (data ?? []) as unknown as CommandeAPreparer[];
}

/** « vendredi 09/10 à 14 h 05 » (heure d’Oran). */
export function dateLongue(maintenant: number, langue: Langue = "fr", modele: string = fr.espace.preparation.dateLongue): string {
  const parts = new Intl.DateTimeFormat(langue === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { timeZone: FUSEAU, weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(maintenant));
  const p = (t: string) => parts.find(x => x.type === t)?.value ?? "";
  const heure = langue === "ar" ? `${p("hour")}:${p("minute")}` : `${Number(p("hour"))} h ${p("minute")}`;
  return remplir(modele, { jour: p("weekday"), date: `${p("day")}/${p("month")}`, heure });
}

// --- US-28.4 : mise à jour automatique (option A, interrogation toutes les 20 s) ---------------
export const INTERVALLE_MS = 20_000;
export const INTERVALLE_ERREUR_MS = 60_000;
export const DUREE_NOUVEAU_MS = 2 * 60_000;
/** Réponse de GET /espace/commandes/etat : des compteurs et le dernier numéro, aucune donnée personnelle. */
export type EtatCommandes = CompteursEtapes & { derniere: number | null };

/** Les 4 compteurs et le numéro de la dernière commande reçue par la boutique. */
export async function lireEtatCommandes(client: Client, boutiqueId: string, maintenant: number): Promise<EtatCommandes> {
  const [compteurs, derniere] = await Promise.all([
    compterEtapes(client, boutiqueId, maintenant),
    client.from("commandes").select("numero").eq("boutique_id", boutiqueId).order("cree_le", { ascending: false }).limit(1),
  ]);
  if (derniere.error) throw new Error("Impossible de charger les commandes. Réessayez.");
  return { ...compteurs, derniere: (derniere.data?.[0] as { numero: number } | undefined)?.numero ?? null };
}

/** Tout changement de statut déplace une commande d’une étape à l’autre : les compteurs + le dernier numéro suffisent à savoir s’il faut rafraîchir. */
export function empreinteEtat(etat: EtatCommandes): string {
  return [etat.a_confirmer, etat.a_preparer, etat.pretes, etat.terminees, etat.derniere ?? 0].join("-");
}

/** « 14 h 05 » à Oran. */
export function heureOran(ms: number, t: TextesTableau = fr.espace.tableau): string {
  return heureCourte(new Date(ms).toISOString(), ms, t);
}

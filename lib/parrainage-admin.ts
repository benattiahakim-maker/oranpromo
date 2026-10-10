import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { MINIMUM_PREMIERE_COMMANDE, moisAlger, nomMois } from "./bons";

// US-27.5 : administration du parrainage (budget, parrainages et signaux, relevés des boutiques, export CSV).
// Les règles (budget, annulation, exclusion, relevé payé figé…) sont dans la base ; ici : lecture, signaux, mise en forme.

const FUSEAU = "Africa/Algiers";
export const BUDGET_MAX = 10_000_000;
export const PLAFOND_PARRAIN = 5;
export const SEUIL_RELEVE_SIGNALE = 3000;

type Client = SupabaseClient<Database>;
type ErreurBase = { code?: string; message: string } | null;

function nombre(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n).replace(/[\u202f\u00a0]/g, " ");
}
export function montantDA(n: number): string { return `${nombre(n)} DA`; }

/** Messages de la base (français, sûrs) pour les refus attendus, sinon un message générique. */
function erreurAdmin(error: ErreurBase, defaut: string): Error {
  if (error && ["42501", "23514", "22023", "P0002"].includes(error.code ?? "")) return new Error(error.message);
  return new Error(defaut);
}

// ---------- Mois ----------
/** « 2026-11 » (paramètre d'URL) → « 2026-11-01 » ; invalide ou absent → mois courant (heure d'Alger). */
export function moisDepuisParametre(valeur: string | string[] | undefined | null, maintenant: Date = new Date()): string {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v >= "2026-01" ? `${v}-01` : moisAlger(maintenant);
}
/** « 2026-11-01 » → « 2026-11 ». */
export function parametreMois(mois: string): string { return mois.slice(0, 7); }
/** Les n derniers mois, le plus récent d'abord. */
export function derniersMois(n = 12, maintenant: Date = new Date()): string[] {
  const [a, m] = moisAlger(maintenant).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  });
}
/** « Octobre 2026 ». */
export function libelleMois(mois: string): string {
  const n = nomMois(mois, "fr");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${mois.slice(0, 4)}`;
}
function moisDe(iso: string): string { return moisAlger(new Date(iso)); }
function jourAlger(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
/** « 05/10/2026 14:32 » heure d'Alger (export). */
export function dateHeureAlger(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
/** Date du jour à Alger (« 2026-10-09 ») : date de paiement par défaut. */
export function aujourdhuiAlger(maintenant: Date = new Date()): string { return jourAlger(maintenant.toISOString()); }

/** Numéro masqué pour l'admin : « 0555 •• •• 56 ». */
export function masquerTelephone(telephone: string | null | undefined): string {
  const m = /^\+213(\d{3})\d{4}(\d{2})$/.exec(telephone ?? "");
  return m ? `0${m[1]} •• •• ${m[2]}` : "Sans numéro";
}

// ---------- Budget ----------
export type BudgetParrainage = { mois: string; actif: boolean; budget: number; emis: number; utilise: number; en_file: number; restant: number };

export async function lireBudget(client: Client, mois?: string): Promise<BudgetParrainage> {
  const { data, error } = await client.rpc("budget_parrainage", mois ? { mois } : {});
  if (error || !data || typeof data !== "object") throw erreurAdmin(error, "Impossible de lire le budget du parrainage. Réessayez.");
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return { mois: String(d.mois ?? mois ?? moisAlger()), actif: d.actif === true, budget: n(d.budget), emis: n(d.emis), utilise: n(d.utilise), en_file: n(d.en_file), restant: n(d.restant) };
}

export const MESSAGE_BUDGET_INVALIDE = "Budget invalide : un montant en DA entre 0 et 10 000 000.";
/** Saisie « 30 000 » → 30000 ; même bornes que la base. */
export function validerMontantBudget(saisie: string): number {
  const propre = saisie.replace(/[\s\u202f\u00a0]/g, "").replace(/DA$/i, "");
  if (!/^\d{1,8}$/.test(propre)) throw new Error(MESSAGE_BUDGET_INVALIDE);
  const montant = Number(propre);
  if (montant > BUDGET_MAX) throw new Error(MESSAGE_BUDGET_INVALIDE);
  return montant;
}

export async function reglerBudget(client: Client, montant: number) {
  const { error } = await client.rpc("regler_budget_parrainage", { montant });
  if (error) throw erreurAdmin(error, "Impossible d’enregistrer le budget. Réessayez.");
}

/** « Budget d’octobre : 9 600 DA émis sur 30 000 DA · 3 600 DA utilisés · 2 parrainages en file ». */
export function resumeBudget(b: BudgetParrainage): string {
  const mois = nomMois(b.mois, "fr");
  const de = /^[aeiouâéèêhy]/i.test(mois) ? `d’${mois}` : `de ${mois}`;
  const debut = b.budget === 0 ? `Budget ${de} : 0 DA, aucun nouveau bon · ${montantDA(b.emis)} émis` : `Budget ${de} : ${montantDA(b.emis)} émis sur ${montantDA(b.budget)}`;
  const file = b.en_file ? ` · ${b.en_file} parrainage${b.en_file > 1 ? "s" : ""} en file` : "";
  return `${debut} · ${montantDA(b.utilise)} utilisé${b.utilise > 1 ? "s" : ""}${file}`;
}

// ---------- Actions admin (fonctions de la base) ----------
export async function annulerBons(client: Client, filleul: string, motif: string): Promise<number> {
  const { data, error } = await client.rpc("annuler_bons_parrainage", { filleul, motif });
  if (error) throw erreurAdmin(error, "Impossible d’annuler les bons. Réessayez.");
  return typeof data === "number" ? data : 0;
}
export async function exclureDuParrainage(client: Client, profil: string, exclu: boolean) {
  const { error } = await client.rpc("exclure_parrainage", { profil, exclu });
  if (error) throw erreurAdmin(error, "Impossible de modifier l’exclusion. Réessayez.");
}
export async function retirerBoutique(client: Client, boutique: string, retiree: boolean) {
  const { error } = await client.rpc("retirer_boutique_des_bons", { boutique, retiree });
  if (error) throw erreurAdmin(error, "Impossible de modifier la boutique. Réessayez.");
}
export async function mettreDeCote(client: Client, ligne: string, motif: string) {
  const { error } = await client.rpc("mettre_de_cote", { ligne, motif });
  if (error) throw erreurAdmin(error, "Impossible de mettre cette ligne de côté. Réessayez.");
}
export async function deciderLigne(client: Client, ligne: string, decision: "rembourser" | "refuser", motif: string) {
  const { error } = await client.rpc("decider_ligne", { ligne, decision, motif });
  if (error) throw erreurAdmin(error, "Impossible d’enregistrer la décision. Réessayez.");
}
export async function marquerPaye(client: Client, releve: string, reference: string, payeLe: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payeLe)) throw new Error("Date de paiement invalide.");
  const { error } = await client.rpc("marquer_releve_paye", { releve, reference, paye_le: payeLe });
  if (error) throw erreurAdmin(error, "Impossible de marquer ce relevé comme payé. Réessayez.");
}

// ---------- Parrainages ----------
export const STATUTS_PARRAINAGE: Record<string, string> = {
  en_attente: "En attente", valide: "Validé", plafond: "Parrain au plafond", en_file: "En file (budget)",
  non_valide: "Non validé", expire: "Expiré", refuse: "Parrain refusé", annule: "Annulé",
};
const VALIDES = ["valide", "plafond", "en_file", "refuse"];

type PersonneAdmin = { id: string; nom: string | null; telephone: string | null; cree_le: string; parrainage_exclu: boolean; bloque: boolean };
export type ParrainageAdmin = {
  filleul_id: string; parrain_id: string | null; statut: string; cree_le: string; valide_le: string | null; motif: string | null;
  filleul: PersonneAdmin | null; parrain: PersonneAdmin | null;
  commande: { numero: number; total: number; mode_remise: string | null; cree_le: string; prete_le: string | null; terminee_le: string | null } | null;
  boutique: { id: string; nom: string; bons_acceptes: boolean } | null;
  bons: { id: string; origine: string; statut: string }[];
};

const PERSONNE = "id, nom, telephone, cree_le, parrainage_exclu, bloque";
export async function listerParrainages(client: Client): Promise<ParrainageAdmin[]> {
  const { data, error } = await client.from("parrainages")
    .select(`filleul_id, parrain_id, statut, cree_le, valide_le, motif, filleul:profils!parrainages_filleul_id_fkey(${PERSONNE}), parrain:profils!parrainages_parrain_id_fkey(${PERSONNE}), commande:commandes!parrainages_commande_id_fkey(numero, total, mode_remise, cree_le, prete_le, terminee_le), boutique:boutiques!parrainages_boutique_id_fkey(id, nom, bons_acceptes), bons!bons_parrainage_id_fkey(id, origine, statut)`)
    .order("cree_le", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les parrainages. Réessayez.");
  return (data ?? []) as unknown as ParrainageAdmin[];
}

/** Bons qu'« Annuler les bons » peut encore annuler (pas utilisés, pas réservés). */
export function bonsAnnulables(p: Pick<ParrainageAdmin, "bons">): number {
  return p.bons.filter(b => b.statut === "disponible" || b.statut === "en_file").length;
}

function minutesEntre(debut: string | null | undefined, fin: string | null | undefined): number | null {
  if (!debut || !fin) return null;
  return (new Date(fin).getTime() - new Date(debut).getTime()) / 60000;
}

/** Signal « retrait simulé » : remise < 15 min après « Prête » ou < 30 min après la commande. */
export function signalRemiseRapide(c: { cree_le: string; prete_le: string | null; terminee_le: string | null } | null | undefined): string | null {
  if (!c?.terminee_le) return null;
  const apresPrete = minutesEntre(c.prete_le, c.terminee_le);
  if (apresPrete !== null && apresPrete < 15) return `Remise ${Math.max(0, Math.round(apresPrete))} min après « Prête »`;
  const apresCommande = minutesEntre(c.cree_le, c.terminee_le);
  if (apresCommande !== null && apresCommande < 30) return `Remise ${Math.max(0, Math.round(apresCommande))} min après la commande`;
  return null;
}

/** Signaux de triche par parrainage (docs/architecture.md, « Signaux de triche ») : jamais bloquants. */
export function signauxParrainages(liste: ParrainageAdmin[]): Map<string, string[]> {
  const signaux = new Map<string, string[]>(liste.map(p => [p.filleul_id, []]));
  const ajouter = (id: string, s: string) => { const l = signaux.get(id)!; if (!l.includes(s)) l.push(s); };
  const grouper = (cle: (p: ParrainageAdmin) => string | null) => {
    const g = new Map<string, ParrainageAdmin[]>();
    for (const p of liste) { const k = cle(p); if (k) g.set(k, [...(g.get(k) ?? []), p]); }
    return g;
  };
  const valide = (p: ParrainageAdmin) => VALIDES.includes(p.statut) && Boolean(p.valide_le);
  // Concentration : ≥ 3 filleuls d'un même parrain validés chez une même boutique dans le mois.
  for (const groupe of grouper(p => (valide(p) && p.parrain_id && p.boutique ? `${p.parrain_id}|${p.boutique.id}|${moisDe(p.valide_le!)}` : null)).values())
    if (groupe.length >= 3) groupe.forEach(p => ajouter(p.filleul_id, `${groupe.length} filleuls du même parrain validés chez ${p.boutique!.nom} ce mois-là`));
  // Commandes calibrées : première commande entre 2 000 et 2 200 DA, plusieurs fois pour un même parrain.
  for (const groupe of grouper(p => (p.parrain_id && p.commande && p.commande.total >= MINIMUM_PREMIERE_COMMANDE && p.commande.total <= 2200 ? p.parrain_id : null)).values())
    if (groupe.length >= 2) groupe.forEach(p => ajouter(p.filleul_id, `Première commande juste au-dessus de 2 000 DA (${groupe.length} fois pour ce parrain)`));
  // Faux comptes : plusieurs filleuls d'un parrain inscrits le même jour.
  for (const groupe of grouper(p => (p.parrain_id && p.filleul ? `${p.parrain_id}|${jourAlger(p.filleul.cree_le)}` : null)).values())
    if (groupe.length >= 2) groupe.forEach(p => ajouter(p.filleul_id, `${groupe.length} filleuls du même parrain inscrits le même jour`));
  // Parrain au plafond (5 parrainages récompensés) deux mois de suite.
  const parMois = new Map<string, Set<string>>();
  for (const groupe of grouper(p => (p.statut === "valide" && p.valide_le && p.parrain_id ? `${p.parrain_id}|${moisDe(p.valide_le)}` : null)).entries())
    if (groupe[1].length >= PLAFOND_PARRAIN) { const [parrain, mois] = groupe[0].split("|"); parMois.set(parrain, (parMois.get(parrain) ?? new Set()).add(mois)); }
  for (const [parrain, mois] of parMois) {
    const suite = [...mois].some(m => { const [a, n] = m.split("-").map(Number); const d = new Date(Date.UTC(a, n, 1)); return mois.has(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`); });
    if (suite) liste.filter(p => p.parrain_id === parrain).forEach(p => ajouter(p.filleul_id, "Parrain au plafond (5) deux mois de suite"));
  }
  // Retrait simulé.
  for (const p of liste) { const s = signalRemiseRapide(p.commande); if (s) ajouter(p.filleul_id, s); }
  return signaux;
}

// ---------- Relevés ----------
export const ETATS_RELEVE: Record<string, string> = { en_cours: "En cours", a_payer: "À payer", paye: "Payé" };
export const ETATS_LIGNE: Record<string, string> = { a_rembourser: "À rembourser", de_cote: "Mise de côté", refuse: "Refusée" };

export type LigneReleveAdmin = {
  id: string; releve_id: string; numero_commande: number; remise_le: string; mode_remise: string; client: string;
  total_commande: number; montant: number; statut: string; motif: string | null;
  commande: { cree_le: string; prete_le: string | null; terminee_le: string | null } | null;
};
export type ReleveAdmin = {
  id: string; mois: string; nombre: number; montant: number; statut: string; cloture_le: string | null; paye_le: string | null; reference_paiement: string | null;
  boutique: { id: string; nom: string; slug: string; bons_acceptes: boolean } | null;
  lignes: LigneReleveAdmin[];
};

export async function listerReleves(client: Client, mois: string, boutique?: string | null): Promise<ReleveAdmin[]> {
  let requete = client.from("releves_bons")
    .select("id, mois, nombre, montant, statut, cloture_le, paye_le, reference_paiement, boutique:boutiques!releves_bons_boutique_id_fkey(id, nom, slug, bons_acceptes)")
    .eq("mois", mois);
  if (boutique) requete = requete.eq("boutique_id", boutique);
  const { data, error } = await requete.order("montant", { ascending: false });
  if (error) throw new Error("Impossible de charger les relevés. Réessayez.");
  const releves = (data ?? []) as unknown as Omit<ReleveAdmin, "lignes">[];
  if (!releves.length) return [];
  const { data: lignes, error: erreurLignes } = await client.from("lignes_releve")
    .select("id, releve_id, numero_commande, remise_le, mode_remise, client, total_commande, montant, statut, motif, commande:commandes!lignes_releve_commande_id_fkey(cree_le, prete_le, terminee_le)")
    .in("releve_id", releves.map(r => r.id)).order("remise_le", { ascending: true });
  if (erreurLignes) throw new Error("Impossible de charger les relevés. Réessayez.");
  const toutes = (lignes ?? []) as unknown as LigneReleveAdmin[];
  return releves.map(r => ({ ...r, lignes: toutes.filter(l => l.releve_id === r.id) }))
    .sort((a, b) => (a.boutique?.nom ?? "").localeCompare(b.boutique?.nom ?? "", "fr"));
}

/** Lignes mises de côté, tous mois confondus (elles attendent une décision). */
export async function listerLignesDeCote(client: Client): Promise<(LigneReleveAdmin & { boutique: { nom: string } | null })[]> {
  const { data, error } = await client.from("lignes_releve")
    .select("id, releve_id, numero_commande, remise_le, mode_remise, client, total_commande, montant, statut, motif, commande:commandes!lignes_releve_commande_id_fkey(cree_le, prete_le, terminee_le), boutique:boutiques!lignes_releve_boutique_id_fkey(nom)")
    .eq("statut", "de_cote").order("remise_le", { ascending: true });
  if (error) throw new Error("Impossible de charger les lignes mises de côté. Réessayez.");
  return (data ?? []) as unknown as (LigneReleveAdmin & { boutique: { nom: string } | null })[];
}

/** « 4 bons · 1 200 DA ». */
export function resumeReleve(r: Pick<ReleveAdmin, "nombre" | "montant">): string {
  return `${r.nombre} bon${r.nombre > 1 ? "s" : ""} · ${montantDA(r.montant)}`;
}

/** Signaux d'un relevé de boutique (contrôle avant de payer). */
export function signauxReleve(r: Pick<ReleveAdmin, "montant" | "lignes">): string[] {
  const s: string[] = [];
  if (r.montant > SEUIL_RELEVE_SIGNALE) s.push(`Relevé au-dessus de ${montantDA(SEUIL_RELEVE_SIGNALE)}`);
  const comptees = r.lignes.filter(l => l.statut !== "refuse");
  if (comptees.length >= 2 && comptees.every(l => l.mode_remise === "code")) s.push("Toujours par code à 4 chiffres, jamais par QR code");
  const rapides = comptees.filter(l => signalRemiseRapide(l.commande)).length;
  if (rapides) s.push(`${rapides} remise${rapides > 1 ? "s" : ""} très rapide${rapides > 1 ? "s" : ""}`);
  return s;
}

// ---------- Export CSV ----------
export const COLONNES_CSV = ["mois", "boutique", "slug", "numero_commande", "date_remise", "mode_remise", "client", "total_commande", "bon", "a_rembourser", "etat_ligne", "etat_releve", "reference_paiement"] as const;

/** Champ CSV : apostrophe devant =, +, -, @ (formules Excel), guillemets si ; " ou retour à la ligne. */
export function champCsv(valeur: string | number | null | undefined): string {
  let v = valeur === null || valeur === undefined ? "" : String(valeur);
  if (typeof valeur === "string" && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Export du mois : BOM UTF-8, séparateur « ; », une ligne par bon, puis une ligne TOTAL par boutique. */
export function csvReleves(releves: Pick<ReleveAdmin, "mois" | "statut" | "reference_paiement" | "boutique" | "lignes">[]): string {
  const lignes: string[] = [COLONNES_CSV.join(";")];
  for (const r of releves) {
    const mois = parametreMois(r.mois);
    const nom = r.boutique?.nom ?? "";
    const slug = r.boutique?.slug ?? "";
    let totalBons = 0, totalARembourser = 0;
    for (const l of r.lignes) {
      const aRembourser = l.statut === "a_rembourser" ? l.montant : 0;
      totalBons += l.montant; totalARembourser += aRembourser;
      lignes.push([mois, nom, slug, l.numero_commande, dateHeureAlger(l.remise_le), l.mode_remise, l.client, l.total_commande, l.montant, aRembourser, l.statut, r.statut, r.reference_paiement].map(champCsv).join(";"));
    }
    lignes.push([mois, nom, slug, "TOTAL", "", "", "", "", totalBons, totalARembourser, "", r.statut, r.reference_paiement].map(champCsv).join(";"));
  }
  return `\uFEFF${lignes.join("\r\n")}\r\n`;
}

export function nomFichierCsv(mois: string): string { return `bledeal-bons-${parametreMois(mois)}.csv`; }

// ---------- Boutique (/espace) ----------
export type ReleveBoutique = Pick<ReleveAdmin, "id" | "mois" | "nombre" | "montant" | "statut" | "paye_le" | "reference_paiement"> & { lignes: Pick<LigneReleveAdmin, "id" | "numero_commande" | "remise_le" | "montant" | "statut">[] };

/** Relevés de la boutique du commerçant (RLS : sa boutique seulement), du plus récent au plus ancien. */
export async function lireRelevesBoutique(client: Client, boutiqueId: string): Promise<ReleveBoutique[]> {
  const { data, error } = await client.from("releves_bons")
    .select("id, mois, nombre, montant, statut, paye_le, reference_paiement, lignes:lignes_releve!lignes_releve_releve_id_fkey(id, numero_commande, remise_le, montant, statut)")
    .eq("boutique_id", boutiqueId).order("mois", { ascending: false }).limit(12);
  if (error) throw new Error("Impossible de charger vos bons parrainage. Réessayez.");
  return (data ?? []) as unknown as ReleveBoutique[];
}

/** Ligne d'un relevé côté boutique : « Septembre : 2 400 DA · payé le 05/10, réf. CCP-1234 » ou « à payer avant le 10/10 ». */
export function etatReleveBoutique(r: Pick<ReleveBoutique, "mois" | "montant" | "statut" | "paye_le" | "reference_paiement">): string {
  const n = nomMois(r.mois, "fr");
  const debut = `${n.charAt(0).toUpperCase()}${n.slice(1)} : ${montantDA(r.montant)}`;
  if (r.statut === "paye" && r.paye_le) return `${debut} · payé le ${r.paye_le.slice(8, 10)}/${r.paye_le.slice(5, 7)}${r.reference_paiement ? `, réf. ${r.reference_paiement}` : ""}`;
  if (r.statut === "a_payer") {
    const [a, m] = r.mois.split("-").map(Number);
    const suivant = new Date(Date.UTC(a, m, 10));
    return `${debut} · à payer avant le 10/${String(suivant.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${debut} · en cours`;
}

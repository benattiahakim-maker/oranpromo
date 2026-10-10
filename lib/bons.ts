// US-27 : bons de parrainage de 300 DA (décision du propriétaire du 9/10, option A).
// Règles dans la base (migration 20261012090000_parrainage.sql) ; ici : montants affichés et messages.
// Voir docs/architecture.md, « Parrainage (US-27) ».
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { Langue } from "./langue";

/** Montant d'un bon (fixé par la base à la création). */
export const MONTANT_BON = 300;
/** Commande minimale pour utiliser un bon (décision du propriétaire : 1 000 DA). */
export const MINIMUM_COMMANDE_BON = 1000;
/** Première commande minimale du filleul pour valider le parrainage. */
export const MINIMUM_PREMIERE_COMMANDE = 2000;

/** Montant à encaisser en boutique : le total moins le bon (jamais négatif). */
export function aEncaisser(total: number, remiseBon: number | null | undefined): number {
  const remise = Math.max(0, Math.trunc(remiseBon ?? 0));
  return Math.max(0, total - remise);
}

/** Le bon peut-il s'appliquer à ce total (avant l'appel à la base, pour l'affichage du panier) ? */
export function bonApplicable(total: number, bonDisponible: boolean): boolean {
  return bonDisponible && total >= MINIMUM_COMMANDE_BON;
}

/** Réponses de utiliser_bon(). */
// US-33.1 : « univers », « ville », « plafond_boutique » pour les bons de bienvenue et de campagne.
export const RESULTATS_BON = ["applique", "aucun_bon", "minimum", "boutique_exclue", "deja", "univers", "ville", "plafond_boutique"] as const;
export type ResultatBon = (typeof RESULTATS_BON)[number];

export function resultatBon(valeur: unknown): ResultatBon | null {
  return (RESULTATS_BON as readonly unknown[]).includes(valeur) ? (valeur as ResultatBon) : null;
}

export type StatutBon = "en_file" | "disponible" | "reserve" | "utilise" | "expire" | "annule";

/** Mois (1er jour, heure d'Alger) d'une date : sert au relevé de remboursement (« relevé de novembre »). */
export function moisAlger(date: Date = new Date()): string {
  const morceaux = new Intl.DateTimeFormat("fr-CA", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit" }).formatToParts(date);
  const annee = morceaux.find((m) => m.type === "year")?.value;
  const mois = morceaux.find((m) => m.type === "month")?.value;
  return `${annee}-${mois}-01`;
}

/** 1er du mois suivant (heure d'Alger) : arrivée d'un bon en file. */
export function premierDuMoisSuivant(date: Date = new Date()): string {
  const [annee, mois] = moisAlger(date).split("-").map(Number);
  const suivant = mois === 12 ? { a: annee + 1, m: 1 } : { a: annee, m: mois + 1 };
  return `${suivant.a}-${String(suivant.m).padStart(2, "0")}-01`;
}

const FUSEAU = "Africa/Algiers";
const locale = (langue: Langue) => (langue === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR");

/** « 11 décembre », « 1er novembre » (heure d'Alger) ; en arabe « 11 ديسمبر ». */
export function formaterJourMois(iso: string, langue: Langue = "fr"): string {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  const morceaux = new Intl.DateTimeFormat(locale(langue), { timeZone: FUSEAU, day: "numeric", month: "long" }).formatToParts(date);
  const jour = morceaux.find(m => m.type === "day")?.value ?? "";
  const mois = morceaux.find(m => m.type === "month")?.value ?? "";
  return langue === "fr" && jour === "1" ? `1er ${mois}` : `${jour} ${mois}`;
}

/** « 12/10 » (heure d'Alger). */
export function formaterJourCourt(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** Nom du mois (« novembre ») d'une date YYYY-MM-01 : « relevé de novembre ». */
export function nomMois(mois: string, langue: Langue = "fr"): string {
  return new Intl.DateTimeFormat(locale(langue), { timeZone: FUSEAU, month: "long" }).format(new Date(`${mois.slice(0, 7)}-15T12:00:00Z`));
}

/** « relevé de novembre », « relevé d’octobre » (espace commerçant, en français). */
export function releveDuMois(mois: string): string {
  const nom = nomMois(mois, "fr");
  return /^[aeiouâéèêhy]/i.test(nom) ? `relevé d’${nom}` : `relevé de ${nom}`;
}

/** Un bon tel que le renvoie mes_bons() (jamais d'autre compte). */
export type OrigineBon = "parrainage_filleul" | "parrainage_parrain" | "bienvenue" | "campagne";
export type BonClient = {
  id: string; montant: number; statut: StatutBon; origine: OrigineBon;
  cree_le: string; expire_le: string | null; utilise_le: string | null; commande: string | null; numero: number | null; boutique: string | null;
  /** US-33.1 : règles copiées du programme (parrainage : 1 000 DA sur le total, sans univers ni ville). */
  minimum_achat?: number; univers?: string | null; villes?: string[]; nom_fr?: string | null; nom_ar?: string | null;
};

/** Bon utilisable au panier : disponible, pas expiré ; celui qui finit le plus tôt d'abord (comme utiliser_bon). */
export function bonDisponible(bons: BonClient[], maintenant: Date = new Date()): BonClient | null {
  return bons.filter(b => b.statut === "disponible" && b.expire_le && new Date(b.expire_le).getTime() > maintenant.getTime())
    .sort((a, b) => a.expire_le!.localeCompare(b.expire_le!))[0] ?? null;
}

/** US-33.2 : bon d'un programme (bienvenue, campagne) ou de parrainage. */
export function estBonProgramme(bon: Pick<BonClient, "origine">): boolean {
  return bon.origine === "bienvenue" || bon.origine === "campagne";
}

/** Achat minimum d'un bon (parrainage : 1 000 DA, fixé par la base ; programmes : copié du programme). */
export function minimumBon(bon: Pick<BonClient, "minimum_achat">): number {
  return bon.minimum_achat ?? MINIMUM_COMMANDE_BON;
}

/** Bon proposé au panier : le plus gros bon utilisable pour ce total (comme utiliser_bon), sinon celui au plus petit minimum. */
export type BonPropose = { bon: BonClient; applicable: boolean };
export function bonPourTotal(bons: BonClient[], total: number, maintenant: Date = new Date()): BonPropose | null {
  const valables = bons.filter(b => b.statut === "disponible" && b.expire_le && new Date(b.expire_le).getTime() > maintenant.getTime());
  const parOrdre = (a: BonClient, b: BonClient) => b.montant - a.montant || a.expire_le!.localeCompare(b.expire_le!) || a.cree_le.localeCompare(b.cree_le);
  const utilisable = valables.filter(b => total >= minimumBon(b)).sort(parOrdre)[0];
  if (utilisable) return { bon: utilisable, applicable: true };
  const plusProche = [...valables].sort((a, b) => minimumBon(a) - minimumBon(b) || parOrdre(a, b))[0];
  return plusProche ? { bon: plusProche, applicable: false } : null;
}

/** US-33.3 : bons proposés au panier, chacun avec sa raison (celle de la base quand elle est connue, sinon le
 *  minimum sur le total), et le bon retenu : celui choisi s'il s'applique, sinon le premier qui s'applique (le plus
 *  gros, comme utiliser_bon), sinon celui au plus petit minimum (non applicable). */
export type RaisonBonPanier = "ok" | "minimum" | "univers" | "ville" | "plafond_boutique" | "boutique_exclue";
export type OptionBon = { bon: BonClient; raison: RaisonBonPanier };
export function choixBons(bons: BonClient[], total: number, raisons: Record<string, string> | null, choisi: string | null, maintenant: Date = new Date()):
  { options: OptionBon[]; retenu: BonPropose | null } {
  const valables = bons.filter(b => b.statut === "disponible" && b.expire_le && new Date(b.expire_le).getTime() > maintenant.getTime())
    .sort((a, b) => b.montant - a.montant || a.expire_le!.localeCompare(b.expire_le!) || a.cree_le.localeCompare(b.cree_le));
  const options = valables.map(bon => {
    const r = raisons?.[bon.id];
    const raison: RaisonBonPanier = r === "ok" || r === "minimum" || r === "univers" || r === "ville" || r === "plafond_boutique" || r === "boutique_exclue"
      ? r : total >= minimumBon(bon) ? "ok" : "minimum";
    return { bon, raison };
  });
  const ok = options.filter(o => o.raison === "ok");
  const pris = ok.find(o => o.bon.id === choisi) ?? ok[0];
  if (pris) return { options, retenu: { bon: pris.bon, applicable: true } };
  const proche = [...options].sort((a, b) => minimumBon(a.bon) - minimumBon(b.bon))[0];
  return { options, retenu: proche ? { bon: proche.bon, applicable: false } : null };
}

/** « 9/11 » (heure d'Alger) : date courte des bons de programme (conception US-33, texte n° 2). */
export function formaterJourMoisNumerique(iso: string): string {
  const morceaux = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "numeric" }).formatToParts(new Date(iso));
  const nombre = (type: string) => String(Number(morceaux.find(m => m.type === type)?.value ?? ""));
  return `${nombre("day")}/${nombre("month")}`;
}

/** Ligne d'état d'un bon dans « Mes bons » : clé du texte et valeurs à remplir. */
export type EtatBonAffiche = { cle: "disponible" | "reserve" | "utilise" | "expire" | "enFile" | "annule"; valeurs: Record<string, string | number>; actif: boolean };
export function etatBon(bon: BonClient, langue: Langue = "fr", maintenant: Date = new Date()): EtatBonAffiche {
  const expire = bon.expire_le && new Date(bon.expire_le).getTime() <= maintenant.getTime();
  switch (bon.statut) {
    case "disponible":
      return expire ? { cle: "expire", valeurs: { date: formaterJourCourt(bon.expire_le!) }, actif: false }
        : { cle: "disponible", valeurs: { date: formaterJourMois(bon.expire_le ?? bon.cree_le, langue) }, actif: true };
    case "reserve": return { cle: "reserve", valeurs: { n: bon.numero ?? "" }, actif: true };
    case "utilise": return { cle: "utilise", valeurs: { date: formaterJourCourt(bon.utilise_le ?? bon.cree_le), boutique: bon.boutique ?? "" }, actif: false };
    case "expire": return { cle: "expire", valeurs: { date: formaterJourCourt(bon.expire_le ?? bon.cree_le) }, actif: false };
    case "en_file": return { cle: "enFile", valeurs: { date: formaterJourMois(premierDuMoisSuivant(maintenant), langue) }, actif: true };
    default: return { cle: "annule", valeurs: {}, actif: false };
  }
}

/** Raison affichée sur le suivi quand le bon coché n'a pas pu être posé (la commande reste au prix plein). */
// US-33.3 : « univers », « ville », « plafond_boutique » (bons de campagne).
const RAISONS_NON_APPLIQUE = ["aucun_bon", "minimum", "boutique_exclue", "univers", "ville", "plafond_boutique", "erreur"] as const;
export type RaisonBonNonApplique = (typeof RAISONS_NON_APPLIQUE)[number];
export function raisonBonNonApplique(valeur: unknown): RaisonBonNonApplique | null {
  return (RAISONS_NON_APPLIQUE as readonly unknown[]).includes(valeur) ? (valeur as RaisonBonNonApplique) : null;
}

export async function lireMesBons(client: SupabaseClient<Database>): Promise<BonClient[]> {
  const { data, error } = await client.rpc("mes_bons");
  if (error) throw new Error("Impossible de charger tes bons. Réessaie.");
  return Array.isArray(data) ? (data as unknown as BonClient[]) : [];
}

/**
 * Pose un bon sur une commande qui vient d'être passée (après passer_commande, jamais avant).
 * Un échec ne touche pas la commande : elle reste au prix plein.
 */
export async function utiliserBon(client: SupabaseClient<Database>, commandeId: string, bonId?: string): Promise<ResultatBon | "erreur"> {
  try {
    const { data, error } = await client.rpc("utiliser_bon", bonId ? { commande: commandeId, bon: bonId } : { commande: commandeId });
    return error ? "erreur" : resultatBon(data) ?? "erreur";
  } catch { return "erreur"; }
}

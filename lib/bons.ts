// US-27 : bons de parrainage de 300 DA (décision du propriétaire du 9/10, option A).
// Règles dans la base (migration 20261012090000_parrainage.sql) ; ici : montants affichés et messages.
// Voir docs/architecture.md, « Parrainage (US-27) ».

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
export type ResultatBon = "applique" | "aucun_bon" | "minimum" | "boutique_exclue" | "deja";

export function resultatBon(valeur: unknown): ResultatBon | null {
  return valeur === "applique" || valeur === "aucun_bon" || valeur === "minimum" || valeur === "boutique_exclue" || valeur === "deja"
    ? valeur
    : null;
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

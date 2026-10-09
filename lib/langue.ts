// US-23 : langue du site (français par défaut, arabe en seconde langue), gardée dans un cookie.

export type Langue = "fr" | "ar";
export const LANGUES: readonly Langue[] = ["fr", "ar"];
export const COOKIE_LANGUE = "langue";
/** Le choix est gardé un an. */
export const DUREE_COOKIE_LANGUE = 60 * 60 * 24 * 365;

/** Tout ce qui n'est pas exactement « ar » donne le français (défaut). */
export function langueDepuisCookie(valeur: string | null | undefined): Langue {
  return valeur === "ar" ? "ar" : "fr";
}

/** Sens d'écriture de la page. */
export function direction(langue: Langue): "rtl" | "ltr" {
  return langue === "ar" ? "rtl" : "ltr";
}

/** Remplace les {noms} d'un texte : remplir("{n} résultats", { n: 3 }) → "3 résultats". */
export function remplir(texte: string, valeurs: Record<string, string | number>): string {
  return texte.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in valeurs ? String(valeurs[nom]) : tout));
}

/** Isole un fragment de gauche à droite (prix, numéro) dans un texte arabe : « 3 500 » ne devient pas « 500 3 ». */
export function isolerGaucheDroite(texte: string): string {
  return `\u2066${texte}\u2069`;
}

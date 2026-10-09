export const TRADUCTION_INDISPONIBLE = "La traduction est indisponible, vous pouvez écrire le texte arabe à la main";
export const LONGUEUR_ARABE_MAX = 1121;
export type TraductionIA = { titreAr: string; descriptionAr: string };
const longueur = (texte: string) => Array.from(texte).length;
const arabe = /[\u0620-\u063f\u0641-\u064a\u066e-\u06d3\u06fa-\u06ff]/;
export function validerSaisieTraduction(valeur: unknown): { titre: string; description: string } {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) throw new Error("Saisissez un titre et une description valides.");
  const v = valeur as Record<string, unknown>;
  if (typeof v.titre !== "string" || typeof v.description !== "string" || Object.keys(v).some(k => !["titre", "description"].includes(k))) throw new Error("Saisissez un titre et une description valides.");
  const titre = v.titre.trim(), description = v.description.trim();
  if (!titre || longueur(titre) > 120) throw new Error("Le titre doit contenir entre 1 et 120 caractères.");
  if (longueur(description) > 1000) throw new Error("La description doit contenir au maximum 1 000 caractères.");
  return { titre, description };
}
export function validerTraductionIA(valeur: unknown, descriptionFacultative = false): TraductionIA {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) throw new Error(TRADUCTION_INDISPONIBLE);
  const v = valeur as Record<string, unknown>;
  if (typeof v.titreAr !== "string" || typeof v.descriptionAr !== "string" || Object.keys(v).some(k => !["titreAr", "descriptionAr"].includes(k))) throw new Error(TRADUCTION_INDISPONIBLE);
  const titreAr = v.titreAr.trim(), descriptionAr = v.descriptionAr.trim();
  if (!titreAr || !arabe.test(titreAr) || longueur(titreAr) > 120 || longueur(descriptionAr) > 1000 || (!descriptionAr && !descriptionFacultative) || (descriptionAr && !arabe.test(descriptionAr))) throw new Error(TRADUCTION_INDISPONIBLE);
  // Refuser les affirmations commerciales plutôt que les montrer comme une traduction fiable.
  if (/[a-z]/i.test(titreAr + descriptionAr) || /(?:أصيل|أصلي|اصلية|أصلية|أصالة|تقليد|ماركة|علامة تجارية|شعار|نايك|أديداس|غوتشي|زارا|لاكوست)/.test(titreAr + descriptionAr)) throw new Error(TRADUCTION_INDISPONIBLE);
  return { titreAr, descriptionAr };
}
export function texteArabeTraduction(traduction: TraductionIA): string {
  return `${traduction.titreAr}\n${traduction.descriptionAr}`;
}

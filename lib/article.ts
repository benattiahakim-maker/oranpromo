import type { Enums } from "./supabase/types";

export const CATEGORIES_ARTICLE = ["Polos", "T-shirts", "Chemises", "Pulls", "Vestes", "Pantalons", "Jeans", "Robes", "Jupes", "Chaussures", "Accessoires"] as const;
export const GENRES_ARTICLE = ["homme", "femme", "enfant", "mixte"] as const;
export const TAILLES_ARTICLE = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
export const TAILLE_UNIQUE = "Unique";
export const COULEURS_ARTICLE = ["Noir", "Blanc", "Gris", "Beige", "Marron", "Bleu marine", "Bleu", "Vert", "Kaki", "Rouge", "Bordeaux", "Rose", "Jaune", "Orange", "Violet", "Multicolore"] as const;

export function taillesPourArticle(categorie: string, genre: string): string[] {
  if (!CATEGORIES_ARTICLE.some(c => c === categorie)) return [];
  if (categorie === "Accessoires") return [TAILLE_UNIQUE];
  if (genre === "enfant") return categorie === "Chaussures" ? Array.from({ length: 11 }, (_, i) => String(24 + i)) : [2, 4, 6, 8, 10, 12, 14].map(age => `${age} ans`);
  if (categorie === "Chaussures") return Array.from({ length: 12 }, (_, i) => String(35 + i));
  if (["Pantalons", "Jeans"].includes(categorie)) return [...[36, 38, 40, 42, 44, 46, 48, 50].map(String), ...TAILLES_ARTICLE.slice(0, -1)];
  return [...TAILLES_ARTICLE];
}

export function filtrerTailles(tailles: string[], categorie: string, genre: string) {
  const autorisees = taillesPourArticle(categorie, genre);
  return normaliserTailles(tailles).filter(t => autorisees.includes(t));
}

export function couleurDepuisIA(valeur: string): string {
  const texte = valeur.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const exacte = COULEURS_ARTICLE.find(c => c.toLowerCase() === texte);
  if (exacte) return exacte;
  const alias: Record<string, string> = { marine: "Bleu marine", "bleu fonce": "Bleu marine", navy: "Bleu marine", turquoise: "Bleu", cyan: "Bleu", ecru: "Beige", creme: "Beige", "blanc casse": "Beige", camel: "Marron", brun: "Marron", mauve: "Violet", noire: "Noir", blanche: "Blanc", grise: "Gris", bleue: "Bleu", verte: "Vert", violette: "Violet", "vert olive": "Kaki", olive: "Kaki", "rouge fonce": "Bordeaux" };
  if (alias[texte]) return alias[texte];
  const simple = texte.replace(/ (clair|claire|fonce|foncee|pale|vif|vive)$/, "");
  return COULEURS_ARTICLE.find(c => c.toLowerCase() === simple) ?? alias[simple] ?? "";
}
export const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"];
export const TAILLE_PHOTO_MAX = 5 * 1024 * 1024;

export type SaisieArticle = { titre: string; categorie: string; genre: string; couleur: string; description: string; descriptionAr?: string; prix: string; tailles: string[]; photos: { type: string; size: number }[] };
export type ErreursArticle = Partial<Record<"photos" | "titre" | "categorie" | "genre" | "couleur" | "prix" | "tailles" | "descriptionAr", string>>;

export function normaliserTailles(tailles: string[]): string[] {
  return [...new Set(tailles.map(taille => taille.trim().toUpperCase()).filter(Boolean))].map(taille => taille === "UNIQUE" ? TAILLE_UNIQUE : taille.replace(/ ANS$/, " ans"));
}

export function validerArticle(saisie: SaisieArticle, options: { verifierPhotos?: boolean } = {}): ErreursArticle {
  const erreurs: ErreursArticle = {};
  if (saisie.descriptionAr !== undefined && Array.from(saisie.descriptionAr.trim()).length > 1121) erreurs.descriptionAr = "Le texte arabe doit contenir au maximum 1 121 caractères.";
  if (options.verifierPhotos !== false) {
    if (!saisie.photos.length) erreurs.photos = "Ajoutez au moins une photo.";
    else if (saisie.photos.length > 5) erreurs.photos = "Vous pouvez ajouter au maximum 5 photos.";
    else if (saisie.photos.some(photo => !TYPES_PHOTO.includes(photo.type) || photo.size <= 0)) erreurs.photos = "Choisissez des photos JPEG, PNG ou WebP non vides.";
  }
  const longueur = Array.from(saisie.titre.trim()).length;
  if (longueur < 2 || longueur > 120) erreurs.titre = "Le titre doit contenir entre 2 et 120 caractères.";
  if (!CATEGORIES_ARTICLE.some(categorie => categorie === saisie.categorie)) erreurs.categorie = "Choisissez une catégorie.";
  if (!GENRES_ARTICLE.some(genre => genre === saisie.genre)) erreurs.genre = "Choisissez un genre.";
  if (saisie.couleur && !COULEURS_ARTICLE.some(c => c === saisie.couleur)) erreurs.couleur = "Choisissez une couleur dans la liste.";
  const prix = saisie.prix.trim();
  if (!/^\d+$/.test(prix) || Number(prix) <= 0) erreurs.prix = "Saisissez un prix entier en DA, supérieur à 0.";
  else if (Number(prix) > 2147483647) erreurs.prix = "Ce prix est trop élevé.";
  const tailles = normaliserTailles(saisie.tailles);
  if (!tailles.length) erreurs.tailles = "Choisissez au moins une taille.";
  else if (tailles.includes(TAILLE_UNIQUE) && tailles.length > 1) erreurs.tailles = "La taille unique ne se combine pas avec d’autres tailles.";
  else if (tailles.some(t => !taillesPourArticle(saisie.categorie, saisie.genre).includes(t))) erreurs.tailles = "Choisissez uniquement les tailles proposées pour cette catégorie et ce genre.";
  return erreurs;
}

export function donneesArticle(saisie: SaisieArticle) {
  return { titre: saisie.titre.trim(), categorie: saisie.categorie, genre: saisie.genre as Enums<"genre_article">, couleur: saisie.couleur.trim() || null, description: saisie.description.trim() || null, ...(saisie.descriptionAr !== undefined ? { description_ar: saisie.descriptionAr.trim() || null } : {}), prix: Number(saisie.prix.trim()) };
}

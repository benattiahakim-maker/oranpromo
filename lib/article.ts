import type { Enums } from "./supabase/types";

export const CATEGORIES_ARTICLE = ["Polos", "T-shirts", "Chemises", "Pulls", "Vestes", "Pantalons", "Jeans", "Robes", "Jupes", "Chaussures", "Accessoires"] as const;
export const GENRES_ARTICLE = ["homme", "femme", "enfant", "mixte"] as const;
export const TAILLES_ARTICLE = ["S", "M", "L", "XL", "XXL"] as const;
export const TAILLE_UNIQUE = "Unique";
export const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"];
export const TAILLE_PHOTO_MAX = 5 * 1024 * 1024;

export type SaisieArticle = { titre: string; categorie: string; genre: string; couleur: string; description: string; prix: string; tailles: string[]; photos: { type: string; size: number }[] };
export type ErreursArticle = Partial<Record<"photos" | "titre" | "categorie" | "genre" | "prix" | "tailles", string>>;

export function normaliserTailles(tailles: string[]): string[] {
  return [...new Set(tailles.map(taille => taille.trim().toUpperCase()).filter(Boolean))].map(taille => taille === "UNIQUE" ? TAILLE_UNIQUE : taille);
}

export function validerArticle(saisie: SaisieArticle): ErreursArticle {
  const erreurs: ErreursArticle = {};
  if (!saisie.photos.length) erreurs.photos = "Ajoutez au moins une photo.";
  else if (saisie.photos.length > 5) erreurs.photos = "Vous pouvez ajouter au maximum 5 photos.";
  else if (saisie.photos.some(photo => !TYPES_PHOTO.includes(photo.type) || photo.size <= 0)) erreurs.photos = "Choisissez des photos JPEG, PNG ou WebP non vides.";
  const longueur = Array.from(saisie.titre.trim()).length;
  if (longueur < 2 || longueur > 120) erreurs.titre = "Le titre doit contenir entre 2 et 120 caractères.";
  if (!CATEGORIES_ARTICLE.some(categorie => categorie === saisie.categorie)) erreurs.categorie = "Choisissez une catégorie.";
  if (!GENRES_ARTICLE.some(genre => genre === saisie.genre)) erreurs.genre = "Choisissez un genre.";
  const prix = saisie.prix.trim();
  if (!/^\d+$/.test(prix) || Number(prix) <= 0) erreurs.prix = "Saisissez un prix entier en DA, supérieur à 0.";
  else if (Number(prix) > 2147483647) erreurs.prix = "Ce prix est trop élevé.";
  const tailles = normaliserTailles(saisie.tailles);
  if (!tailles.length) erreurs.tailles = "Choisissez au moins une taille.";
  else if (tailles.includes(TAILLE_UNIQUE) && tailles.length > 1) erreurs.tailles = "La taille unique ne se combine pas avec d’autres tailles.";
  return erreurs;
}

export function donneesArticle(saisie: SaisieArticle) {
  return { titre: saisie.titre.trim(), categorie: saisie.categorie, genre: saisie.genre as Enums<"genre_article">, couleur: saisie.couleur.trim() || null, description: saisie.description.trim() || null, prix: Number(saisie.prix.trim()) };
}

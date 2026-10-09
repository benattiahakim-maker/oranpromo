import type { Enums } from "./supabase/types";

// Catégories organisées en 4 univers (Femme · Homme · Enfant · Beauté), sans sous-catégories.
// Mode : le genre (femme, homme, enfant, mixte) précise l'univers. Beauté : genre facultatif.
export const CATEGORIES_MODE = ["T-shirts et polos", "Chemises", "Pulls et sweats", "Vestes et manteaux", "Pantalons et jeans", "Survêtements et ensembles", "Robes", "Jupes", "Abayas, djellabas, kamis", "Tenues traditionnelles", "Hijabs et foulards", "Chaussures", "Sacs", "Accessoires"] as const;
export const CATEGORIES_BEAUTE = ["Parfums", "Maquillage", "Soins visage et corps", "Cheveux", "Hammam et traditionnel"] as const;
export const CATEGORIES_ARTICLE = [...CATEGORIES_MODE, ...CATEGORIES_BEAUTE] as const;
export const GENRES_ARTICLE = ["homme", "femme", "enfant", "mixte"] as const;
// Univers affichés en haut du site : un genre pour la mode, ou toutes les catégories beauté.
export const UNIVERS = [{ cle: "femme", nom: "Femme" }, { cle: "homme", nom: "Homme" }, { cle: "enfant", nom: "Enfant" }, { cle: "beaute", nom: "Beauté" }] as const;
export type CleUnivers = typeof UNIVERS[number]["cle"];
export const TAILLES_ARTICLE = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
export const TAILLE_UNIQUE = "Unique";
// Beauté : contenance en millilitres au lieu d'une taille (ou « Unique » pour un produit sans contenance).
export const CONTENANCES_BEAUTE = ["5 ml", "10 ml", "15 ml", "30 ml", "50 ml", "75 ml", "100 ml", "150 ml", "200 ml", "250 ml", "500 ml", "1000 ml"] as const;
export const COULEURS_ARTICLE = ["Noir", "Blanc", "Gris", "Beige", "Marron", "Bleu marine", "Bleu", "Vert", "Kaki", "Rouge", "Bordeaux", "Rose", "Jaune", "Orange", "Violet", "Multicolore"] as const;

export function estCategorieBeaute(categorie: string): boolean {
  return CATEGORIES_BEAUTE.some(c => c === categorie);
}

// Libellé du choix de taille : « Contenance » pour la beauté, « Taille » sinon.
export function libelleTaille(categorie: string): "Contenance" | "Taille" {
  return estCategorieBeaute(categorie) ? "Contenance" : "Taille";
}

export function taillesPourArticle(categorie: string, genre: string): string[] {
  if (!CATEGORIES_ARTICLE.some(c => c === categorie)) return [];
  if (estCategorieBeaute(categorie)) return [...CONTENANCES_BEAUTE, TAILLE_UNIQUE];
  if (["Accessoires", "Sacs", "Hijabs et foulards"].includes(categorie)) return [TAILLE_UNIQUE];
  const enfant = [2, 4, 6, 8, 10, 12, 14].map(age => `${age} ans`);
  const avecUnique = ["Abayas, djellabas, kamis", "Tenues traditionnelles"].includes(categorie) ? [TAILLE_UNIQUE] : [];
  if (genre === "enfant") return categorie === "Chaussures" ? Array.from({ length: 11 }, (_, i) => String(24 + i)) : [...enfant, ...avecUnique];
  if (categorie === "Chaussures") return Array.from({ length: 12 }, (_, i) => String(35 + i));
  if (categorie === "Pantalons et jeans") return [...[36, 38, 40, 42, 44, 46, 48, 50].map(String), ...TAILLES_ARTICLE.slice(0, -1)];
  return [...TAILLES_ARTICLE, ...avecUnique];
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
// Grande photo (fiche article) : 1200 px au plus grand côté. Miniature (cartes) : 400 px.
export const COTE_PHOTO_MAX = 1200;
export const COTE_VIGNETTE = 400;
// Poids visé par la compression du navigateur : la qualité JPEG baisse jusqu'à passer sous ces seuils.
export const TAILLE_PHOTO_CIBLE = 700 * 1024;
export const TAILLE_VIGNETTE_MAX = 150 * 1024;
// Total des photos et miniatures envoyées en une fois à l'action serveur : 5 × (700 Ko + 100 Ko) ≈ 4 Mo,
// sous la limite d'environ 4,5 Mo d'un envoi sur Vercel (bodySizeLimit = 4,5 Mo dans next.config.ts).
export const TAILLE_ENVOI_PHOTOS_MAX = 4 * 1024 * 1024;

// Vérifie la signature réelle du fichier (octets magiques) au lieu du type annoncé par le navigateur.
export function typeImageReel(octets: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const debut = (signature: number[], decalage = 0) => signature.every((octet, i) => octets[decalage + i] === octet);
  if (octets.length >= 3 && debut([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (octets.length >= 8 && debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (octets.length >= 12 && debut([0x52, 0x49, 0x46, 0x46]) && debut([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
export async function estJpegReel(fichier: Blob): Promise<boolean> {
  return typeImageReel(new Uint8Array(await fichier.slice(0, 12).arrayBuffer())) === "image/jpeg";
}

export type SaisieArticle = { titre: string; categorie: string; genre: string; couleur: string; description: string; descriptionAr?: string; prix: string; tailles: string[]; photos: { type: string; size: number }[] };
export type ErreursArticle = Partial<Record<"photos" | "titre" | "categorie" | "genre" | "couleur" | "prix" | "tailles" | "descriptionAr", string>>;

export function normaliserTailles(tailles: string[]): string[] {
  return [...new Set(tailles.map(taille => taille.trim().toUpperCase()).filter(Boolean).map(taille => taille === "UNIQUE" ? TAILLE_UNIQUE : taille.replace(/ ANS$/, " ans").replace(/^(\d+) ?ML$/, "$1 ml")))];
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
  // Genre facultatif pour la beauté (enregistré « mixte »), obligatoire pour la mode.
  if (!(saisie.genre === "" && estCategorieBeaute(saisie.categorie)) && !GENRES_ARTICLE.some(genre => genre === saisie.genre)) erreurs.genre = "Choisissez un genre.";
  if (saisie.couleur && !COULEURS_ARTICLE.some(c => c === saisie.couleur)) erreurs.couleur = "Choisissez une couleur dans la liste.";
  const prix = saisie.prix.trim();
  if (!/^\d+$/.test(prix) || Number(prix) <= 0) erreurs.prix = "Saisissez un prix entier en DA, supérieur à 0.";
  else if (Number(prix) > 2147483647) erreurs.prix = "Ce prix est trop élevé.";
  const tailles = normaliserTailles(saisie.tailles);
  if (!tailles.length) erreurs.tailles = estCategorieBeaute(saisie.categorie) ? "Choisissez au moins une contenance (ou « Unique »)." : "Choisissez au moins une taille.";
  else if (tailles.includes(TAILLE_UNIQUE) && tailles.length > 1) erreurs.tailles = "La taille unique ne se combine pas avec d’autres tailles.";
  else if (tailles.some(t => !taillesPourArticle(saisie.categorie, saisie.genre).includes(t))) erreurs.tailles = estCategorieBeaute(saisie.categorie) ? "Choisissez uniquement les contenances proposées." : "Choisissez uniquement les tailles proposées pour cette catégorie et ce genre.";
  return erreurs;
}

export function donneesArticle(saisie: SaisieArticle) {
  return { titre: saisie.titre.trim(), categorie: saisie.categorie, genre: (saisie.genre || "mixte") as Enums<"genre_article">, couleur: saisie.couleur.trim() || null, description: saisie.description.trim() || null, ...(saisie.descriptionAr !== undefined ? { description_ar: saisie.descriptionAr.trim() || null } : {}), prix: Number(saisie.prix.trim()) };
}

import { CATEGORIES_ARTICLE, COULEURS_ARTICLE, GENRES_ARTICLE, filtrerTailles } from "./article";

export type ChampsBrouillon = { titre: string; categorie: string; genre: string; couleur: string; prix: string; tailles: string[]; description: string; descriptionAr: string; champsIA?: ("titre" | "description" | "categorie" | "genre" | "couleur")[] };
export function lireBrouillonArticle(texte: string | null): ChampsBrouillon | null {
  try {
    const v = JSON.parse(texte ?? "null");
    if (!v || typeof v !== "object" || ["titre", "categorie", "genre", "couleur", "prix", "description", "descriptionAr"].some(c => typeof v[c] !== "string") || !Array.isArray(v.tailles) || v.tailles.some((t: unknown) => typeof t !== "string")) return null;
    const champsIA = Array.isArray(v.champsIA) ? v.champsIA.filter((c: unknown) => ["titre", "description", "categorie", "genre", "couleur"].includes(String(c))) : [];
    return { titre: v.titre, categorie: CATEGORIES_ARTICLE.includes(v.categorie) ? v.categorie : "", genre: GENRES_ARTICLE.includes(v.genre) ? v.genre : "", couleur: COULEURS_ARTICLE.includes(v.couleur) ? v.couleur : "", prix: v.prix, description: v.description, descriptionAr: v.descriptionAr, tailles: filtrerTailles(v.tailles, v.categorie, v.genre), ...(champsIA.length ? { champsIA } : {}) };
  } catch { return null; }
}
export function serialiserBrouillonArticle(v: ChampsBrouillon): string {
  return JSON.stringify({ titre: v.titre, categorie: v.categorie, genre: v.genre, couleur: v.couleur, prix: v.prix, tailles: v.tailles, description: v.description, descriptionAr: v.descriptionAr, ...(v.champsIA?.length ? { champsIA: v.champsIA } : {}) });
}

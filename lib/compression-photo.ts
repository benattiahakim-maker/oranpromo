import { COTE_PHOTO_MAX, COTE_VIGNETTE, TAILLE_PHOTO_CIBLE, TAILLE_PHOTO_MAX, TAILLE_VIGNETTE_MAX, TYPES_PHOTO } from "./article";

// Une photo prête à l'envoi : la grande photo (fiche) et sa miniature (cartes), toutes deux en JPEG.
export type PhotoPreparee = { photo: Blob; vignette: Blob | null };
// Qualités JPEG essayées dans l'ordre, jusqu'à passer sous le poids visé.
export const QUALITES_PHOTO = [0.8, 0.7, 0.6, 0.5] as const;
export const QUALITES_VIGNETTE = [0.7, 0.6, 0.5] as const;

export function dimensionsPhoto(largeur: number, hauteur: number, coteMax: number = COTE_PHOTO_MAX): { largeur: number; hauteur: number } {
  if (!Number.isFinite(largeur) || !Number.isFinite(hauteur) || largeur <= 0 || hauteur <= 0) throw new Error("Les dimensions de la photo sont invalides.");
  const rapport = Math.min(1, coteMax / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * rapport)), hauteur: Math.max(1, Math.round(hauteur * rapport)) };
}

// Accepte l'ancien format (un seul JPEG) et le nouveau (photo + miniature).
export function lirePhotoPreparee(resultat: Blob | PhotoPreparee): PhotoPreparee {
  return resultat instanceof Blob ? { photo: resultat, vignette: null } : resultat;
}

async function dessiner(image: HTMLImageElement, coteMax: number, qualites: readonly number[], poidsVise: number): Promise<Blob> {
  const dimensions = dimensionsPhoto(image.naturalWidth, image.naturalHeight, coteMax);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.largeur; canvas.height = dimensions.hauteur;
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("La compression des photos est indisponible dans ce navigateur.");
  contexte.fillStyle = "#FFFFFF";
  contexte.fillRect(0, 0, canvas.width, canvas.height);
  contexte.drawImage(image, 0, 0, canvas.width, canvas.height);
  let resultat: Blob | null = null;
  for (const qualite of qualites) {
    resultat = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Impossible de compresser cette photo.")), "image/jpeg", qualite));
    if (resultat.size <= poidsVise) break;
  }
  return resultat as Blob;
}

async function avecImage<T>(fichier: File, traitement: (image: HTMLImageElement) => Promise<T>): Promise<T> {
  if (!TYPES_PHOTO.includes(fichier.type) || !fichier.size) throw new Error("Choisissez une photo JPEG, PNG ou WebP non vide.");
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    return await traitement(image);
  } catch (error) {
    if (error instanceof Error && !(error instanceof DOMException)) throw error;
    throw new Error("Impossible de lire cette photo. Choisissez une autre image JPEG, PNG ou WebP.");
  } finally { URL.revokeObjectURL(adresse); }
}

// Grande photo seule (fiche article, photo envoyée à l'IA) : 1200 px, JPEG d'environ 700 Ko au plus.
export async function compresserPhoto(fichier: File): Promise<Blob> {
  return avecImage(fichier, async image => {
    const photo = await dessiner(image, COTE_PHOTO_MAX, QUALITES_PHOTO, TAILLE_PHOTO_CIBLE);
    if (photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée dépasse 5 Mo. Choisissez une autre photo.");
    return photo;
  });
}

// Grande photo (1200 px) + miniature (400 px, ~30 Ko) à partir d'une seule lecture de l'image.
export async function preparerPhoto(fichier: File): Promise<PhotoPreparee> {
  return avecImage(fichier, async image => {
    const photo = await dessiner(image, COTE_PHOTO_MAX, QUALITES_PHOTO, TAILLE_PHOTO_CIBLE);
    if (photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée dépasse 5 Mo. Choisissez une autre photo.");
    const vignette = await dessiner(image, COTE_VIGNETTE, QUALITES_VIGNETTE, TAILLE_VIGNETTE_MAX / 3);
    if (vignette.size > TAILLE_VIGNETTE_MAX) throw new Error("La miniature de la photo est trop lourde. Choisissez une autre photo.");
    return { photo, vignette };
  });
}

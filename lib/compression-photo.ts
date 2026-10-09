import { TAILLE_PHOTO_MAX, TYPES_PHOTO } from "./article";

export function dimensionsPhoto(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  if (!Number.isFinite(largeur) || !Number.isFinite(hauteur) || largeur <= 0 || hauteur <= 0) throw new Error("Les dimensions de la photo sont invalides.");
  const rapport = Math.min(1, 1600 / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * rapport)), hauteur: Math.max(1, Math.round(hauteur * rapport)) };
}

export async function compresserPhoto(fichier: File): Promise<Blob> {
  if (!TYPES_PHOTO.includes(fichier.type) || !fichier.size) throw new Error("Choisissez une photo JPEG, PNG ou WebP non vide.");
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    const dimensions = dimensionsPhoto(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.largeur; canvas.height = dimensions.hauteur;
    const contexte = canvas.getContext("2d");
    if (!contexte) throw new Error("La compression des photos est indisponible dans ce navigateur.");
    contexte.fillStyle = "#FFFFFF";
    contexte.fillRect(0, 0, canvas.width, canvas.height);
    contexte.drawImage(image, 0, 0, canvas.width, canvas.height);
    const photo = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Impossible de compresser cette photo.")), "image/jpeg", 0.8));
    if (photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée dépasse 5 Mo. Choisissez une autre photo.");
    return photo;
  } catch (error) {
    if (error instanceof Error && !(error instanceof DOMException)) throw error;
    throw new Error("Impossible de lire cette photo. Choisissez une autre image JPEG, PNG ou WebP.");
  } finally { URL.revokeObjectURL(adresse); }
}

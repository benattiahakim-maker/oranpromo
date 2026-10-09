import { TAILLE_PHOTO_MAX, TAILLE_VIGNETTE_MAX } from "./article";
import type { PhotoPreparee } from "./compression-photo";

// Contrôle commun avant envoi au stockage : grande photo JPEG ≤ 5 Mo, miniature JPEG ≤ 150 Ko (ou absente).
export function verifierPhotoPreparee(preparee: PhotoPreparee): PhotoPreparee {
  const { photo, vignette } = preparee;
  if (photo.type !== "image/jpeg" || !photo.size || photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée doit être un JPEG de moins de 5 Mo.");
  if (vignette && (vignette.type !== "image/jpeg" || !vignette.size || vignette.size > TAILLE_VIGNETTE_MAX)) throw new Error("La miniature doit être un JPEG de moins de 150 Ko.");
  return preparee;
}

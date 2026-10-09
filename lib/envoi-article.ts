import { preparerPhoto } from "./compression-photo";
import { TAILLE_ENVOI_PHOTOS_MAX, TAILLE_PHOTO_MAX, TAILLE_VIGNETTE_MAX, type SaisieArticle } from "./article";
import { publierArticleServeur, modifierArticleServeur } from "@/app/espace/articles/actions";
import type { ModificationPhotos, TailleModifiee } from "./gestion-articles";

async function preparerCorps(saisie: SaisieArticle, fichiers: File[]) {
  const corps = new FormData(); corps.set("saisie", JSON.stringify({ ...saisie, photos: [] })); let total = 0;
  for (const fichier of fichiers) {
    const { photo, vignette } = await preparerPhoto(fichier);
    if (photo.type !== "image/jpeg" || !photo.size || photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée doit être un JPEG de moins de 5 Mo.");
    if (!vignette || vignette.type !== "image/jpeg" || !vignette.size || vignette.size > TAILLE_VIGNETTE_MAX) throw new Error("La miniature de la photo doit être un JPEG de moins de 150 Ko.");
    // Même ordre dans « photos » et « vignettes » : la miniature i correspond à la photo i.
    corps.append("photos", photo, "photo.jpg"); corps.append("vignettes", vignette, "vignette.jpg"); total += photo.size + vignette.size;
  }
  if (total > TAILLE_ENVOI_PHOTOS_MAX) throw new Error("Les photos dépassent 4 Mo au total. Retirez une photo ou choisissez des images plus légères.");
  return corps;
}
export async function publierArticleNavigateur(boutiqueId: string, saisie: SaisieArticle, fichiers: File[], ia: boolean) {
  const corps = await preparerCorps(saisie, fichiers); corps.set("boutiqueId", boutiqueId); corps.set("ia", String(ia));
  const resultat = await publierArticleServeur(corps);
  if (resultat.erreur || !resultat.id) throw new Error(resultat.erreur || "Impossible de publier l’article.");
  return resultat.id;
}
export async function modifierArticleNavigateur(id: string, saisie: SaisieArticle, tailles: TailleModifiee[], photos?: ModificationPhotos) {
  const corps = await preparerCorps(saisie, photos?.fichiers ?? []);
  corps.set("id", id); corps.set("tailles", JSON.stringify(tailles));
  if (photos) corps.set("garder", JSON.stringify(photos.garder));
  const resultat = await modifierArticleServeur(corps);
  if (resultat.erreur) throw new Error(resultat.erreur);
  return resultat.photos;
}

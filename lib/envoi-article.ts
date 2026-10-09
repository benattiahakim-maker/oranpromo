import { compresserPhoto } from "./compression-photo";
import { TAILLE_PHOTO_MAX, type SaisieArticle } from "./article";
import { publierArticleServeur, modifierArticleServeur } from "@/app/espace/articles/actions";
import type { ModificationPhotos, TailleModifiee } from "./gestion-articles";

async function preparerCorps(saisie: SaisieArticle, fichiers: File[]) {
  const corps = new FormData(); corps.set("saisie", JSON.stringify({ ...saisie, photos: [] }));
  for (const fichier of fichiers) {
    const jpeg = await compresserPhoto(fichier);
    if (jpeg.type !== "image/jpeg" || !jpeg.size || jpeg.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée doit être un JPEG de moins de 5 Mo.");
    corps.append("photos", jpeg, "photo.jpg");
  }
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

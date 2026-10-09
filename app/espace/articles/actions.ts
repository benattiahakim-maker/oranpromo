"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { publierArticle } from "@/lib/publication-article";
import { articleDeMaBoutique, boutiqueDuCompte, modifierArticle, type TailleModifiee } from "@/lib/gestion-articles";
import { estJpegReel, validerArticle, TAILLE_ENVOI_PHOTOS_MAX, TAILLE_PHOTO_MAX, type SaisieArticle } from "@/lib/article";

async function lire(corps: FormData) {
  const v = JSON.parse(String(corps.get("saisie")));
  if (!v || ["titre", "categorie", "genre", "couleur", "description", "prix"].some(c => typeof v[c] !== "string") || (v.descriptionAr !== undefined && typeof v.descriptionAr !== "string") || !Array.isArray(v.tailles) || v.tailles.some((t: unknown) => typeof t !== "string")) throw new Error("Vérifiez les champs du formulaire.");
  const fichiers = corps.getAll("photos");
  if (fichiers.length > 5 || fichiers.some(f => typeof f === "string" || f.type !== "image/jpeg" || !f.size || f.size > TAILLE_PHOTO_MAX)) throw new Error("Choisissez de 1 à 5 photos JPEG de moins de 5 Mo.");
  if ((fichiers as File[]).reduce((total, f) => total + f.size, 0) > TAILLE_ENVOI_PHOTOS_MAX) throw new Error("Les photos dépassent 12 Mo au total. Retirez une photo ou choisissez des images plus légères.");
  // Le type annoncé vient du navigateur : vérifier aussi le contenu réel du fichier.
  for (const fichier of fichiers as File[]) if (!(await estJpegReel(fichier))) throw new Error("Une photo n’est pas un vrai fichier JPEG. Choisissez une autre image.");
  return { saisie: { ...v, photos: fichiers } as SaisieArticle, fichiers: fichiers as File[] };
}
const dejaCompressee = async (fichier: File) => fichier;
export async function publierArticleServeur(corps: FormData): Promise<{ id?: string; erreur?: string }> {
  try {
    const client = await creerClientServeur(), boutiqueId = await boutiqueDuCompte(client);
    if (boutiqueId !== corps.get("boutiqueId")) throw new Error("Votre compte n’est pas rattaché à cette boutique.");
    const { saisie, fichiers } = await lire(corps);
    const erreurs = validerArticle(saisie); if (Object.keys(erreurs).length) throw new Error(Object.values(erreurs).join(" "));
    const id = await publierArticle(client, boutiqueId, saisie, fichiers, dejaCompressee, corps.get("ia") === "true");
    return { id };
  } catch (error) { return { erreur: error instanceof Error ? error.message : "Impossible de publier l’article. Réessayez." }; }
}
export async function modifierArticleServeur(corps: FormData): Promise<{ erreur?: string; photos?: { id: string; adresse: string; ordre: number }[] }> {
  try {
    const client = await creerClientServeur(); await boutiqueDuCompte(client);
    const { saisie, fichiers } = await lire(corps);
    const erreurs = validerArticle(saisie, { verifierPhotos: false }); if (Object.keys(erreurs).length) throw new Error(Object.values(erreurs).join(" "));
    const tailles: TailleModifiee[] = JSON.parse(String(corps.get("tailles")));
    if (!Array.isArray(tailles) || tailles.some(t => !t || typeof t.libelle !== "string" || typeof t.disponible !== "boolean")) throw new Error("Choisissez des tailles valides.");
    const garder = corps.has("garder") ? JSON.parse(String(corps.get("garder"))) : null;
    if (garder !== null && (!Array.isArray(garder) || garder.some(id => typeof id !== "string"))) throw new Error("Les photos sélectionnées sont invalides.");
    if (garder === null && fichiers.length) throw new Error("Les photos sélectionnées sont invalides.");
    await modifierArticle(client, String(corps.get("id")), saisie, tailles, garder === null ? undefined : { garder, fichiers }, dejaCompressee);
    return garder === null ? {} : { photos: (await articleDeMaBoutique(client, String(corps.get("id")))).photos };
  } catch (error) { return { erreur: error instanceof Error ? error.message : "Impossible d’enregistrer l’article. Réessayez." }; }
}

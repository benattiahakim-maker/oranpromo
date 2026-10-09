import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "./supabase/types";
import { donneesArticle, normaliserTailles, TAILLE_PHOTO_MAX, validerArticle, type SaisieArticle } from "./article";
import { compresserPhoto } from "./compression-photo";

export class ErreurPublicationArticle extends Error {}

export async function publierArticle(client: SupabaseClient<Database>, boutiqueId: string, saisie: SaisieArticle, fichiers: File[], compression = compresserPhoto): Promise<string> {
  const erreurs = validerArticle({ ...saisie, photos: fichiers });
  if (Object.keys(erreurs).length) throw new ErreurPublicationArticle("Vérifiez les champs du formulaire avant de publier.");
  const articleId = crypto.randomUUID();
  const chemins: string[] = [];
  let insertionTentee = false;
  let etape = "compresser les photos";
  try {
    const photos: Blob[] = [];
    for (const fichier of fichiers) {
      const photo = await compression(fichier);
      if (photo.type !== "image/jpeg" || !photo.size || photo.size > TAILLE_PHOTO_MAX) throw new Error("La photo compressée doit être un JPEG de moins de 5 Mo.");
      photos.push(photo);
    }
    etape = "envoyer les photos";
    const adresses: string[] = [];
    for (let ordre = 0; ordre < photos.length; ordre++) {
      const chemin = `${boutiqueId}/${articleId}/${crypto.randomUUID()}.jpg`;
      chemins.push(chemin);
      const { error } = await client.storage.from("photos").upload(chemin, photos[ordre], { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      adresses.push(client.storage.from("photos").getPublicUrl(chemin).data.publicUrl);
    }
    etape = "enregistrer l’article";
    insertionTentee = true;
    const article: TablesInsert<"articles"> = { ...donneesArticle(saisie), id: articleId, boutique_id: boutiqueId, statut: "disponible", propose_par_ia: false };
    const { error: erreurArticle } = await client.from("articles").insert(article);
    if (erreurArticle) throw erreurArticle;
    etape = "enregistrer les photos";
    const lignesPhotos: TablesInsert<"photos">[] = adresses.map((adresse, ordre) => ({ article_id: articleId, adresse, ordre }));
    const { error: erreurPhotos } = await client.from("photos").insert(lignesPhotos);
    if (erreurPhotos) throw erreurPhotos;
    etape = "enregistrer les tailles";
    const lignesTailles: TablesInsert<"tailles">[] = normaliserTailles(saisie.tailles).map(libelle => ({ article_id: articleId, libelle, disponible: true }));
    const { error: erreurTailles } = await client.from("tailles").insert(lignesTailles);
    if (erreurTailles) throw erreurTailles;
    return articleId;
  } catch (error) {
    let nettoyageIncomplet = false;
    if (insertionTentee) {
      try {
        // Les clés étrangères suppriment également photos et tailles (ON DELETE CASCADE).
        const { error } = await client.from("articles").delete().eq("id", articleId).eq("boutique_id", boutiqueId);
        if (error) nettoyageIncomplet = true;
      } catch { nettoyageIncomplet = true; }
    }
    if (chemins.length) {
      try { const { error } = await client.storage.from("photos").remove(chemins); if (error) nettoyageIncomplet = true; }
      catch { nettoyageIncomplet = true; }
    }
    const detail = etape === "compresser les photos" && error instanceof Error ? ` ${error.message}` : "";
    const liaison = /^[aeiou]/.test(etape) ? "d’" : "de ";
    throw new ErreurPublicationArticle(`Impossible ${liaison}${etape}.${detail} ${nettoyageIncomplet ? "Le nettoyage n’a pas pu être terminé. Contactez l’administrateur avant de republier." : "Aucun article n’a été publié. Vous pouvez réessayer."}`);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "./supabase/types";
import { donneesArticle, normaliserTailles, validerArticle, type SaisieArticle } from "./article";
import { lirePhotoPreparee, preparerPhoto, type PhotoPreparee } from "./compression-photo";
import { verifierPhotoPreparee } from "./photo-preparee";

export const STATUTS_ARTICLE = { disponible: "Disponible", reserve: "Réservé", vendu: "Vendu", masque: "Masqué" } as const;
export type ArticleGere = Tables<"articles"> & { photos: Tables<"photos">[]; tailles: Tables<"tailles">[]; promos: Tables<"promos"> | null };
export type TailleModifiee = { libelle: string; disponible: boolean };
export const MASQUE_PAR_MODERATION = "Article masqué par la modération : contactez l’administrateur pour le rendre visible.";

export function confirmerModification<T extends object>(donnees: T, maintenant = new Date()) {
  return { ...donnees, derniere_confirmation: maintenant.toISOString() };
}

export function verifierPrixAvecPromo(prix: number, promo: { prix_promo: number } | null | undefined) {
  if (promo && prix <= promo.prix_promo) throw new Error("Le prix doit rester supérieur au prix promo, ou arrêtez d'abord la promo");
}

export function preparerTailles(articleId: string, existantes: TailleModifiee[], choisies: TailleModifiee[]) {
  const selection = new Map(choisies.map(t => [normaliserTailles([t.libelle])[0], t.disponible]));
  const libelles = normaliserTailles([...existantes.map(t => t.libelle), ...choisies.map(t => t.libelle)]);
  return libelles.map(libelle => ({ article_id: articleId, libelle, disponible: selection.get(libelle) ?? false }));
}

export function cheminPhotoArticle(adresse: string, boutiqueId: string, articleId: string): string | null {
  const url = new URL(adresse);
  // Les images externes (par exemple les données de démonstration) ne nous appartiennent pas.
  if (url.hostname !== "iloyliuzsflzbkhpvxjt.supabase.co") return null;
  const prefixe = "/storage/v1/object/public/photos/";
  if (!url.pathname.startsWith(prefixe)) throw new Error("Le chemin d’une photo est invalide. L’article a été conservé.");
  const chemin = decodeURIComponent(url.pathname.slice(prefixe.length));
  const parties = chemin.split("/");
  if (parties.length !== 3 || parties[0] !== boutiqueId || parties[1] !== articleId || !parties[2] || [".", ".."].includes(parties[2]) || parties[2].includes("\\")) throw new Error("Une photo n’appartient pas au dossier de cet article. L’article a été conservé.");
  return chemin;
}

export async function boutiqueDuCompte(client: SupabaseClient<Database>) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de charger votre profil. Réessayez.");
  if (!profil?.boutique_id) throw new Error("Votre compte n’est rattaché à aucune boutique");
  return profil.boutique_id;
}

export async function articleDeMaBoutique(client: SupabaseClient<Database>, id: string) {
  const boutiqueId = await boutiqueDuCompte(client);
  const { data, error } = await client.from("articles").select("*, photos(*), tailles(*), promos(*)").eq("boutique_id", boutiqueId).eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Cet article est introuvable dans votre boutique.");
  return data;
}

export async function changerStatut(client: SupabaseClient<Database>, id: string, statut: Enums<"statut_article">) {
  if (!Object.hasOwn(STATUTS_ARTICLE, statut)) throw new Error("Choisissez un statut valide.");
  const article = await articleDeMaBoutique(client, id);
  // Seul un admin lève un masquage de modération (vérifié aussi par la base).
  if (article.masque_par_moderation) throw new Error(MASQUE_PAR_MODERATION);
  const { data, error } = await client.from("articles").update(confirmerModification({ statut })).eq("id", id).eq("boutique_id", article.boutique_id).select("id").single();
  if (error || !data) throw new Error("Impossible de changer le statut. Réessayez.");
}

export type ModificationPhotos = { garder: string[]; fichiers: File[] };
type Compression = (fichier: File) => Promise<Blob | PhotoPreparee>;
export async function modifierArticle(client: SupabaseClient<Database>, id: string, saisie: SaisieArticle, tailles: TailleModifiee[], photos?: ModificationPhotos, compression: Compression = preparerPhoto) {
  const erreurs = validerArticle({ ...saisie, tailles: tailles.map(t => t.libelle) }, { verifierPhotos: false });
  if (Object.keys(erreurs).length) throw new Error("Vérifiez les champs du formulaire.");
  const article = await articleDeMaBoutique(client, id);
  // Confirmer d’abord l’article : même une modification partielle des tailles reste datée.
  verifierPrixAvecPromo(Number(saisie.prix.trim()), article.promos);
  if (photos) {
    if (new Set(photos.garder).size !== photos.garder.length || photos.garder.some(id => !article.photos.some(p => p.id === id)) || photos.garder.length + photos.fichiers.length < 1 || photos.garder.length + photos.fichiers.length > 5) throw new Error("Conservez entre 1 et 5 photos de cet article.");
  }
  const { data, error } = await client.from("articles").update(confirmerModification(donneesArticle(saisie))).eq("id", id).eq("boutique_id", article.boutique_id).select("id").single();
  if (error || !data) throw new Error("Impossible d’enregistrer l’article. Réessayez.");
  const { error: erreurTailles } = await client.from("tailles").upsert(preparerTailles(id, article.tailles, tailles), { onConflict: "article_id,libelle" });
  if (erreurTailles) throw new Error("Les informations ont été enregistrées, mais pas les tailles. Réessayez d’enregistrer.");
  if (photos) await modifierPhotosArticle(client, article, photos, compression);
}

export async function modifierPhotosArticle(client: SupabaseClient<Database>, article: ArticleGere, photos: ModificationPhotos, compression: Compression = preparerPhoto) {
  const stockage = client.storage.from("photos"), envoyes: string[] = [];
  let insertionTerminee = false;
  try {
    const nouvelles = [];
    for (const fichier of photos.fichiers) {
      const { photo, vignette } = verifierPhotoPreparee(lirePhotoPreparee(await compression(fichier)));
      const envoyer = async (contenu: Blob, suffixe = "") => {
        const chemin = `${article.boutique_id}/${article.id}/${crypto.randomUUID()}${suffixe}.jpg`;
        envoyes.push(chemin);
        const { error } = await stockage.upload(chemin, contenu, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        return stockage.getPublicUrl(chemin).data.publicUrl;
      };
      const adresse = await envoyer(photo);
      nouvelles.push({ article_id: article.id, adresse, adresse_vignette: vignette ? await envoyer(vignette, "-vignette") : null, ordre: photos.garder.length + nouvelles.length });
    }
    if (nouvelles.length) { const { error } = await client.from("photos").insert(nouvelles); if (error) throw error; }
    insertionTerminee = true;
    const retirees = article.photos.filter(p => !photos.garder.includes(p.id));
    if (retirees.length) {
      const { error } = await client.from("photos").delete().eq("article_id", article.id).in("id", retirees.map(p => p.id));
      if (error) throw new Error("Les nouvelles photos sont enregistrées, mais les anciennes n’ont pas pu être retirées. Rechargez la page avant de réessayer.");
      const chemins = retirees.flatMap(p => [p.adresse, p.adresse_vignette]).filter((a): a is string => Boolean(a)).map(a => cheminPhotoArticle(a, article.boutique_id, article.id)).filter((a): a is string => Boolean(a));
      if (chemins.length) { const { error } = await stockage.remove(chemins); if (error) throw new Error("Les photos sont mises à jour, mais le nettoyage du stockage a échoué. Contactez l’administrateur."); }
    }
    for (const [ordre, id] of photos.garder.entries()) { const { error } = await client.from("photos").update({ ordre }).eq("id", id).eq("article_id", article.id); if (error) throw new Error("Les photos sont enregistrées, mais leur ordre n’a pas pu être mis à jour. Rechargez la page."); }
  } catch (error) {
    if (!insertionTerminee && envoyes.length) { const { error: nettoyage } = await stockage.remove(envoyes); if (nettoyage) throw new Error("L’envoi des photos a échoué et le nettoyage est incomplet. Contactez l’administrateur."); }
    throw new Error(error instanceof Error && insertionTerminee ? error.message : "Les champs sont enregistrés, mais les photos n’ont pas été modifiées. Réessayez.");
  }
}

export async function supprimerArticle(client: SupabaseClient<Database>, id: string) {
  const article = await articleDeMaBoutique(client, id);
  const stockage = client.storage.from("photos");
  // Utiliser les adresses de la base : le stockage n’autorise pas forcément le listing.
  const chemins = [...new Set(article.photos.flatMap(photo => [photo.adresse, photo.adresse_vignette]).filter((adresse): adresse is string => Boolean(adresse)).map(adresse => cheminPhotoArticle(adresse, article.boutique_id, id)).filter((chemin): chemin is string => chemin !== null))];
  if (chemins.length) {
    const { error } = await stockage.remove(chemins);
    if (error) throw new Error("Impossible de supprimer les photos. L’article a été conservé ; réessayez.");
  }
  const { data, error } = await client.from("articles").delete().eq("id", id).eq("boutique_id", article.boutique_id).select("id").single();
  if (error || !data) throw new Error("Les photos ont été supprimées, mais l’article a été conservé. Réessayez de le supprimer.");
}

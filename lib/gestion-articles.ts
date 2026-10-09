import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "./supabase/types";
import { donneesArticle, normaliserTailles, validerArticle, type SaisieArticle } from "./article";

export const STATUTS_ARTICLE = { disponible: "Disponible", reserve: "Réservé", vendu: "Vendu", masque: "Masqué" } as const;
export type ArticleGere = Tables<"articles"> & { photos: Tables<"photos">[]; tailles: Tables<"tailles">[]; promos: Tables<"promos"> | null };
export type TailleModifiee = { libelle: string; disponible: boolean };

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
  const { data, error } = await client.from("articles").update(confirmerModification({ statut })).eq("id", id).eq("boutique_id", article.boutique_id).select("id").single();
  if (error || !data) throw new Error("Impossible de changer le statut. Réessayez.");
}

export async function modifierArticle(client: SupabaseClient<Database>, id: string, saisie: SaisieArticle, tailles: TailleModifiee[]) {
  const erreurs = validerArticle({ ...saisie, tailles: tailles.map(t => t.libelle) }, { verifierPhotos: false });
  if (Object.keys(erreurs).length) throw new Error("Vérifiez les champs du formulaire.");
  const article = await articleDeMaBoutique(client, id);
  // Confirmer d’abord l’article : même une modification partielle des tailles reste datée.
  verifierPrixAvecPromo(Number(saisie.prix.trim()), article.promos);
  const { data, error } = await client.from("articles").update(confirmerModification(donneesArticle(saisie))).eq("id", id).eq("boutique_id", article.boutique_id).select("id").single();
  if (error || !data) throw new Error("Impossible d’enregistrer l’article. Réessayez.");
  const { error: erreurTailles } = await client.from("tailles").upsert(preparerTailles(id, article.tailles, tailles), { onConflict: "article_id,libelle" });
  if (erreurTailles) throw new Error("Les informations ont été enregistrées, mais pas les tailles. Réessayez d’enregistrer.");
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

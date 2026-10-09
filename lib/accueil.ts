import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CATEGORIES_ARTICLE, UNIVERS, type CleUnivers } from "./article";
import { articleDansUnivers, limiteConfirmation, STATUTS_LISTES } from "./catalogue";

// Images de la page d'accueil, choisies automatiquement parmi les articles visibles du public :
// aucune image externe. Tuiles = miniature (400 px) du dernier article, grande photo d'accueil =
// grande photo (1200 px) du dernier article. Sans article : tuile unie avec le mot.
export const PIECES_PHARES = ["Robes", "Abayas, djellabas, kamis", "T-shirts et polos", "Pantalons et jeans", "Chaussures", "Parfums"] as const;
// Articles récents lus pour choisir les images (une seule requête légère).
export const LIMITE_ARTICLES_ACCUEIL = 200;

export type ImageAccueil = { adresse: string; titre: string; articleId: string };
export type TuileAccueil = { nom: string; lien: string; image: ImageAccueil | null };
export type ImagesAccueil = { grande: ImageAccueil | null; univers: TuileAccueil[]; categories: TuileAccueil[] };
export type LigneAccueil = { id: string; titre: string; categorie: string; genre: string; photos: { adresse: string; adresse_vignette: string | null; ordre: number }[] };

function premierePhoto(article: LigneAccueil) {
  return [...article.photos].sort((a, b) => a.ordre - b.ordre)[0] ?? null;
}

function miniature(article: LigneAccueil | undefined): ImageAccueil | null {
  const photo = article && premierePhoto(article);
  return article && photo ? { adresse: photo.adresse_vignette ?? photo.adresse, titre: article.titre, articleId: article.id } : null;
}

export function lienUnivers(cle: CleUnivers): string {
  return `/catalogue?univers=${cle}`;
}

export function lienCategorie(categorie: string): string {
  return `/catalogue?${new URLSearchParams({ categorie })}`;
}

// `articles` : du plus récent au plus ancien.
export function choisirImagesAccueil(articles: LigneAccueil[]): ImagesAccueil {
  const avecPhoto = articles.filter(a => premierePhoto(a));
  const derniere = avecPhoto[0];
  const photo = derniere && premierePhoto(derniere);
  return {
    grande: derniere && photo ? { adresse: photo.adresse, titre: derniere.titre, articleId: derniere.id } : null,
    univers: UNIVERS.map(u => ({ nom: u.nom, lien: lienUnivers(u.cle), image: miniature(avecPhoto.find(a => articleDansUnivers(a, u.cle))) })),
    categories: PIECES_PHARES.filter(c => CATEGORIES_ARTICLE.some(x => x === c)).map(c => ({ nom: c, lien: lienCategorie(c), image: miniature(avecPhoto.find(a => a.categorie === c)) })),
  };
}

// Même visibilité publique que le catalogue (boutique validée, disponible ou réservé, confirmé < 21 jours).
export async function chargerImagesAccueil(client: SupabaseClient<Database>, maintenant = new Date()): Promise<ImagesAccueil> {
  const { data, error } = await client.from("articles").select("id, titre, categorie, genre, boutiques!inner(statut), photos(adresse, adresse_vignette, ordre)")
    .in("statut", [...STATUTS_LISTES]).eq("boutiques.statut", "validee").gt("derniere_confirmation", limiteConfirmation(maintenant))
    .order("cree_le", { ascending: false }).order("id").range(0, LIMITE_ARTICLES_ACCUEIL - 1);
  // Les images sont décoratives : en cas d'erreur, l'accueil s'affiche avec les tuiles unies.
  if (error) return choisirImagesAccueil([]);
  return choisirImagesAccueil((data ?? []) as unknown as LigneAccueil[]);
}

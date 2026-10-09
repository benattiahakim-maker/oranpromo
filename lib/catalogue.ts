import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { prixAffiche, promoActive, type Promo } from "./prix";
import { CATEGORIES_ARTICLE, CATEGORIES_BEAUTE, CATEGORIES_MODE, UNIVERS, type CleUnivers } from "./article";

export type CarteArticle = { id: string; titre: string; description: string | null; categorie: string; genre: string; prix: number; cree_le: string; boutique: { nom: string; quartier: string }; photo: string | null; tailles: string[]; promo: Promo | null };

// Visibilité publique, identique à prive.article_visible() : boutique validée, article disponible ou
// réservé, confirmé il y a moins de 21 jours. Filtrer explicitement évite qu'un admin (qui lit tout)
// ou un commerçant (qui lit ses articles expirés) voie dans les listes publiques ce que le public ne voit pas.
export const JOURS_VISIBILITE = 21;
export const STATUTS_LISTES = ["disponible", "reserve"] as const;
// Nombre maximal d'articles lus par requête du catalogue (les plus récents d'abord).
export const LIMITE_CATALOGUE = 1000;
export const ARTICLES_PAR_PAGE = 20;

export function limiteConfirmation(maintenant = new Date()): string {
  return new Date(maintenant.getTime() - JOURS_VISIBILITE * 24 * 60 * 60 * 1000).toISOString();
}

const COLONNES_CARTE = "id, titre, description, categorie, genre, prix, cree_le, boutiques!inner(nom, quartier, statut), photos(adresse, adresse_vignette, ordre), tailles(libelle, disponible)";

type LigneCarte = Omit<CarteArticle, "boutique" | "photo" | "tailles" | "promo"> & { boutiques: { nom: string; quartier: string }; photos: { adresse: string; adresse_vignette: string | null; ordre: number }[]; tailles: { libelle: string; disponible: boolean }[]; promos: { prix_promo: number; date_fin: string } | null };

function versCarte(article: LigneCarte): CarteArticle {
  const photo = [...article.photos].sort((a, b) => a.ordre - b.ordre)[0];
  return { id: article.id, titre: article.titre, description: article.description, categorie: article.categorie, genre: article.genre, prix: article.prix, cree_le: article.cree_le, boutique: { nom: article.boutiques.nom, quartier: article.boutiques.quartier }, photo: photo?.adresse_vignette ?? photo?.adresse ?? null, tailles: article.tailles.filter(t => t.disponible).map(t => t.libelle), promo: article.promos ? { prixPromo: article.promos.prix_promo, dateFin: article.promos.date_fin } : null };
}

export async function chargerPromos(client: SupabaseClient<Database>, page = 0, maintenant = new Date()): Promise<CarteArticle[]> {
  const { data, error } = await client.from("articles").select(`${COLONNES_CARTE}, promos!inner(prix_promo, date_fin)`)
    .in("statut", [...STATUTS_LISTES]).eq("boutiques.statut", "validee").gt("derniere_confirmation", limiteConfirmation(maintenant))
    .gte("promos.date_fin", maintenant.toISOString())
    .order("cree_le", { ascending: false }).order("id").range(page * ARTICLES_PAR_PAGE, page * ARTICLES_PAR_PAGE + ARTICLES_PAR_PAGE - 1);
  if (error) throw new Error("Impossible de charger les promotions.");
  return ((data ?? []) as unknown as LigneCarte[]).map(versCarte);
}

export function normaliserRecherche(texte: string): string {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export type FiltresCatalogue = { q?: string; univers?: string; categorie?: string; taille?: string; genre?: string; min?: number; max?: number; quartier?: string; promo?: boolean };

export function estUnivers(valeur: string | undefined): valeur is CleUnivers {
  return UNIVERS.some(u => u.cle === valeur);
}

// Un univers regroupe des catégories et des genres : Femme / Homme = mode du genre ou mixte,
// Enfant = mode enfant, Beauté = les 5 catégories beauté (tous genres).
export function critereUnivers(univers: CleUnivers): { categories: readonly string[]; genres: string[] | null } {
  if (univers === "beaute") return { categories: CATEGORIES_BEAUTE, genres: null };
  return { categories: CATEGORIES_MODE, genres: univers === "enfant" ? ["enfant"] : [univers, "mixte"] };
}

export function articleDansUnivers(article: { categorie: string; genre: string }, univers: CleUnivers): boolean {
  const { categories, genres } = critereUnivers(univers);
  return categories.includes(article.categorie) && (!genres || genres.includes(article.genre));
}

// Ordre de la liste officielle (mode puis beauté), les valeurs inconnues à la fin par ordre alphabétique.
export function trierCategories(categories: string[]): string[] {
  const rang = (c: string) => { const i = CATEGORIES_ARTICLE.findIndex(x => x === c); return i < 0 ? CATEGORIES_ARTICLE.length : i; };
  return [...new Set(categories)].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, "fr"));
}

export function filtrerCatalogue(articles: CarteArticle[], filtres: FiltresCatalogue, maintenant = new Date()): CarteArticle[] {
  const recherche = normaliserRecherche(filtres.q ?? "");
  return articles.filter(article => {
    const prix = prixAffiche(article.prix, article.promo, maintenant);
    return (!estUnivers(filtres.univers) || articleDansUnivers(article, filtres.univers))
      && (!recherche || normaliserRecherche(`${article.titre} ${article.description ?? ""} ${article.categorie}`).includes(recherche))
      && (!filtres.categorie || article.categorie === filtres.categorie)
      && (!filtres.taille || article.tailles.includes(filtres.taille))
      && (!filtres.genre || article.genre === filtres.genre)
      && (filtres.min === undefined || prix >= filtres.min)
      && (filtres.max === undefined || prix <= filtres.max)
      && (!filtres.quartier || article.boutique.quartier === filtres.quartier)
      && (!filtres.promo || promoActive(article.promo, maintenant));
  });
}

// Les filtres exacts (catégorie, genre, quartier, taille, promo) sont appliqués par la base ; la recherche
// sans accents et le prix affiché (promo active) restent calculés par filtrerCatalogue sur au plus
// LIMITE_CATALOGUE articles, au lieu de tout le catalogue à chaque requête.
export async function chargerCatalogue(client: SupabaseClient<Database>, filtres: FiltresCatalogue = {}, maintenant = new Date()): Promise<CarteArticle[]> {
  const colonnes = [COLONNES_CARTE, "promos(prix_promo, date_fin)", filtres.taille ? "filtre_taille:tailles!inner(libelle)" : "", filtres.promo ? "filtre_promo:promos!inner(date_fin)" : ""].filter(Boolean).join(", ");
  let requete = client.from("articles").select(colonnes)
    .in("statut", [...STATUTS_LISTES]).eq("boutiques.statut", "validee").gt("derniere_confirmation", limiteConfirmation(maintenant));
  if (filtres.categorie) requete = requete.eq("categorie", filtres.categorie);
  if (estUnivers(filtres.univers)) {
    const { categories, genres } = critereUnivers(filtres.univers);
    requete = requete.in("categorie", [...categories]);
    if (genres) requete = requete.in("genre", genres as Database["public"]["Enums"]["genre_article"][]);
  }
  if (filtres.genre) requete = requete.eq("genre", filtres.genre as Database["public"]["Enums"]["genre_article"]);
  if (filtres.quartier) requete = requete.eq("boutiques.quartier", filtres.quartier);
  if (filtres.taille) requete = requete.eq("filtre_taille.libelle", filtres.taille).eq("filtre_taille.disponible", true);
  if (filtres.promo) requete = requete.gt("filtre_promo.date_fin", maintenant.toISOString());
  const { data, error } = await requete.order("cree_le", { ascending: false }).order("id").range(0, LIMITE_CATALOGUE - 1);
  if (error) throw new Error("Impossible de charger le catalogue.");
  return filtrerCatalogue(((data ?? []) as unknown as LigneCarte[]).map(versCarte), filtres, maintenant);
}

export type OptionsCatalogue = { categories: string[]; tailles: string[]; quartiers: string[] };

// Valeurs proposées dans les listes de filtres : lecture légère, limitée aux articles publics.
export async function chargerOptionsCatalogue(client: SupabaseClient<Database>, maintenant = new Date()): Promise<OptionsCatalogue> {
  const { data, error } = await client.from("articles").select("categorie, boutiques!inner(quartier, statut), tailles(libelle, disponible)")
    .in("statut", [...STATUTS_LISTES]).eq("boutiques.statut", "validee").gt("derniere_confirmation", limiteConfirmation(maintenant))
    .order("cree_le", { ascending: false }).order("id").range(0, LIMITE_CATALOGUE - 1);
  if (error) throw new Error("Impossible de charger le catalogue.");
  const lignes = (data ?? []) as unknown as { categorie: string; boutiques: { quartier: string }; tailles: { libelle: string; disponible: boolean }[] }[];
  const trier = (valeurs: string[]) => [...new Set(valeurs)].sort();
  return { categories: trierCategories(lignes.map(l => l.categorie)), tailles: trier(lignes.flatMap(l => l.tailles.filter(t => t.disponible).map(t => t.libelle))), quartiers: trier(lignes.map(l => l.boutiques.quartier)) };
}

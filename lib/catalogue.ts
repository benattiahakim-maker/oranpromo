import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { prixAffiche, promoActive, type Promo } from "./prix";

export type CarteArticle = { id: string; titre: string; description: string | null; categorie: string; genre: string; prix: number; cree_le: string; boutique: { nom: string; quartier: string }; photo: string | null; tailles: string[]; promo: Promo | null };

export async function chargerPromos(client: SupabaseClient<Database>, page = 0): Promise<CarteArticle[]> {
  const { data, error } = await client.from("articles").select("id, titre, description, categorie, genre, prix, cree_le, boutiques!inner(nom, quartier), photos(adresse, adresse_vignette, ordre), tailles(libelle, disponible), promos!inner(prix_promo, date_fin)")
    .in("statut", ["disponible", "reserve"]).gte("promos.date_fin", new Date().toISOString())
    .order("cree_le", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
  if (error) throw new Error("Impossible de charger les promotions.");
  return (data ?? []).map(article => {
    const photo = [...article.photos].sort((a, b) => a.ordre - b.ordre)[0];
    return { ...article, boutique: article.boutiques, photo: photo?.adresse_vignette ?? photo?.adresse ?? null, tailles: article.tailles.filter(t => t.disponible).map(t => t.libelle), promo: article.promos ? { prixPromo: article.promos.prix_promo, dateFin: article.promos.date_fin } : null };
  });
}

export function normaliserRecherche(texte: string): string {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export type FiltresCatalogue = { q?: string; categorie?: string; taille?: string; genre?: string; min?: number; max?: number; quartier?: string; promo?: boolean };

export function filtrerCatalogue(articles: CarteArticle[], filtres: FiltresCatalogue, maintenant = new Date()): CarteArticle[] {
  const recherche = normaliserRecherche(filtres.q ?? "");
  return articles.filter(article => {
    const prix = prixAffiche(article.prix, article.promo, maintenant);
    return (!recherche || normaliserRecherche(`${article.titre} ${article.description ?? ""} ${article.categorie}`).includes(recherche))
      && (!filtres.categorie || article.categorie === filtres.categorie)
      && (!filtres.taille || article.tailles.includes(filtres.taille))
      && (!filtres.genre || article.genre === filtres.genre)
      && (filtres.min === undefined || prix >= filtres.min)
      && (filtres.max === undefined || prix <= filtres.max)
      && (!filtres.quartier || article.boutique.quartier === filtres.quartier)
      && (!filtres.promo || promoActive(article.promo, maintenant));
  });
}

export async function chargerCatalogue(client: SupabaseClient<Database>): Promise<CarteArticle[]> {
  const articles: CarteArticle[] = [];
  // Lire toutes les pages évite la limite implicite de 1 000 lignes de Supabase.
  for (let debut = 0; ; debut += 500) {
    const { data, error } = await client.from("articles").select("id, titre, description, categorie, genre, prix, cree_le, boutiques!inner(nom, quartier), photos(adresse, adresse_vignette, ordre), tailles(libelle, disponible), promos(prix_promo, date_fin)")
      .in("statut", ["disponible", "reserve"]).order("cree_le", { ascending: false }).order("id").range(debut, debut + 499);
    if (error) throw new Error("Impossible de charger le catalogue.");
    for (const article of data ?? []) {
      const photo = [...article.photos].sort((a, b) => a.ordre - b.ordre)[0];
      articles.push({ ...article, boutique: article.boutiques, photo: photo?.adresse_vignette ?? photo?.adresse ?? null, tailles: article.tailles.filter(t => t.disponible).map(t => t.libelle), promo: article.promos ? { prixPromo: article.promos.prix_promo, dateFin: article.promos.date_fin } : null });
    }
    if (!data || data.length < 500) return articles;
  }
}

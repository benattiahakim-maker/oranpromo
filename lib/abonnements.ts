import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { promoActive } from "./prix";
import { villeLue } from "./ville";

/** US-31.2 : suivre une boutique (table abonnements_boutique, fonctions suivre_boutique et ne_plus_suivre). */

type Client = SupabaseClient<Database>;

/** Cookie posé par « Suivre » sans être connecté : slug de la boutique à suivre une fois connecté. */
export const COOKIE_SUIVRE = "suivre_boutique";
export const DUREE_COOKIE_SUIVRE = 60 * 60; // 1 h : le temps de recevoir le lien ou le code

export type ErreurAbonnement = "connexion" | "plafond" | "introuvable" | "reserve" | "erreur";

/** Codes renvoyés par la base (migration 20261016090000) → clé du texte affiché (section « suivre »). */
export function erreurAbonnement(error: { code?: string } | null | undefined): ErreurAbonnement {
  switch (error?.code) {
    case "54000": return "plafond";
    case "P0002": return "introuvable";
    case "42501": return "reserve";
    default: return "erreur";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && UUID.test(valeur);
}

export type BoutiqueSuivie = { id: string; nom: string; slug: string; quartier: string; ville: { nom: string; nom_ar: string } | null; promos: number };

type PromoLue = { prix_promo: number; date_fin: string } | { prix_promo: number; date_fin: string }[] | null;
type LigneLue = {
  cree_le: string;
  boutiques: {
    id: string; nom: string; slug: string; quartier: string; statut: string;
    villes: { nom: string; nom_ar: string } | { nom: string; nom_ar: string }[] | null;
    articles: { statut: string; promos: PromoLue }[] | null;
  } | null;
};

/** Nombre de promos en cours (articles disponibles dont la promo n'est pas finie). */
export function compterPromos(articles: { statut: string; promos: PromoLue }[] | null | undefined, maintenant: Date): number {
  return (articles ?? []).filter(article => {
    if (article.statut !== "disponible") return false;
    const promo = Array.isArray(article.promos) ? article.promos[0] : article.promos;
    return promoActive(promo ? { prixPromo: promo.prix_promo, dateFin: promo.date_fin } : null, maintenant);
  }).length;
}

/** Boutiques suivies encore visibles (validées), la plus récemment suivie en premier. */
export function boutiquesSuivies(lignes: LigneLue[], maintenant: Date): BoutiqueSuivie[] {
  return [...lignes].sort((a, b) => b.cree_le.localeCompare(a.cree_le)).flatMap(ligne => {
    const b = ligne.boutiques;
    if (!b || b.statut !== "validee") return [];
    const ville = villeLue(b.villes);
    return [{ id: b.id, nom: b.nom, slug: b.slug, quartier: b.quartier, ville: ville ? { nom: ville.nom, nom_ar: ville.nom_ar } : null, promos: compterPromos(b.articles, maintenant) }];
  });
}

export async function listerMesBoutiques(client: Client, maintenant = new Date()): Promise<BoutiqueSuivie[]> {
  const { data, error } = await client.from("abonnements_boutique")
    .select("cree_le, boutiques(id, nom, slug, quartier, statut, villes(nom, nom_ar), articles(statut, promos(prix_promo, date_fin)))");
  if (error) throw new Error("Impossible de charger vos boutiques. Réessayez.");
  return boutiquesSuivies((data ?? []) as unknown as LigneLue[], maintenant);
}

/** Nombre de boutiques suivies encore visibles (ligne « Mes boutiques (n) » de /compte). */
/** Jamais d'erreur : un problème de lecture affiche « Mes boutiques (0) » plutôt que de casser /compte. */
export async function compterMesBoutiques(client: Client): Promise<number> {
  try {
    const { count, error } = await client.from("abonnements_boutique")
      .select("boutique_id, boutiques!inner(statut)", { count: "exact", head: true })
      .eq("boutiques.statut", "validee");
    return error ? 0 : count ?? 0;
  } catch { return 0; }
}

export async function estSuivie(client: Client, boutiqueId: string): Promise<boolean> {
  const { data } = await client.from("abonnements_boutique").select("boutique_id").eq("boutique_id", boutiqueId).maybeSingle();
  return Boolean(data);
}

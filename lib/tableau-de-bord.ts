import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";
import { bornesStatistiques } from "./statistiques";

export type BoutiqueActivite = Pick<Tables<"boutiques">, "id" | "nom" | "quartier" | "whatsapp" | "statut">;
export type ArticleActivite = Pick<Tables<"articles">, "id" | "boutique_id" | "statut" | "derniere_confirmation">;
export type DonneesActivite = { boutiques: BoutiqueActivite[]; articles: ArticleActivite[]; promos: Pick<Tables<"promos">, "date_fin">[]; evenements: Pick<Tables<"evenements">, "date" | "type">[]; signalements: Pick<Tables<"signalements">, "statut">[] };

export function calculerTableauDeBord(donnees: DonneesActivite, maintenant = new Date()) {
  const fin = maintenant.getTime(), seuil = fin - 21 * 86400000;
  const validees = donnees.boutiques.filter(b => b.statut === "validee");
  const idsValides = new Set(validees.map(b => b.id));
  const dernieres = new Map<string, string>();
  for (const article of donnees.articles) {
    const date = Date.parse(article.derniere_confirmation);
    if (!Number.isFinite(date)) continue;
    const precedente = dernieres.get(article.boutique_id);
    if (!precedente || date > Date.parse(precedente)) dernieres.set(article.boutique_id, article.derniere_confirmation);
  }
  const clics = (jours: 7 | 30) => donnees.evenements.filter(e => e.type === "clic_reserver" && Date.parse(e.date) >= Date.parse(bornesStatistiques(jours, maintenant).debut) && Date.parse(e.date) <= fin).length;
  return {
    boutiquesValidees: validees.length,
    boutiquesEnAttente: donnees.boutiques.filter(b => b.statut === "en_attente").length,
    articlesEnLigne: donnees.articles.filter(a => idsValides.has(a.boutique_id) && ["disponible", "reserve"].includes(a.statut) && Date.parse(a.derniere_confirmation) > seuil).length,
    promosEnCours: donnees.promos.filter(p => Date.parse(p.date_fin) > fin).length,
    clics7Jours: clics(7), clics30Jours: clics(30),
    signalementsOuverts: donnees.signalements.filter(s => s.statut === "ouvert").length,
    aRelancer: validees.map(b => ({ ...b, derniereMiseAJour: dernieres.get(b.id) ?? null })).filter(b => !b.derniereMiseAJour || Date.parse(b.derniereMiseAJour) <= seuil).sort((a, b) => (a.derniereMiseAJour ? Date.parse(a.derniereMiseAJour) : -Infinity) - (b.derniereMiseAJour ? Date.parse(b.derniereMiseAJour) : -Infinity) || a.nom.localeCompare(b.nom)),
  };
}

// Parcourir toutes les pages Supabase : un compteur ne doit pas s’arrêter à la limite de réponse.
async function lireToutesLesPages<T>(lecture: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += 500) {
    const { data, error } = await lecture(debut, debut + 499);
    if (error || !data) throw new Error("Impossible de charger l’activité. Réessayez.");
    lignes.push(...data);
    if (data.length < 500) return lignes;
  }
}

export async function chargerTableauDeBord(client: SupabaseClient<Database>, maintenant = new Date()) {
  const bornes = bornesStatistiques(30, maintenant);
  const [boutiques, articles, promos, evenements, signalements] = await Promise.all([
    lireToutesLesPages((debut, fin) => client.from("boutiques").select("id, nom, quartier, whatsapp, statut").order("id").range(debut, fin)),
    lireToutesLesPages((debut, fin) => client.from("articles").select("id, boutique_id, statut, derniere_confirmation").order("id").range(debut, fin)),
    lireToutesLesPages((debut, fin) => client.from("promos").select("date_fin").gt("date_fin", bornes.fin).order("article_id").range(debut, fin)),
    lireToutesLesPages((debut, fin) => client.from("evenements").select("type, date").eq("type", "clic_reserver").gte("date", bornes.debut).lte("date", bornes.fin).order("id").range(debut, fin)),
    lireToutesLesPages((debut, fin) => client.from("signalements").select("statut").eq("statut", "ouvert").order("id").range(debut, fin)),
  ]);
  return calculerTableauDeBord({ boutiques, articles, promos, evenements, signalements }, maintenant);
}

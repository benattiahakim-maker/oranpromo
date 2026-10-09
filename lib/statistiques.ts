import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";

export type DureeStatistiques = 7 | 30;
export type EvenementStatistique = Pick<Tables<"evenements">, "type" | "boutique_id" | "article_id" | "date">;
export type BornesStatistiques = { debut: string; fin: string };
export type StatistiquesBoutique = { vuesBoutique: number; vuesArticles: number; clicsReservation: number; topArticles: { id: string; titre: string; vues: number; clics: number }[] };

export function dureeStatistiques(valeur: string | string[] | undefined): DureeStatistiques { return valeur === "30" ? 30 : 7; }

// Fenêtre glissante de 7 ou 30 jours complets, avec le même instant de fin pour toutes les lectures.
export function bornesStatistiques(jours: DureeStatistiques, maintenant = new Date()): BornesStatistiques {
  return { debut: new Date(maintenant.getTime() - jours * 24 * 60 * 60 * 1000).toISOString(), fin: maintenant.toISOString() };
}

export function calculerStatistiques(evenements: EvenementStatistique[], boutiqueId: string, bornes: BornesStatistiques, articles: { id: string; titre: string }[] = []): StatistiquesBoutique {
  const resultat: StatistiquesBoutique = { vuesBoutique: 0, vuesArticles: 0, clicsReservation: 0, topArticles: [] };
  const titres = new Map(articles.map(article => [article.id, article.titre]));
  const comptes = new Map<string, { vues: number; clics: number }>();
  const debut = Date.parse(bornes.debut), fin = Date.parse(bornes.fin);
  for (const evenement of evenements) {
    const date = Date.parse(evenement.date);
    if (evenement.boutique_id !== boutiqueId || !Number.isFinite(date) || date < debut || date > fin) continue;
    if (evenement.type === "vue_boutique") resultat.vuesBoutique++;
    if (evenement.type === "vue_article") resultat.vuesArticles++;
    if (evenement.type === "clic_reserver") resultat.clicsReservation++;
    if (!evenement.article_id || !["vue_article", "clic_reserver"].includes(evenement.type)) continue;
    const compte = comptes.get(evenement.article_id) ?? { vues: 0, clics: 0 };
    if (evenement.type === "vue_article") compte.vues++; else compte.clics++;
    comptes.set(evenement.article_id, compte);
  }
  resultat.topArticles = [...comptes].filter(([, compte]) => compte.vues > 0).sort(([idA, a], [idB, b]) => b.vues - a.vues || idA.localeCompare(idB)).slice(0, 5).map(([id, compte]) => ({ id, titre: titres.get(id) ?? "Article indisponible", ...compte }));
  return resultat;
}

export async function chargerStatistiques(client: SupabaseClient<Database>, boutiqueId: string, jours: DureeStatistiques, maintenant = new Date()) {
  const bornes = bornesStatistiques(jours, maintenant);
  const evenements: EvenementStatistique[] = [];
  // Supabase limite les réponses : paginer pour ne jamais sous-compter une boutique fréquentée.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("evenements").select("type, boutique_id, article_id, date").eq("boutique_id", boutiqueId).gte("date", bornes.debut).lte("date", bornes.fin).order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new Error("Impossible de charger vos statistiques. Réessayez.");
    evenements.push(...data);
    if (data.length < 500) break;
  }
  const classement = calculerStatistiques(evenements, boutiqueId, bornes);
  if (!classement.topArticles.length) return classement;
  const { data: articles, error } = await client.from("articles").select("id, titre").eq("boutique_id", boutiqueId).in("id", classement.topArticles.map(article => article.id));
  if (error) throw new Error("Impossible de charger les titres de vos articles. Réessayez.");
  return calculerStatistiques(evenements, boutiqueId, bornes, articles ?? []);
}

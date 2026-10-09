import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";

export const ACTIONS_MODERATION = { masquer: "Masquer l’article", avertir: "Avertir la boutique", suspendre: "Suspendre la boutique", classer: "Classer sans suite" } as const;
export const MOTIFS_SIGNALEMENT: Record<string, string> = { contrefacon: "Contrefaçon", contenu_inapproprie: "Contenu inapproprié", arnaque: "Arnaque", autre: "Autre" };
export type ActionModeration = keyof typeof ACTIONS_MODERATION;
export type ArticleSignale = { id: string; titre: string; boutique_id: string; photos: { adresse: string; ordre: number }[]; boutiques: { id: string; nom: string; whatsapp: string; statut: Tables<"boutiques">["statut"] } | null };
export type SignalementModeration = Tables<"signalements"> & { articles: ArticleSignale | null };
export type GroupeSignalements = { articleId: string; article: ArticleSignale | null; signalements: SignalementModeration[]; nombre: number; derniereDate: string; motifs: { motif: string; nombre: number }[] };
export type DecisionHistorique = { id: string; date: string; action: string; articleId: string | null; titre: string };

export function regrouperSignalements(signalements: SignalementModeration[]): GroupeSignalements[] {
  const groupes = new Map<string, SignalementModeration[]>();
  for (const signalement of signalements) {
    if (signalement.statut !== "ouvert") continue;
    groupes.set(signalement.article_id, [...(groupes.get(signalement.article_id) ?? []), signalement]);
  }
  return [...groupes].map(([articleId, liste]) => {
    const tries = [...liste].sort((a, b) => Date.parse(b.cree_le) - Date.parse(a.cree_le) || a.id.localeCompare(b.id));
    const motifs = new Map<string, number>();
    for (const signalement of tries) motifs.set(signalement.motif, (motifs.get(signalement.motif) ?? 0) + 1);
    return { articleId, article: tries.find(s => s.articles)?.articles ?? null, signalements: tries, nombre: tries.length, derniereDate: tries[0].cree_le, motifs: [...motifs].map(([motif, nombre]) => ({ motif, nombre })).sort((a, b) => b.nombre - a.nombre || a.motif.localeCompare(b.motif)) };
  }).sort((a, b) => b.nombre - a.nombre || Date.parse(b.derniereDate) - Date.parse(a.derniereDate) || a.articleId.localeCompare(b.articleId));
}

export async function verifierAdministrateur(client: SupabaseClient<Database>): Promise<string> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("role").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de vérifier votre accès. Réessayez.");
  if (profil?.role !== "admin") throw new Error("Accès réservé");
  return user.id;
}

export async function chargerSignalements(client: SupabaseClient<Database>) {
  const signalements: SignalementModeration[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("signalements").select("*, articles(id, titre, boutique_id, photos(adresse, ordre), boutiques(id, nom, whatsapp, statut))").eq("statut", "ouvert").order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new Error("Impossible de charger les signalements. Réessayez.");
    signalements.push(...data);
    if (data.length < 500) return regrouperSignalements(signalements);
  }
}

export async function chargerHistoriqueModeration(client: SupabaseClient<Database>): Promise<DecisionHistorique[]> {
  const { data, error } = await client.from("decisions").select("id, date, action, signalements(article_id, articles(titre))").order("date", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (error || !data) throw new Error("Impossible de charger l’historique. Réessayez.");
  return data.map(decision => ({ id: decision.id, date: decision.date, action: decision.action, articleId: decision.signalements?.article_id ?? null, titre: decision.signalements?.articles?.titre ?? "Article indisponible" }));
}

export async function modererArticle(client: SupabaseClient<Database>, articleId: string, ids: string[], action: ActionModeration) {
  const auteurId = await verifierAdministrateur(client);
  if (!Object.hasOwn(ACTIONS_MODERATION, action)) throw new Error("Choisissez une action valide.");
  const selection = [...new Set(ids)];
  if (!selection.length) throw new Error("Aucun signalement à traiter.");
  // Ne traiter que les signalements vus par l’admin, jamais ceux arrivés après la confirmation.
  const { data: signalements, error: erreurLecture } = await client.from("signalements").select("id, article_id").eq("article_id", articleId).eq("statut", "ouvert").in("id", selection);
  if (erreurLecture) throw new Error("Impossible de vérifier les signalements. Réessayez.");
  if (!signalements || signalements.length !== selection.length) throw new Error("Ces signalements ont changé. Actualisez la page avant de continuer.");
  const { data: article, error: erreurArticle } = await client.from("articles").select("id, boutique_id").eq("id", articleId).maybeSingle();
  if (erreurArticle || !article) throw new Error("Cet article est introuvable. Actualisez la page.");
  let effetApplique = false;
  if (action === "masquer" || action === "suspendre") {
    const requete = action === "masquer" ? client.from("articles").update({ statut: "masque", masque_par_moderation: true }).eq("id", articleId) : client.from("boutiques").update({ statut: "suspendue" }).eq("id", article.boutique_id);
    const { data, error } = await requete.select("id").single();
    if (error || !data) throw new Error("Impossible d’appliquer cette action. Les signalements restent ouverts.");
    effetApplique = true;
  }
  // Conserver la file ouverte si l’audit échoue : aucune clôture sans décision enregistrée.
  const { error: erreurDecision } = await client.from("decisions").insert(selection.map(signalement_id => ({ signalement_id, action, auteur_id: auteurId })));
  if (erreurDecision) throw new Error(effetApplique ? "L’action a été appliquée, mais les décisions n’ont pas été enregistrées. Les signalements restent ouverts ; réessayez." : "Impossible d’enregistrer les décisions. Les signalements restent ouverts.");
  const { data: traites, error: erreurTraitement } = await client.from("signalements").update({ statut: action === "classer" ? "rejete" : "traite" }).eq("article_id", articleId).eq("statut", "ouvert").in("id", selection).select("id");
  if (erreurTraitement || traites?.length !== selection.length) throw new Error("Les décisions ont été enregistrées, mais certains signalements n’ont pas été clôturés. Actualisez la page avant de continuer.");
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";

export const ACTIONS_MODERATION = { masquer: "Masquer l’article", avertir: "Avertir la boutique", suspendre: "Suspendre la boutique", classer: "Classer sans suite" } as const;
export const MOTIFS_SIGNALEMENT: Record<string, string> = { contrefacon: "Contrefaçon", contenu_inapproprie: "Contenu inapproprié", arnaque: "Arnaque", autre: "Autre" };
export type ActionModeration = keyof typeof ACTIONS_MODERATION;
export type ArticleSignale = { id: string; titre: string; boutique_id: string; photos: { adresse: string; ordre: number }[]; boutiques: { id: string; nom: string; whatsapp: string; statut: Tables<"boutiques">["statut"] } | null };
export type SignalementModeration = Tables<"signalements"> & { articles: ArticleSignale | null };
export type GroupeSignalements = { articleId: string; article: ArticleSignale | null; signalements: SignalementModeration[]; nombre: number; derniereDate: string; motifs: { motif: string; nombre: number }[] };
export type DecisionHistorique = { id: string; date: string; action: string; articleId: string | null; titre: string };

// US-32.4 : signalements d'avis (onglet « Avis » de /admin/moderation), traités par la fonction moderer_avis.
export const ACTIONS_MODERATION_AVIS = { masquer_avis: "Masquer l’avis", masquer_reponse: "Masquer la réponse", classer_signalement_avis: "Classer" } as const;
export const MOTIFS_SIGNALEMENT_AVIS: Record<string, string> = { faux_avis: "Faux avis", insulte: "Insulte ou propos déplacés", informations_personnelles: "Informations personnelles", autre: "Autre" };
export const LIBELLES_DECISIONS: Record<string, string> = { ...ACTIONS_MODERATION, masquer_avis: "Masquer l’avis", masquer_reponse: "Masquer la réponse", classer_signalement_avis: "Classer (avis)" };
export type ActionModerationAvis = keyof typeof ACTIONS_MODERATION_AVIS;
export type AvisSignale = { id: string; note: number; commentaire: string | null; reponse: string | null; reponse_masquee: boolean; statut: string; cree_le: string; boutiques: { nom: string } | null; profils: { nom: string | null } | null };
export type SignalementAvisModeration = Tables<"signalements_avis"> & { avis: AvisSignale | null };
export type GroupeSignalementsAvis = { avisId: string; avis: AvisSignale | null; auteur: string; signalements: SignalementAvisModeration[]; nombre: number; derniereDate: string; motifs: { motif: string; nombre: number }[] };
export const TYPES_SIGNAUX_AVIS = ["comptes_recents", "avis_groupes", "meme_numero", "retraits_rapides"] as const;
export type TypeSignalAvis = (typeof TYPES_SIGNAUX_AVIS)[number];
export type SignalAvis = { signal: TypeSignalAvis; boutiqueId: string; boutique: string; nombre: number; detail: string | null };

/** Phrase d'un signal de fraude (information pour l'admin, jamais une action). */
export function texteSignalAvis(s: SignalAvis): string {
  switch (s.signal) {
    case "comptes_recents": return `${s.boutique} : ${s.nombre} avis 5 étoiles sur 7 jours venant de comptes de moins de 7 jours.`;
    case "avis_groupes": return `${s.boutique} : ${s.nombre} avis dans la même minute${s.detail ? ` (${s.detail})` : ""}.`;
    case "meme_numero": return `${s.boutique} : le numéro ${s.detail ?? "masqué"} a donné ${s.nombre} avis, tous à cette boutique (30 jours).`;
    case "retraits_rapides": return `${s.boutique} : ${s.nombre} commandes récupérées moins de 30 minutes après la commande (30 jours).`;
  }
}

/** « Amine B. » (même règle que prive.prenom_initiale dans la base). */
export function prenomInitiale(nom: string | null | undefined): string {
  const mots = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "Client";
  return mots.length > 1 ? `${mots[0]} ${Array.from(mots[1])[0].toUpperCase()}.` : mots[0];
}

export function regrouperSignalementsAvis(signalements: SignalementAvisModeration[]): GroupeSignalementsAvis[] {
  const groupes = new Map<string, SignalementAvisModeration[]>();
  for (const signalement of signalements) {
    if (signalement.statut !== "ouvert") continue;
    groupes.set(signalement.avis_id, [...(groupes.get(signalement.avis_id) ?? []), signalement]);
  }
  return [...groupes].map(([avisId, liste]) => {
    const tries = [...liste].sort((a, b) => Date.parse(b.cree_le) - Date.parse(a.cree_le) || a.id.localeCompare(b.id));
    const motifs = new Map<string, number>();
    for (const signalement of tries) motifs.set(signalement.motif, (motifs.get(signalement.motif) ?? 0) + 1);
    const avis = tries.find(s => s.avis)?.avis ?? null;
    return { avisId, avis, auteur: prenomInitiale(avis?.profils?.nom), signalements: tries, nombre: tries.length, derniereDate: tries[0].cree_le, motifs: [...motifs].map(([motif, nombre]) => ({ motif, nombre })).sort((a, b) => b.nombre - a.nombre || a.motif.localeCompare(b.motif)) };
  }).sort((a, b) => b.nombre - a.nombre || Date.parse(b.derniereDate) - Date.parse(a.derniereDate) || a.avisId.localeCompare(b.avisId));
}

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
  const { data, error } = await client.from("decisions").select("id, date, action, signalements(article_id, articles(titre)), signalements_avis(avis_id, avis(boutiques(nom), profils(nom)))").order("date", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (error || !data) throw new Error("Impossible de charger l’historique. Réessayez.");
  return data.map(decision => {
    // US-32.4 : une décision vise un article signalé ou un avis signalé.
    const avis = decision.signalements_avis?.avis;
    const titre = decision.signalements_avis ? (avis ? `Avis de ${prenomInitiale(avis.profils?.nom)} · ${avis.boutiques?.nom ?? "Boutique indisponible"}` : "Avis indisponible") : decision.signalements?.articles?.titre ?? "Article indisponible";
    return { id: decision.id, date: decision.date, action: decision.action, articleId: decision.signalements?.article_id ?? null, titre };
  });
}

export async function chargerSignalementsAvis(client: SupabaseClient<Database>): Promise<GroupeSignalementsAvis[]> {
  const signalements: SignalementAvisModeration[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("signalements_avis").select("*, avis(id, note, commentaire, reponse, reponse_masquee, statut, cree_le, boutiques(nom), profils(nom))").eq("statut", "ouvert").order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new Error("Impossible de charger les signalements. Réessayez.");
    signalements.push(...data);
    if (data.length < 500) return regrouperSignalementsAvis(signalements);
  }
}

/** Signaux de fraude (jamais automatiques, seuil 3) : comptes récents, avis groupés, même numéro, retraits rapides. */
export async function chargerSignauxAvis(client: SupabaseClient<Database>): Promise<SignalAvis[]> {
  const { data, error } = await client.rpc("signaux_fraude_avis");
  if (error) throw new Error("Impossible de charger les signaux. Réessayez.");
  return (data ?? []).filter(s => (TYPES_SIGNAUX_AVIS as readonly string[]).includes(s.signal))
    .map(s => ({ signal: s.signal as TypeSignalAvis, boutiqueId: s.boutique_id, boutique: s.boutique, nombre: s.nombre, detail: s.detail ?? null }));
}

/** Une transaction dans la base : effet, une décision par signalement, signalements clos (seulement ceux vus). */
export async function modererAvis(client: SupabaseClient<Database>, avisId: string, ids: string[], action: ActionModerationAvis) {
  await verifierAdministrateur(client);
  if (!Object.hasOwn(ACTIONS_MODERATION_AVIS, action)) throw new Error("Choisissez une action valide.");
  const selection = [...new Set(ids)];
  if (!selection.length) throw new Error("Aucun signalement à traiter.");
  const { error } = await client.rpc("moderer_avis", { avis: avisId, action, signalements: selection });
  if (error) throw new Error(["22023", "P0002", "42501"].includes(error.code ?? "") && error.message ? error.message : "Impossible de traiter les signalements. Réessayez.");
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

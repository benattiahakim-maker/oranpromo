import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { formaterPrix, promoActive } from "./prix";
import { villeLue } from "./ville";
import { remplir, type Langue } from "./langue";
import { textesDe } from "./textes";

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

// US-31.3 : compteur de l'espace commerçant (un nombre, jamais de liste ; décision du propriétaire du 10/10).
// US-31.4 : clients inscrits en boutique et, quand le programme est ouvert, bons d'inscription du mois (plafond, part).
export type NombreAbonnes = {
  total: number; sept_jours: number; inscrits?: number;
  bons_inscription_mois?: number | null; plafond_inscriptions_mois?: number | null; montant_bon_inscription?: number | null; part_boutique?: number | null;
};
const nombreOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** null si la lecture échoue (le bloc est alors masqué, l'espace reste utilisable). */
export async function lireAbonnesBoutique(client: Client): Promise<NombreAbonnes | null> {
  try {
    const { data, error } = await client.rpc("abonnes_boutique");
    if (error || !data || typeof data !== "object") return null;
    const objet = data as Record<string, unknown>;
    const total = Number(objet.total), sept = Number(objet.sept_jours);
    if (!Number.isFinite(total) || !Number.isFinite(sept)) return null;
    return { total, sept_jours: sept, inscrits: nombreOuNull(objet.inscrits) ?? 0, bons_inscription_mois: nombreOuNull(objet.bons_inscription_mois),
      plafond_inscriptions_mois: nombreOuNull(objet.plafond_inscriptions_mois), montant_bon_inscription: nombreOuNull(objet.montant_bon_inscription),
      part_boutique: nombreOuNull(objet.part_boutique) };
  } catch { return null; }
}

/** « 12 clients suivent votre boutique · +3 cette semaine » (espace commerçant, en français). */
export function texteAbonnes({ total, sept_jours, inscrits = 0 }: NombreAbonnes, langue: Langue = "fr"): string {
  if (langue !== "fr") {
    // US-35 : même règle, textes de l'espace dans la langue choisie.
    const t = textesDe(langue).espace.abonnes;
    if (total <= 0) return t.aucun;
    const base = total === 1 ? t.un : remplir(t.plusieurs, { n: total });
    const semaine = sept_jours > 0 ? remplir(t.semaine, { base, n: sept_jours }) : base;
    return inscrits > 0 ? remplir(inscrits > 1 ? t.inscrits : t.inscrit, { base: semaine, n: inscrits }) : semaine;
  }
  if (total <= 0) return "Aucun client ne suit encore votre boutique.";
  const base = total === 1 ? "1 client suit votre boutique" : `${total} clients suivent votre boutique`;
  const semaine = sept_jours > 0 ? `${base} · +${sept_jours} cette semaine` : base;
  // US-31.4 (maquette SuivreBoutique, écran ⑥) : « dont 9 inscrits en boutique ».
  return inscrits > 0 ? `${semaine} · dont ${inscrits} inscrit${inscrits > 1 ? "s" : ""} en boutique` : semaine;
}

/** US-31.4 : « Bons de bienvenue des inscrits ce mois : 3 / 20. Votre part : 250 DA par bon utilisé chez vous. » (null : programme fermé). */
export function texteBonsInscription(a: NombreAbonnes, langue: Langue = "fr"): string | null {
  if (a.bons_inscription_mois == null || a.montant_bon_inscription == null) return null;
  if (langue !== "fr") {
    const t = textesDe(langue).espace.abonnes;
    const plafond = a.plafond_inscriptions_mois ? ` / ${a.plafond_inscriptions_mois}` : "";
    return remplir(t.bonsInscription, { n: a.bons_inscription_mois, plafond }) + (a.part_boutique ? remplir(t.part, { montant: formaterPrix(a.part_boutique, langue) }) : "");
  }
  const plafond = a.plafond_inscriptions_mois ? ` / ${a.plafond_inscriptions_mois}` : "";
  const part = a.part_boutique ? ` Votre part : ${formaterPrix(a.part_boutique)} par bon utilisé chez vous (déduite du remboursement).` : "";
  return `Bons de bienvenue des inscrits ce mois : ${a.bons_inscription_mois}${plafond}.${part}`;
}

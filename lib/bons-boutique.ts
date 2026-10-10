// US-33.4 : nom du bon côté boutique (scan, commandes reçues), sur le suivi du client et la page du proche ;
// relevé de la boutique par origine ; plafond par campagne. Lectures seulement (fonctions de la base, droits vérifiés par la base).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { Langue } from "./langue";
import type { OrigineBon } from "./bons";
import { nomDuBon } from "./bons-affichage";
import { jetonRetraitValide, type ResumeRetrait } from "./retrait";
import { fr } from "./textes/fr";
import type { fr as Fr } from "./textes/fr";

type Client = SupabaseClient<Database>;
const ORIGINES: readonly OrigineBon[] = ["parrainage_filleul", "parrainage_parrain", "bienvenue", "campagne", "inscription_boutique"];

/** Bon posé sur une commande : origine et nom du programme (vide pour le parrainage et la bienvenue). */
export type NomBon = { origine: OrigineBon; nom_fr: string | null; nom_ar: string | null };

function lireNomBon(x: unknown): NomBon | null {
  const v = x as Partial<NomBon> | null;
  if (!v || typeof v !== "object" || !ORIGINES.includes(v.origine as OrigineBon)) return null;
  return { origine: v.origine as OrigineBon, nom_fr: typeof v.nom_fr === "string" ? v.nom_fr : null, nom_ar: typeof v.nom_ar === "string" ? v.nom_ar : null };
}

/** « Bon Aïd 2026 », « Bon de bienvenue », « Bon parrainage » (sans information : « Bon parrainage », comme avant US-33). */
export function nomBon(bon: NomBon | null | undefined, t: typeof Fr.parrainage = fr.parrainage, langue: Langue = "fr"): string {
  return bon ? nomDuBon(bon, t, langue) : t.ligneBon;
}

/** Bons des commandes demandées (celles de la boutique du compte, ses commandes de client, ou toutes pour l'admin). */
export async function lireBonsDesCommandes(client: Client, commandes: string[]): Promise<Map<string, NomBon>> {
  const ids = [...new Set(commandes)];
  const noms = new Map<string, NomBon>();
  if (!ids.length) return noms;
  const { data, error } = await client.rpc("bons_des_commandes", { commandes: ids });
  if (error) throw new Error("Impossible de lire les bons des commandes.");
  for (const x of Array.isArray(data) ? data : []) {
    const n = lireNomBon(x); const id = (x as { commande?: unknown })?.commande;
    if (n && typeof id === "string") noms.set(id, n);
  }
  return noms;
}

/** Page du proche : nom du bon de la commande du lien (null : pas de bon ou lien faux). */
export async function lireBonParLien(client: Client, jeton: string): Promise<NomBon | null> {
  if (!jetonRetraitValide(jeton)) return null;
  const { data, error } = await client.rpc("bon_par_lien", { jeton });
  if (error) throw new Error("Impossible de lire le bon.");
  return lireNomBon(data);
}

/** Plafond d'une campagne ouverte dans la boutique du compte. */
export type PlafondBoutique = { nom_fr: string; nom_ar: string; plafond: number; utilises: number };

export async function lirePlafondsBoutique(client: Client): Promise<PlafondBoutique[]> {
  const { data, error } = await client.rpc("plafonds_bons_boutique");
  if (error) throw new Error("Impossible de lire les plafonds.");
  return (Array.isArray(data) ? data : []).filter((x): x is PlafondBoutique => {
    const v = x as Partial<PlafondBoutique> | null;
    return !!v && typeof v.nom_fr === "string" && typeof v.plafond === "number" && typeof v.utilises === "number";
  });
}

/** « Plafond Aïd 2026 : 14 / 30 bons dans votre boutique. » */
export function textePlafond(p: PlafondBoutique): string {
  return `Plafond ${p.nom_fr} : ${p.utilises} / ${p.plafond} bons dans votre boutique.`;
}

/** Programmes des lignes du relevé de la boutique : id → nom français. */
export async function lireNomsProgrammesReleve(client: Client): Promise<Map<string, string>> {
  const { data, error } = await client.rpc("noms_programmes_releve");
  if (error) throw new Error("Impossible de lire les noms des bons.");
  const noms = new Map<string, string>();
  for (const x of Array.isArray(data) ? data : []) {
    const v = x as { id?: unknown; nom_fr?: unknown };
    if (typeof v?.id === "string" && typeof v.nom_fr === "string") noms.set(v.id, v.nom_fr);
  }
  return noms;
}

/** part_boutique (US-31.4) : part payée par la boutique d'origine d'un bon d'inscription, non remboursée. */
type LigneOrigine = { origine?: string | null; programme_id?: string | null; montant: number; statut: string; part_boutique?: number | null };

/** US-31.4 : ce que BleDeal rembourse pour une ligne (le bon moins la part de la boutique d'origine). */
export function aRembourserLigne(l: Pick<LigneOrigine, "montant" | "part_boutique">): number {
  return Math.max(0, l.montant - Math.max(0, l.part_boutique ?? 0));
}

/** Origine d'une ligne du relevé : « Parrainage », « Bienvenue », « Aïd 2026 » (nom de la campagne). */
export function origineLigne(l: Pick<LigneOrigine, "origine" | "programme_id">, noms: Map<string, string>): string {
  if (l.origine === "bienvenue") return "Bienvenue";
  // US-31.4 : bon de bienvenue de l'inscription en boutique.
  if (l.origine === "inscription_boutique") return "Inscription en boutique";
  if (l.origine === "campagne") return (l.programme_id && noms.get(l.programme_id)) || "Campagne";
  // US-32.5 (bon offert pour un avis) : origine « avis » prévue par US-33.5.
  if (l.origine === "avis") return (l.programme_id && noms.get(l.programme_id)) || "Avis";
  return "Parrainage";
}

/** Lignes à rembourser regroupées par origine, la plus grosse d'abord : « Aïd 2026 · 14 bons · 7 000 DA ». */
export function totauxParOrigine(lignes: LigneOrigine[], noms: Map<string, string>): { origine: string; nombre: number; montant: number }[] {
  const totaux = new Map<string, { origine: string; nombre: number; montant: number }>();
  for (const l of lignes) {
    if (l.statut !== "a_rembourser") continue;
    const origine = origineLigne(l, noms);
    const t = totaux.get(origine) ?? { origine, nombre: 0, montant: 0 };
    t.nombre += 1; t.montant += aRembourserLigne(l); totaux.set(origine, t);
  }
  return [...totaux.values()].sort((a, b) => b.montant - a.montant || a.origine.localeCompare(b.origine, "fr"));
}

/** Résumé du scan avec le nom du bon (une lecture de plus seulement si un bon est posé ; en cas d'erreur : « Bon parrainage »). */
export async function avecNomBon(client: Client, resume: ResumeRetrait): Promise<ResumeRetrait> {
  if (!resume.commande || !((resume.remise_bon ?? 0) > 0)) return resume;
  const bon = (await lireBonsDesCommandes(client, [resume.commande]).catch(() => null))?.get(resume.commande) ?? null;
  return { ...resume, bon };
}

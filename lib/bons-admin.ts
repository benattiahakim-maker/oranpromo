// US-33.5 : administration des programmes de bons (/admin/bons) : chiffres, création d'une campagne, arrêt, signaux.
// Les règles (admin seulement, code unique, villes connues, budget) sont dans la base ; ici : saisie, lecture, mise en forme.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { montantDA } from "./parrainage-admin";

type Client = SupabaseClient<Database>;

export type ProgrammeAdmin = {
  id: string; type: "bienvenue" | "campagne" | "avis" | "inscription_boutique"; nom_fr: string; nom_ar: string; code: string | null; montant: number; minimum_achat: number;
  univers: string | null; villes: string[]; debut: string; fin: string | null; validite_jours: number; budget: number;
  plafond_par_boutique: number | null; actif: boolean; ouvert: boolean; emis: number; utilises: number; rembourse: number; restant: number;
  /** US-31.4 : programme « inscription_boutique » (part de la boutique d'origine, plafond par boutique et par mois). */
  part_boutique?: number; plafond_inscriptions_mois?: number | null;
  /** US-32.5 : programme à budget MENSUEL (« avis ») : reste du mois en cours (heure d'Alger) ; null = lecture impossible. */
  resteMois?: number | null;
};
/** Programmes dont le budget vaut pour chaque mois (US-32.5) : le « reste » affiché est celui du mois. */
export const BUDGET_MENSUEL: readonly ProgrammeAdmin["type"][] = ["avis"];
export type SignalBoutique = {
  boutique_id: string; boutique: string; slug: string; servis: number; prix: number; prix_le: string | null; nouveaux: number;
  plafond: number | null; plafond_jours: number | null; comptes_recents: number; remises_rapides: number;
};

/** Décision du propriétaire du 10/10 : 500 DA, plafond 30 bons par boutique. Minimum et validité : maquette (4 000 DA, 10 jours). */
export const CAMPAGNE_PAR_DEFAUT = { montant: 500, minimum: 4000, validite: 10, plafond: 30 } as const;
export const UNIVERS_CAMPAGNE: Record<string, string> = { "": "Tous les articles", femme: "Femme", homme: "Homme", enfant: "Enfant", beaute: "Beauté" };

const FUSEAU = "Africa/Algiers";
const jourMois = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "numeric" }).format(new Date(iso));

export async function listerProgrammes(client: Client): Promise<ProgrammeAdmin[]> {
  const { data, error } = await client.rpc("programmes_admin");
  if (error) throw new Error("Impossible de charger les programmes. Réessayez.");
  const programmes = (Array.isArray(data) ? data : []) as unknown as ProgrammeAdmin[];
  if (!programmes.some(p => BUDGET_MENSUEL.includes(p.type))) return programmes;
  // Reste du mois (reste_mois_programmes, admin seulement) ; en cas d'échec : « reste du mois indisponible », jamais le reste total.
  const mois = new Map<string, number>();
  let lu = false;
  try {
    const r = await client.rpc("reste_mois_programmes");
    if (!r.error && Array.isArray(r.data)) {
      lu = true;
      for (const x of r.data as { id?: unknown; restant?: unknown }[]) if (typeof x?.id === "string" && typeof x.restant === "number") mois.set(x.id, x.restant);
    }
  } catch { /* lu reste faux */ }
  return programmes.map(p => BUDGET_MENSUEL.includes(p.type) ? { ...p, resteMois: lu ? mois.get(p.id) ?? null : null } : p);
}

export async function lireSignaux(client: Client, programme: string): Promise<SignalBoutique[]> {
  const { data, error } = await client.rpc("signaux_bons", { programme });
  if (error) throw new Error("Impossible de charger les signaux. Réessayez.");
  return (Array.isArray(data) ? data : []) as unknown as SignalBoutique[];
}

/** « Active », « Arrêtée », « À venir », « Terminée ». */
export function etatProgramme(p: Pick<ProgrammeAdmin, "actif" | "debut" | "fin">, maintenant: Date = new Date()): string {
  if (!p.actif) return "Arrêtée";
  if (new Date(p.debut) > maintenant) return "À venir";
  if (p.fin && new Date(p.fin) <= maintenant) return "Terminée";
  return "Active";
}

/** « 412 émis · 233 utilisés · 116 500 DA remboursés · reste 93 500 DA ». */
/** US-32.5 : programme à budget mensuel : « reste 850 DA ce mois-ci » (ou « reste du mois indisponible »). */
export function resumeProgramme(p: Pick<ProgrammeAdmin, "emis" | "utilises" | "rembourse" | "restant"> & Partial<Pick<ProgrammeAdmin, "type" | "resteMois">>): string {
  const reste = p.type && BUDGET_MENSUEL.includes(p.type)
    ? typeof p.resteMois === "number" ? `reste ${montantDA(Math.max(p.resteMois, 0))} ce mois-ci` : "reste du mois indisponible"
    : `reste ${montantDA(Math.max(p.restant, 0))}`;
  return `${p.emis} émis · ${p.utilises} utilisé${p.utilises > 1 ? "s" : ""} · ${montantDA(p.rembourse)} remboursés · ${reste}`;
}

/** « 500 DA dès 4 000 DA · Femme · oran · du 25/5 au 5/6 · bon valable 10 jours · plafond 30 bons par boutique ». */
export function conditionsProgramme(p: ProgrammeAdmin): string {
  const morceaux = [`${montantDA(p.montant)} dès ${montantDA(p.minimum_achat)}`];
  if (p.univers) morceaux.push(UNIVERS_CAMPAGNE[p.univers] ?? p.univers);
  morceaux.push(p.villes.length ? p.villes.join(", ") : "toutes les villes");
  morceaux.push(p.fin ? `du ${jourMois(p.debut)} au ${jourMois(new Date(new Date(p.fin).getTime() - 1).toISOString())}` : `depuis le ${jourMois(p.debut)}`);
  morceaux.push(`bon valable ${p.validite_jours} jours`);
  if (p.plafond_par_boutique) morceaux.push(`plafond ${p.plafond_par_boutique} bons par boutique`);
  if (p.part_boutique) morceaux.push(`part de la boutique d’origine ${montantDA(p.part_boutique)}`);
  if (p.plafond_inscriptions_mois) morceaux.push(`${p.plafond_inscriptions_mois} inscriptions récompensées par boutique et par mois`);
  return morceaux.join(" · ");
}

/** Phrases des signaux d'une boutique (jamais automatiques : l'admin décide dans les remboursements). */
export function textesSignal(s: SignalBoutique, p: Pick<ProgrammeAdmin, "debut">): string[] {
  const t: string[] = [];
  if (s.prix > 0 && s.prix_le) {
    const jours = Math.round((new Date(p.debut).getTime() - new Date(s.prix_le).getTime()) / 86_400_000);
    const quand = jours > 0 ? `${jours} jour${jours > 1 ? "s" : ""} avant la campagne` : "pendant la campagne";
    t.push(`${s.boutique} : prix de ${s.prix} article${s.prix > 1 ? "s" : ""} augmenté${s.prix > 1 ? "s" : ""} de plus de 20 % le ${jourMois(s.prix_le)} (${quand}).`);
  }
  if (s.nouveaux > 0) t.push(`${s.boutique} : ${s.nouveaux} article${s.nouveaux > 1 ? "s" : ""} créé${s.nouveaux > 1 ? "s" : ""} dans les 14 jours avant la campagne.`);
  if (s.plafond && s.plafond_jours) t.push(`${s.boutique} : ${s.plafond} / ${s.plafond} bons en ${s.plafond_jours} jour${s.plafond_jours > 1 ? "s" : ""}.`);
  if (s.comptes_recents > 0) t.push(`${s.boutique} : ${s.comptes_recents} bon${s.comptes_recents > 1 ? "s" : ""} utilisé${s.comptes_recents > 1 ? "s" : ""} par des comptes de moins de 7 jours.`);
  if (s.remises_rapides > 0) t.push(`${s.boutique} : ${s.remises_rapides} commande${s.remises_rapides > 1 ? "s" : ""} récupérée${s.remises_rapides > 1 ? "s" : ""} moins de 30 minutes après la commande.`);
  return t;
}

// ---------- Nouvelle campagne ----------
export type SaisieCampagne = {
  nom_fr: string; nom_ar: string; code: string; montant: string; minimum: string; univers: string; villes: string[];
  debut: string; fin: string; validite: string; budget: string; plafond: string;
};
export type ArgumentsCampagne = Database["public"]["Functions"]["creer_campagne"]["Args"];

const entier = (v: string) => (/^\d{1,9}$/.test(v.replace(/\s/g, "")) ? Number(v.replace(/\s/g, "")) : NaN);
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/** Jour saisi (heure d'Algérie, UTC+1 toute l'année) : début à 0 h ; fin incluse → lendemain 0 h. */
export function debutDuJour(jour: string): string { return `${jour}T00:00:00+01:00`; }
export function finDuJour(jour: string): string {
  const d = new Date(`${jour}T00:00:00+01:00`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Vérifie la saisie (la base vérifie de nouveau) : arguments de creer_campagne, ou le message à afficher. */
export function validerCampagne(s: SaisieCampagne, villesConnues: string[]): { args: ArgumentsCampagne } | { erreur: string } {
  const nomFr = s.nom_fr.trim(), nomAr = s.nom_ar.trim();
  if (nomFr.length < 2 || nomFr.length > 40 || nomAr.length < 2 || nomAr.length > 40) return { erreur: "Nom en français et en arabe : 2 à 40 caractères." };
  const code = s.code.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return { erreur: "Code : 4 à 16 lettres ou chiffres, sans espace." };
  const montant = entier(s.montant), minimum = entier(s.minimum), validite = entier(s.validite), budget = entier(s.budget), plafond = entier(s.plafond);
  if (!(montant >= 1 && montant <= 5000)) return { erreur: "Montant : de 1 à 5 000 DA." };
  if (!(minimum >= montant)) return { erreur: "Le minimum d’achat doit être au moins égal au montant du bon." };
  if (!(s.univers in UNIVERS_CAMPAGNE)) return { erreur: "Univers inconnu." };
  if (s.villes.some(v => !villesConnues.includes(v))) return { erreur: "Ville inconnue." };
  if (!JOUR.test(s.debut) || !JOUR.test(s.fin)) return { erreur: "Indiquez les dates de début et de fin." };
  if (s.fin < s.debut) return { erreur: "La fin doit être après le début." };
  if (!(validite >= 1 && validite <= 365)) return { erreur: "Validité du bon : de 1 à 365 jours." };
  if (!(budget >= montant)) return { erreur: "Le budget doit permettre au moins un bon." };
  if (!(plafond >= 1)) return { erreur: "Plafond par boutique : au moins 1 bon." };
  return { args: { nom_fr: nomFr, nom_ar: nomAr, code, montant, minimum_achat: minimum, univers: s.univers, villes: [...new Set(s.villes)],
    debut: debutDuJour(s.debut), fin: finDuJour(s.fin), validite_jours: validite, budget, plafond_par_boutique: plafond } };
}

const MESSAGES_BASE = ["Réservé à l'administration.", "Indiquez la date de fin de la campagne.", "Ville inconnue.", "Ce code existe déjà."];
export async function creerCampagne(client: Client, args: ArgumentsCampagne): Promise<string> {
  const { data, error } = await client.rpc("creer_campagne", args);
  if (error) throw new Error(MESSAGES_BASE.includes(error.message) ? error.message : "Campagne refusée : vérifiez les champs.");
  return data as string;
}

export async function arreterProgramme(client: Client, programme: string): Promise<boolean> {
  const { data, error } = await client.rpc("arreter_programme", { programme });
  if (error) throw new Error("Impossible d’arrêter ce programme. Réessayez.");
  return data === true;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "./supabase/types";

// US-20 : commandes. Les règles (droits, transitions, stock) sont dans la base :
// passer_commande() et changer_statut_commande() (migrations 20261009190100_commandes.sql et suivantes).

export type StatutCommande = Enums<"statut_commande">;
export const STATUTS_COMMANDE: Record<StatutCommande, string> = { demandee: "Demandée", confirmee: "Confirmée", prete: "Prête", recuperee: "Récupérée", annulee: "Annulée", expiree: "Expirée" };
/** Titre du suivi vu par le client. */
export const TITRES_SUIVI: Record<StatutCommande, string> = { demandee: "Commande envoyée", confirmee: "Confirmée par la boutique", prete: "Prête à récupérer", recuperee: "Récupérée", annulee: "Annulée", expiree: "Expirée" };
export const MOTIFS_ANNULATION = { plus_en_stock: "Plus en stock", boutique_indisponible: "Boutique indisponible", client_a_annule: "Annulée par le client", autre: "Autre" } as const;
export type MotifAnnulation = keyof typeof MOTIFS_ANNULATION;
export const ETAPES_NORMALES: StatutCommande[] = ["demandee", "confirmee", "prete", "recuperee"];
export const STATUTS_EN_COURS: StatutCommande[] = ["demandee", "confirmee", "prete"];
export const DELAI_RETRAIT_HEURES = 24;
export const NOTE_SUIVI_MAX = 300;

export function commandeEnCours(statut: StatutCommande): boolean { return STATUTS_EN_COURS.includes(statut); }
export function annulableParClient(statut: StatutCommande): boolean { return statut === "demandee" || statut === "confirmee"; }
export function libelleMotif(motif: string | null | undefined): string | null {
  return motif && Object.hasOwn(MOTIFS_ANNULATION, motif) ? MOTIFS_ANNULATION[motif as MotifAnnulation] : null;
}

const FUSEAU = "Africa/Algiers";
/** « jeu. 9 oct. · 14:05 » à l’heure d’Oran ; en arabe (US-23) « الجمعة، 9 أكتوبر · 14:05 », chiffres 0-9. */
export function formaterDateHeure(iso: string, langue: "fr" | "ar" = "fr"): string {
  const date = new Date(iso);
  const locale = langue === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR";
  const jour = new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, weekday: "short", day: "numeric", month: "short" }).format(date);
  const heure = new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${jour} · ${heure}`;
}

export type EvenementSuivi = Pick<Tables<"suivi_commandes">, "statut" | "date" | "note" | "auteur">;
export type EtapeFrise = { statut: StatutCommande; libelle: string; date: string | null; note: string | null; auteur: string | null; faite: boolean };

/** Frise du suivi : les changements enregistrés, puis les étapes normales restantes (grisées) tant que la commande est en cours. */
export function etapesFrise(statut: StatutCommande, suivi: EvenementSuivi[]): EtapeFrise[] {
  const faites: EtapeFrise[] = [...suivi].sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ statut: e.statut, libelle: STATUTS_COMMANDE[e.statut], date: e.date, note: e.note, auteur: e.auteur, faite: true }));
  if (!commandeEnCours(statut)) return faites;
  const restantes = ETAPES_NORMALES.slice(ETAPES_NORMALES.indexOf(statut) + 1).map(s => ({ statut: s, libelle: STATUTS_COMMANDE[s], date: null, note: null, auteur: null, faite: false }));
  return [...faites, ...restantes];
}

type ErreurBase = { code?: string; message?: string } | null | undefined;
// Codes des erreurs levées volontairement par les fonctions de la base (messages déjà en français).
// 54000 = limites : 5 commandes en cours et 10 par heure par client ; 20 nouvelles commandes par heure et par
// boutique, tous clients confondus (« Cette boutique a reçu trop de commandes dans la dernière heure… »,
// déclencheur commandes_limite_boutique, migration 20261009233000).
const CODES_METIER = new Set(["42501", "23514", "P0002", "54000", "22023"]);
export function messageErreurCommande(error: ErreurBase, defaut: string): string {
  return error?.code && CODES_METIER.has(error.code) && error.message ? error.message : defaut;
}

export type LigneEnvoyee = { article_id: string; taille: string; quantite: number };
export async function passerCommande(client: SupabaseClient<Database>, boutiqueId: string, lignes: LigneEnvoyee[], note: string): Promise<string> {
  if (!lignes.length) throw new Error("Votre panier est vide.");
  const { data, error } = await client.rpc("passer_commande", { boutique: boutiqueId, lignes, note: note.trim() || undefined });
  if (error || typeof data !== "string") throw new Error(messageErreurCommande(error, "Impossible d’envoyer la commande. Réessayez."));
  return data;
}

export async function changerStatutCommande(client: SupabaseClient<Database>, id: string, statut: StatutCommande, options: { motif?: MotifAnnulation | null; note?: string } = {}) {
  const note = options.note?.trim() ?? "";
  if (note.length > NOTE_SUIVI_MAX) throw new Error(`La note doit faire ${NOTE_SUIVI_MAX} caractères au plus.`);
  const { error } = await client.rpc("changer_statut_commande", { commande: id, statut, motif: options.motif ?? undefined, note: note || undefined });
  if (error) throw new Error(messageErreurCommande(error, "Impossible de modifier la commande. Réessayez."));
}

export async function annulerCommandeClient(client: SupabaseClient<Database>, id: string, note = "") {
  await changerStatutCommande(client, id, "annulee", { motif: "client_a_annule", note });
}

export type ResumeCommande = Pick<Tables<"commandes">, "id" | "numero" | "statut" | "total" | "cree_le" | "expire_le"> & { boutiques: { nom: string } | null };
export async function listerMesCommandes(client: SupabaseClient<Database>): Promise<ResumeCommande[]> {
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data, error } = await client.from("commandes").select("id, numero, statut, total, cree_le, expire_le, boutiques(nom)").eq("client_id", user.id).order("cree_le", { ascending: false }).limit(100);
  if (error) throw new Error("Impossible de charger vos commandes. Réessayez.");
  return (data ?? []) as unknown as ResumeCommande[];
}

export type DetailCommande = Tables<"commandes"> & {
  boutiques: Pick<Tables<"boutiques">, "nom" | "slug" | "quartier" | "adresse" | "whatsapp"> | null;
  lignes_commande: Tables<"lignes_commande">[];
  suivi_commandes: Tables<"suivi_commandes">[];
};
/** Une commande visible par le compte connecté (client, boutique ou admin : règle dans la base). */
export async function lireCommande(client: SupabaseClient<Database>, id: string): Promise<DetailCommande | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client.from("commandes").select("*, boutiques(nom, slug, quartier, adresse, whatsapp), lignes_commande(*), suivi_commandes(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Impossible de charger la commande. Réessayez.");
  return data as unknown as DetailCommande | null;
}

export function quantiteTotale(lignes: { quantite: number }[]): number {
  return lignes.reduce((total, ligne) => total + ligne.quantite, 0);
}

// --- US-20.3 : côté boutique ------------------------------------------------
/** Bouton principal proposé à la boutique selon le statut (l’annulation est proposée à part). */
export const ACTION_BOUTIQUE: Partial<Record<StatutCommande, { statut: StatutCommande; libelle: string }>> = {
  demandee: { statut: "confirmee", libelle: "Confirmer" },
  confirmee: { statut: "prete", libelle: "Prête" },
  prete: { statut: "recuperee", libelle: "Récupérée" },
};
export const MOTIFS_BOUTIQUE = ["plus_en_stock", "boutique_indisponible", "autre"] as const satisfies readonly MotifAnnulation[];
export type MotifBoutique = (typeof MOTIFS_BOUTIQUE)[number];

export function annulableParBoutique(statut: StatutCommande): boolean { return commandeEnCours(statut); }
export function motifBoutiqueValide(motif: unknown): motif is MotifBoutique { return typeof motif === "string" && (MOTIFS_BOUTIQUE as readonly string[]).includes(motif); }

/** Vérifie une demande de la boutique avant l’appel à la base (qui revérifie tout). */
export function verifierActionBoutique(actuel: StatutCommande, voulu: StatutCommande, motif: unknown): string | null {
  if (voulu === "annulee") {
    if (!annulableParBoutique(actuel)) return "Cette commande est terminée.";
    return motifBoutiqueValide(motif) ? null : "Choisissez le motif de l’annulation.";
  }
  return ACTION_BOUTIQUE[actuel]?.statut === voulu ? null : "Changement de statut impossible.";
}

export type CommandeRecue = Tables<"commandes"> & { lignes_commande: Tables<"lignes_commande">[] };
export type VueCommandes = "en_cours" | "terminees";
export const COMMANDES_PAR_VUE = 100;

export async function listerCommandesBoutique(client: SupabaseClient<Database>, boutiqueId: string, vue: VueCommandes): Promise<CommandeRecue[]> {
  const enCours = vue === "en_cours";
  let requete = client.from("commandes").select("*, lignes_commande(*)").eq("boutique_id", boutiqueId);
  requete = enCours ? requete.in("statut", STATUTS_EN_COURS) : requete.not("statut", "in", `(${STATUTS_EN_COURS.join(",")})`);
  // En cours : les plus anciennes d’abord (à traiter) ; terminées : les plus récentes d’abord.
  const { data, error } = await requete.order("cree_le", { ascending: enCours }).limit(COMMANDES_PAR_VUE);
  if (error) throw new Error("Impossible de charger les commandes. Réessayez.");
  return (data ?? []) as unknown as CommandeRecue[];
}

export async function compterCommandesAConfirmer(client: SupabaseClient<Database>, boutiqueId: string): Promise<number> {
  const { count, error } = await client.from("commandes").select("id", { count: "exact", head: true }).eq("boutique_id", boutiqueId).eq("statut", "demandee");
  return error ? 0 : count ?? 0;
}

/** Refus de confirmation de la base quand le stock ne suffit plus (relecture point 1). */
export function estStockInsuffisant(message: string): boolean { return message.startsWith("Stock insuffisant"); }

// --- No-shows déclarés par la boutique (relecture point 11, option C) ---------
/** « Client pas venu » : commande expirée, ou prête depuis plus de 24 h, et pas encore signalée. */
export function peutDeclarerNoShow(commande: Pick<Tables<"commandes">, "statut" | "expire_le" | "no_show_le">, maintenant: number): boolean {
  if (commande.no_show_le) return false;
  if (commande.statut === "expiree") return true;
  return commande.statut === "prete" && Boolean(commande.expire_le) && Date.parse(commande.expire_le!) <= maintenant;
}

export async function declarerNoShow(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("declarer_no_show", { commande: id });
  if (error) throw new Error(messageErreurCommande(error, "Impossible de signaler ce client. Réessayez."));
}

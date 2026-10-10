import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";
import { normaliserWhatsAppAlgerien } from "./boutique";

// US-20.2 / US-20.4 : profil client (nom, téléphone WhatsApp), no-shows et blocage.
// no_shows et bloque ne sont modifiables que par la base et l’admin (règle dans la base).
export const NO_SHOWS_MAX = 5;

export type ProfilClient = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "telephone_verifie_le" | "no_shows" | "bloque" | "role" | "boutique_id">;
export type SaisieProfilClient = { nom: string; telephone: string };
export type ErreursProfilClient = Partial<Record<keyof SaisieProfilClient, string>>;
export class ErreurValidationProfil extends Error { constructor(public champs: ErreursProfilClient) { super("Vérifiez votre nom et votre numéro."); } }

export function essaisRestants(noShows: number): number {
  return Math.max(0, NO_SHOWS_MAX - noShows);
}

/** Avertissement affiché au client, ou null s’il n’a aucun no-show. */
// Le compteur ne contient que les no-shows de ce compte (migration 20261009233000 : numéro non vérifié),
// jamais ceux d’un autre compte avec le même numéro.
export function messageNoShows(noShows: number, bloque: boolean): string | null {
  if (bloque && noShows < NO_SHOWS_MAX) return "Votre compte est bloqué : vous ne pouvez plus commander. Contactez BleDeal pour le débloquer.";
  if (bloque) return `Votre compte est bloqué après ${NO_SHOWS_MAX} commandes non récupérées : vous ne pouvez plus commander. Contactez BleDeal pour le débloquer.`;
  if (noShows <= 0) return null;
  const restants = essaisRestants(noShows);
  return `Attention : ${noShows} commande${noShows > 1 ? "s" : ""} non récupérée${noShows > 1 ? "s" : ""}. Il vous reste ${restants} essai${restants > 1 ? "s" : ""} avant le blocage de votre compte.`;
}

/** Prêt à commander : nom et numéro ; en mode téléphone (US-21), le numéro doit être vérifié par code. */
export function profilComplet(profil: (Pick<ProfilClient, "nom" | "telephone"> & { telephone_verifie_le?: string | null }) | null | undefined, numeroVerifieRequis = false): boolean {
  if (numeroVerifieRequis && !profil?.telephone_verifie_le) return false;
  return Boolean(profil?.nom && profil.telephone && /^\+213[1-9]\d{8}$/.test(profil.telephone));
}

// Même règle que prive.nom_valide() dans la base (migration 20261009230000) : le nom part dans des messages
// WhatsApp, il ne doit contenir ni lien, ni numéro, ni retour à la ligne.
export const NOM_MAX = 60;
const CARACTERES_NOM = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F\u0621-\u063A\u0641-\u0652\u0671-\u06D3' \u2019-]+$/u;

/** Nom nettoyé (espaces en trop retirés), tel que la base l’enregistre. */
export function nettoyerNom(nom: string): string {
  return nom.trim().replace(/ {2,}/g, " ");
}

/** Lettres latines (avec accents) ou arabes, espaces, apostrophe, tiret ; 2 à 60 caractères, au moins 2 lettres. */
export function nomValide(nom: string): boolean {
  return nom.length >= 2 && nom.length <= NOM_MAX && nom === nom.trim() && !nom.includes("  ")
    && CARACTERES_NOM.test(nom) && nom.replace(/[ '\u2019-]/g, "").length >= 2;
}

export function validerProfilClient(saisie: SaisieProfilClient): ErreursProfilClient {
  const erreurs: ErreursProfilClient = {};
  const nom = nettoyerNom(saisie.nom);
  if (nom.length < 2 || nom.length > NOM_MAX) erreurs.nom = `Votre nom doit contenir entre 2 et ${NOM_MAX} caractères.`;
  else if (!nomValide(nom)) erreurs.nom = "Votre nom ne peut contenir que des lettres, des espaces, une apostrophe ou un tiret (pas de chiffres ni de lien).";
  if (!normaliserWhatsAppAlgerien(saisie.telephone)) erreurs.telephone = "Saisissez un numéro algérien valide, par exemple 0555 12 34 56.";
  return erreurs;
}

/** Numéro +213… au format lisible 0555 12 34 56. */
export function telephoneLisible(telephone: string): string {
  const m = /^\+213(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(telephone);
  return m ? `0${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}` : telephone;
}

export async function lireProfilClient(client: SupabaseClient<Database>): Promise<ProfilClient | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data, error: erreurProfil } = await client.from("profils").select("id, nom, telephone, telephone_verifie_le, no_shows, bloque, role, boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new Error("Impossible de charger votre profil. Réessayez.");
  return data;
}

export async function enregistrerProfilClient(client: SupabaseClient<Database>, saisie: SaisieProfilClient) {
  const erreurs = validerProfilClient(saisie);
  if (Object.keys(erreurs).length) throw new ErreurValidationProfil(erreurs);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data, error: erreurMaj } = await client.from("profils").update({ nom: nettoyerNom(saisie.nom), telephone: normaliserWhatsAppAlgerien(saisie.telephone)! }).eq("id", user.id).select("id").maybeSingle();
  // 23514 / 42501 : refus de la base avec un message en français (nom invalide, compte bloqué…).
  if (erreurMaj && (erreurMaj.code === "23514" || erreurMaj.code === "42501") && erreurMaj.message) throw new Error(erreurMaj.message);
  if (erreurMaj || !data) throw new Error("Impossible d’enregistrer votre profil. Réessayez.");
}

/** US-21 : le nom seul (numéro vérifié par code, ou mode téléphone). */
export async function enregistrerNomClient(client: SupabaseClient<Database>, saisieNom: string) {
  const nom = nettoyerNom(saisieNom);
  const erreurs = validerProfilClient({ nom, telephone: "0555000000" });
  if (erreurs.nom) throw new ErreurValidationProfil({ nom: erreurs.nom });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data, error: erreurMaj } = await client.from("profils").update({ nom }).eq("id", user.id).select("id").maybeSingle();
  if (erreurMaj && (erreurMaj.code === "23514" || erreurMaj.code === "42501") && erreurMaj.message) throw new Error(erreurMaj.message);
  if (erreurMaj || !data) throw new Error("Impossible d’enregistrer votre profil. Réessayez.");
}

// --- US-20.4 : clients à surveiller (admin) ----------------------------------
// Les no-shows sont déclarés par la boutique (« Client pas venu ») et comptés pour le compte de la commande, plus
// (US-21.3) ceux des commandes passées avec son numéro quand ce numéro est vérifié par code (un numéro vérifié =
// un compte). Un numéro saisi à la main ne fait jamais compter les no-shows d’un autre compte.
// L’admin peut annuler une déclaration, bloquer ou débloquer un compte.
export type ClientSurveille = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "telephone_verifie_le" | "no_shows" | "bloque" | "bloque_le">;

/** Clients bloqués puis clients avec des no-shows (lecture réservée à l’admin par la base). */
export async function listerClientsSurveilles(client: SupabaseClient<Database>): Promise<{ bloques: ClientSurveille[]; avecNoShows: ClientSurveille[] }> {
  const { data, error } = await client.from("profils").select("id, nom, telephone, telephone_verifie_le, no_shows, bloque, bloque_le").or("bloque.eq.true,no_shows.gt.0").order("bloque", { ascending: false }).order("no_shows", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les clients. Réessayez.");
  const lignes = data ?? [];
  return { bloques: lignes.filter(c => c.bloque), avecNoShows: lignes.filter(c => !c.bloque && c.no_shows > 0) };
}

export async function debloquerClient(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("debloquer_client", { client: id });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de débloquer ce client. Réessayez.");
}

export type NoShowDeclare = Pick<Tables<"commandes">, "id" | "numero" | "client_id" | "client_telephone" | "telephone_verifie" | "no_show_le"> & { boutiques: { nom: string } | null };

/** No-shows déclarés et non annulés (lecture des commandes réservée à l’admin pour toutes les boutiques). */
export async function listerNoShowsDeclares(client: SupabaseClient<Database>): Promise<NoShowDeclare[]> {
  const { data, error } = await client.from("commandes").select("id, numero, client_id, client_telephone, telephone_verifie, no_show_le, boutiques(nom)").not("no_show_le", "is", null).is("no_show_annule_le", null).order("no_show_le", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les no-shows. Réessayez.");
  return (data ?? []) as unknown as NoShowDeclare[];
}

/** No-shows comptés pour ce client : ses commandes, plus celles passées avec son numéro vérifié (US-21.3). */
export function noShowsDuClient(client: Pick<ClientSurveille, "id"> & Partial<Pick<ClientSurveille, "telephone" | "telephone_verifie_le">>, noShows: NoShowDeclare[]): NoShowDeclare[] {
  return noShows.filter(n => n.client_id === client.id
    || Boolean(client.telephone_verifie_le && client.telephone && n.telephone_verifie && n.client_telephone === client.telephone));
}

export async function annulerNoShow(client: SupabaseClient<Database>, commandeId: string) {
  const { error } = await client.rpc("annuler_no_show", { commande: commandeId });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible d’annuler ce no-show. Réessayez.");
}

export async function bloquerClient(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("bloquer_client", { client: id });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de bloquer ce client. Réessayez.");
}

// --- Contestation d’un no-show (décision du propriétaire, migration 20261009234500) --------
// Le client conteste depuis /compte avec un motif court, une fois par no-show. Tant que la contestation est en
// attente, le no-show ne compte pas pour un nouveau blocage ; un compte déjà bloqué le reste (relecture n°4, il
// faut une décision de l’admin). L’admin valide le no-show (il compte de nouveau) ou l’annule.
export const MOTIF_CONTESTATION_MIN = 5;
export const MOTIF_CONTESTATION_MAX = 300;

/** Motif nettoyé comme dans la base (espaces et retours à la ligne réduits à un espace). */
export function nettoyerMotifContestation(motif: string): string {
  return motif.trim().replace(/\s+/g, " ");
}

/** Message d’erreur, ou null si le motif est accepté (même règle que contester_no_show). */
export function erreurMotifContestation(motif: string): string | null {
  const longueur = nettoyerMotifContestation(motif).length;
  return longueur < MOTIF_CONTESTATION_MIN || longueur > MOTIF_CONTESTATION_MAX
    ? `Expliquez en quelques mots pourquoi vous contestez (${MOTIF_CONTESTATION_MIN} à ${MOTIF_CONTESTATION_MAX} caractères).`
    : null;
}

// Le motif est dans la table contestations (migration 20261009235500) : lisible par son auteur et l’admin, pas par la boutique.
export type MotifContestation = { motif: string } | null;
export type MonNoShow = Pick<Tables<"commandes">, "id" | "numero" | "no_show_le" | "contestee_le" | "contestation_validee_le"> & { boutiques: { nom: string } | null; contestations: MotifContestation };

// Décision du propriétaire : un no-show se conteste dans les 7 jours qui suivent sa déclaration (même règle que la base).
export const DELAI_CONTESTATION_JOURS = 7;
export function delaiContestationDepasse(noShow: Pick<MonNoShow, "no_show_le">, maintenant: number): boolean {
  if (!noShow.no_show_le) return true;
  return maintenant - Date.parse(noShow.no_show_le) > DELAI_CONTESTATION_JOURS * 24 * 60 * 60 * 1000;
}

/** Une seule contestation en attente à la fois par compte (même règle que la base). */
export function aUneContestationEnAttente(noShows: Pick<MonNoShow, "contestee_le" | "contestation_validee_le">[]): boolean {
  return noShows.some(n => etatContestation(n) === "en_attente");
}
export type EtatContestation = "a_contester" | "en_attente" | "refusee";

export function etatContestation(noShow: Pick<MonNoShow, "contestee_le" | "contestation_validee_le">): EtatContestation {
  if (!noShow.contestee_le) return "a_contester";
  return noShow.contestation_validee_le ? "refusee" : "en_attente";
}

/** No-shows non annulés du compte connecté (lecture de ses propres commandes, RLS). */
export async function listerMesNoShows(client: SupabaseClient<Database>): Promise<MonNoShow[]> {
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) return [];
  const { data, error } = await client.from("commandes").select("id, numero, no_show_le, contestee_le, contestation_validee_le, boutiques(nom), contestations(motif)").eq("client_id", user.id).not("no_show_le", "is", null).is("no_show_annule_le", null).order("no_show_le", { ascending: false }).limit(50);
  if (error) throw new Error("Impossible de charger vos commandes non récupérées. Réessayez.");
  return (data ?? []) as unknown as MonNoShow[];
}

export async function contesterNoShow(client: SupabaseClient<Database>, commandeId: string, motif: string) {
  const erreur = erreurMotifContestation(motif);
  if (erreur) throw new Error(erreur);
  const { error } = await client.rpc("contester_no_show", { commande: commandeId, motif: nettoyerMotifContestation(motif) });
  if (error) throw new Error(["42501", "P0002", "23514"].includes(error.code ?? "") && error.message ? error.message : "Impossible d’envoyer votre contestation. Réessayez.");
}

export type ContestationEnAttente = Pick<Tables<"commandes">, "id" | "numero" | "client_id" | "client_nom" | "client_telephone" | "no_show_le" | "contestee_le"> & { boutiques: { nom: string } | null; contestations: MotifContestation };

/** Contestations en attente, les plus anciennes d’abord (lecture de toutes les commandes réservée à l’admin). */
export async function listerContestationsEnAttente(client: SupabaseClient<Database>): Promise<ContestationEnAttente[]> {
  const { data, error } = await client.from("commandes").select("id, numero, client_id, client_nom, client_telephone, no_show_le, contestee_le, boutiques(nom), contestations(motif)").not("contestee_le", "is", null).is("contestation_validee_le", null).is("no_show_annule_le", null).order("contestee_le", { ascending: true }).limit(200);
  if (error) throw new Error("Impossible de charger les contestations. Réessayez.");
  return (data ?? []) as unknown as ContestationEnAttente[];
}

/** L’admin confirme un no-show contesté : il compte de nouveau (blocage au 5e possible). */
export async function validerNoShow(client: SupabaseClient<Database>, commandeId: string) {
  const { error } = await client.rpc("valider_no_show", { commande: commandeId });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de valider ce no-show. Réessayez.");
}

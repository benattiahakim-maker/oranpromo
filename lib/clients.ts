import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./supabase/types";
import { normaliserWhatsAppAlgerien } from "./boutique";

// US-20.2 / US-20.4 : profil client (nom, téléphone WhatsApp), no-shows et blocage.
// no_shows et bloque ne sont modifiables que par la base et l’admin (règle dans la base).
export const NO_SHOWS_MAX = 5;

export type ProfilClient = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "no_shows" | "bloque" | "role" | "boutique_id">;
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
  if (bloque && noShows < NO_SHOWS_MAX) return "Votre compte est bloqué : vous ne pouvez plus commander. Contactez OranPromo pour le débloquer.";
  if (bloque) return `Votre compte est bloqué après ${NO_SHOWS_MAX} commandes non récupérées : vous ne pouvez plus commander. Contactez OranPromo pour le débloquer.`;
  if (noShows <= 0) return null;
  const restants = essaisRestants(noShows);
  return `Attention : ${noShows} commande${noShows > 1 ? "s" : ""} non récupérée${noShows > 1 ? "s" : ""}. Il vous reste ${restants} essai${restants > 1 ? "s" : ""} avant le blocage de votre compte.`;
}

export function profilComplet(profil: Pick<ProfilClient, "nom" | "telephone"> | null | undefined): boolean {
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
  const { data, error: erreurProfil } = await client.from("profils").select("id, nom, telephone, no_shows, bloque, role, boutique_id").eq("id", user.id).maybeSingle();
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

// --- US-20.4 : clients à surveiller (admin) ----------------------------------
// Les no-shows sont déclarés par la boutique (« Client pas venu ») et comptés par compte (migration 20261009233000 :
// le numéro n’est pas vérifié, compter par numéro permettait de faire bloquer quelqu’un d’autre). Un numéro avec
// des no-shows utilisé par plusieurs comptes est signalé à l’admin, qui décide. L’admin peut annuler une déclaration.
export type ClientSurveille = Pick<Tables<"profils">, "id" | "nom" | "telephone" | "no_shows" | "bloque" | "bloque_le">;

/** Clients bloqués puis clients avec des no-shows (lecture réservée à l’admin par la base). */
export async function listerClientsSurveilles(client: SupabaseClient<Database>): Promise<{ bloques: ClientSurveille[]; avecNoShows: ClientSurveille[] }> {
  const { data, error } = await client.from("profils").select("id, nom, telephone, no_shows, bloque, bloque_le").or("bloque.eq.true,no_shows.gt.0").order("bloque", { ascending: false }).order("no_shows", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les clients. Réessayez.");
  const lignes = data ?? [];
  return { bloques: lignes.filter(c => c.bloque), avecNoShows: lignes.filter(c => !c.bloque && c.no_shows > 0) };
}

export async function debloquerClient(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("debloquer_client", { client: id });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de débloquer ce client. Réessayez.");
}

export type NoShowDeclare = Pick<Tables<"commandes">, "id" | "numero" | "client_id" | "client_telephone" | "no_show_le"> & { boutiques: { nom: string } | null };

/** No-shows déclarés et non annulés (lecture des commandes réservée à l’admin pour toutes les boutiques). */
export async function listerNoShowsDeclares(client: SupabaseClient<Database>): Promise<NoShowDeclare[]> {
  const { data, error } = await client.from("commandes").select("id, numero, client_id, client_telephone, no_show_le, boutiques(nom)").not("no_show_le", "is", null).is("no_show_annule_le", null).order("no_show_le", { ascending: false }).limit(500);
  if (error) throw new Error("Impossible de charger les no-shows. Réessayez.");
  return (data ?? []) as unknown as NoShowDeclare[];
}

/** No-shows comptés pour ce client : ceux de ses propres commandes (pas ceux d’un autre compte avec le même numéro). */
export function noShowsDuClient(client: Pick<ClientSurveille, "id">, noShows: NoShowDeclare[]): NoShowDeclare[] {
  return noShows.filter(n => n.client_id === client.id);
}

export async function annulerNoShow(client: SupabaseClient<Database>, commandeId: string) {
  const { error } = await client.rpc("annuler_no_show", { commande: commandeId });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible d’annuler ce no-show. Réessayez.");
}

export async function bloquerClient(client: SupabaseClient<Database>, id: string) {
  const { error } = await client.rpc("bloquer_client", { client: id });
  if (error) throw new Error(error.code === "42501" || error.code === "P0002" ? error.message : "Impossible de bloquer ce client. Réessayez.");
}

// --- Relecture n°2 : numéros partagés par plusieurs comptes (admin) ---------------
// Tant que le numéro n’est pas vérifié par SMS, ses no-shows ne bloquent pas les autres comptes : l’admin voit
// le numéro et décide (Bloquer / Débloquer). Le blocage par numéro reviendra avec la V2 SMS (prive.blocage_par_numero).
export type LigneNumeroPartage = Database["public"]["Functions"]["numeros_partages"]["Returns"][number];
export type CompteNumeroPartage = { id: string; nom: string | null; telephoneActuel: string | null; noShows: number; bloque: boolean };
export type NumeroPartage = { telephone: string; noShowsNumero: number; comptes: CompteNumeroPartage[] };

/** Regroupe les lignes de numeros_partages() par numéro (ordre de la base conservé). */
export function grouperNumerosPartages(lignes: LigneNumeroPartage[]): NumeroPartage[] {
  const parNumero = new Map<string, NumeroPartage>();
  for (const l of lignes) {
    let numero = parNumero.get(l.telephone);
    if (!numero) { numero = { telephone: l.telephone, noShowsNumero: l.no_shows_numero, comptes: [] }; parNumero.set(l.telephone, numero); }
    if (!numero.comptes.some(c => c.id === l.client_id)) numero.comptes.push({ id: l.client_id, nom: l.nom ?? null, telephoneActuel: l.telephone_actuel ?? null, noShows: l.no_shows, bloque: l.bloque });
  }
  return [...parNumero.values()].filter(n => n.comptes.length >= 2);
}

export async function listerNumerosPartages(client: SupabaseClient<Database>): Promise<NumeroPartage[]> {
  const { data, error } = await client.rpc("numeros_partages");
  if (error) throw new Error("Impossible de charger les numéros partagés. Réessayez.");
  return grouperNumerosPartages(data ?? []);
}

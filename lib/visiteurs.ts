import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "./supabase/types";
import { MOTIFS_SIGNALEMENT } from "./moderation";

// Limiter les envois en masse (vues, clics « Ajouter au panier », partages, signalements).
// Le navigateur n'écrit plus dans evenements ni signalements : il appelle une action serveur, qui appelle les fonctions
// de la base enregistrer_evenement / signaler_article avec le secret VISITEURS_SECRET. La base limite par visiteur :
//   - compte connecté : clé tirée de la session par la base (auth.uid()) ;
//   - visiteur anonyme : empreinte HMAC-SHA256 de son adresse IP, calculée ici avec le secret (l'IP n'est jamais
//     enregistrée en clair, et personne ne peut fabriquer une empreinte valide sans le secret).
// Voir docs/architecture.md, « Limites par visiteur ».

type Client = SupabaseClient<Database>;
export type TypeEvenement = Enums<"type_evenement">;
export type SaisieEvenement = { type: TypeEvenement; boutiqueId: string; articleId?: string; taille?: string };
export type SaisieSignalement = { articleId: string; motif: string; commentaire?: string };

export const TYPES_EVENEMENT: readonly TypeEvenement[] = ["vue_article", "vue_boutique", "clic_reserver", "partage"];
export const COMMENTAIRE_SIGNALEMENT_MAX = 1000;
export const MESSAGE_SIGNALEMENT_INDISPONIBLE = "Le signalement n’est pas disponible pour le moment. Réessayez plus tard.";
export const MESSAGE_SIGNALEMENT_ECHEC = "Le signalement n’a pas pu être envoyé. Réessayez.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ErreurSignalement extends Error {}

// Adresse IP du visiteur. Sur Vercel, x-real-ip et x-forwarded-for sont réécrits par l'hébergeur (pas falsifiables).
export function adresseIp(entetes: Headers): string {
  const reelle = entetes.get("x-real-ip")?.trim();
  if (reelle) return reelle;
  const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  return transmise || "inconnue";
}

export function cleVisiteur(ip: string, secret: string): string {
  return `ip:${createHmac("sha256", secret).update(ip).digest("hex")}`;
}

function secretVisiteurs(): string | null {
  const secret = process.env.VISITEURS_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export function evenementValide(saisie: SaisieEvenement): boolean {
  return TYPES_EVENEMENT.includes(saisie.type) && UUID.test(saisie.boutiqueId)
    && (saisie.articleId === undefined || UUID.test(saisie.articleId))
    && (saisie.taille === undefined || (saisie.taille.length > 0 && Array.from(saisie.taille).length <= 20));
}

// Renvoie true si la mesure est comptée ; false si elle est ignorée (doublon, limite atteinte, secret absent, erreur).
// Une mesure ne doit jamais empêcher de consulter une page : aucune erreur ne remonte.
export async function mesurerEvenement(client: Client, entetes: Headers, saisie: SaisieEvenement): Promise<boolean> {
  const secret = secretVisiteurs();
  if (!secret || !evenementValide(saisie)) return false;
  try {
    const { data, error } = await client.rpc("enregistrer_evenement", {
      jeton: secret, visiteur: cleVisiteur(adresseIp(entetes), secret), type: saisie.type, boutique: saisie.boutiqueId,
      ...(saisie.articleId ? { article: saisie.articleId } : {}), ...(saisie.taille ? { taille: saisie.taille } : {}),
    });
    return !error && data === true;
  } catch { return false; }
}

export async function signalerArticle(client: Client, entetes: Headers, saisie: SaisieSignalement): Promise<void> {
  const commentaire = (saisie.commentaire ?? "").trim();
  if (!Object.hasOwn(MOTIFS_SIGNALEMENT, saisie.motif)) throw new ErreurSignalement("Choisissez un motif.");
  if (Array.from(commentaire).length > COMMENTAIRE_SIGNALEMENT_MAX) throw new ErreurSignalement(`Le commentaire doit contenir ${COMMENTAIRE_SIGNALEMENT_MAX} caractères au plus.`);
  if (!UUID.test(saisie.articleId)) throw new ErreurSignalement(MESSAGE_SIGNALEMENT_ECHEC);
  const secret = secretVisiteurs();
  if (!secret) throw new ErreurSignalement(MESSAGE_SIGNALEMENT_INDISPONIBLE);
  let erreur: { code?: string; message?: string } | null;
  try {
    ({ error: erreur } = await client.rpc("signaler_article", {
      jeton: secret, visiteur: cleVisiteur(adresseIp(entetes), secret), article: saisie.articleId, motif: saisie.motif,
      ...(commentaire ? { commentaire } : {}),
    }));
  } catch { throw new ErreurSignalement(MESSAGE_SIGNALEMENT_ECHEC); }
  if (!erreur) return;
  // Messages de la base, déjà en français : limite atteinte (54000) ou saisie refusée (22023).
  if ((erreur.code === "54000" || erreur.code === "22023") && erreur.message) throw new ErreurSignalement(erreur.message);
  if (erreur.code === "42501") throw new ErreurSignalement(MESSAGE_SIGNALEMENT_INDISPONIBLE);
  throw new ErreurSignalement(MESSAGE_SIGNALEMENT_ECHEC);
}

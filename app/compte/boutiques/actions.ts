"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { COOKIE_SUIVRE, DUREE_COOKIE_SUIVRE, erreurAbonnement, uuidValide, type ErreurAbonnement } from "@/lib/abonnements";
import { slugValide } from "@/lib/lien-boutique";
import { COOKIE_INSCRIPTION, lireResultatInscription, type BonInscription } from "@/lib/inscription-boutique";
import { erreurAlertes, type ErreurAlertes } from "@/lib/alertes-whatsapp";
import { getLangue } from "@/lib/langue-serveur";

// US-31.2 : suivre / ne plus suivre une boutique. La base contrôle tout (client seulement, boutique validée, 200 au plus) ;
// le texte affiché est choisi par le composant (section « suivre » de lib/textes) à partir de la clé d'erreur.
export type ResultatSuivi = { succes: boolean; suivie: boolean; erreur?: ErreurAbonnement };

export async function suivreBoutique(boutiqueId: string): Promise<ResultatSuivi> {
  if (!uuidValide(boutiqueId)) return { succes: false, suivie: false, erreur: "introuvable" };
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { succes: false, suivie: false, erreur: "connexion" };
  const { error } = await supabase.rpc("suivre_boutique", { boutique: boutiqueId });
  if (error) return { succes: false, suivie: false, erreur: erreurAbonnement(error) };
  return { succes: true, suivie: true };
}

export async function nePlusSuivre(boutiqueId: string): Promise<ResultatSuivi> {
  if (!uuidValide(boutiqueId)) return { succes: false, suivie: true, erreur: "erreur" };
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("ne_plus_suivre", { boutique: boutiqueId });
  if (error) return { succes: false, suivie: true, erreur: erreurAbonnement(error) };
  return { succes: true, suivie: false };
}

/** « Suivre » sans être connecté : on garde le slug (cookie court, httpOnly) puis on passe par la connexion client. */
export async function seConnecterPourSuivre(slug: string): Promise<void> {
  const chemin = typeof slug === "string" && slugValide(slug) ? `/b/${slug}` : null;
  if (!chemin) redirect("/compte/connexion");
  (await cookies()).set(COOKIE_SUIVRE, slug, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DUREE_COOKIE_SUIVRE });
  redirect(`/compte/connexion?suite=${encodeURIComponent(chemin)}`);
}

/**
 * De retour sur la vitrine une fois connecté : suit la boutique si le cookie désigne bien cette vitrine, puis l'efface.
 * Aucune action sur un simple GET : c'est le composant de la vitrine qui appelle cette action (POST, origine vérifiée par Next.js).
 */
export async function suivreApresConnexion(slug: string): Promise<ResultatSuivi> {
  const magasin = await cookies();
  const garde = magasin.get(COOKIE_SUIVRE)?.value;
  if (!garde || garde !== slug || !slugValide(slug)) return { succes: false, suivie: false };
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { succes: false, suivie: false, erreur: "connexion" };
  magasin.delete(COOKIE_SUIVRE);
  const { data: boutique } = await supabase.from("boutiques").select("id").eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (!boutique) return { succes: false, suivie: false, erreur: "introuvable" };
  return suivreBoutique(boutique.id);
}

/**
 * US-31.3 : de retour sur la vitrine après le QR code de l'affiche (/i/<slug>) et la connexion : suit la boutique et
 * rattache un compte nouveau (règles dans rattacher_inscription), si le cookie désigne bien cette vitrine. Cookie effacé.
 */
export async function rattacherInscription(slug: string): Promise<ResultatSuivi & { rattache?: boolean; bon?: BonInscription }> {
  const magasin = await cookies();
  const garde = magasin.get(COOKIE_INSCRIPTION)?.value;
  if (!garde || garde !== slug || !slugValide(slug)) return { succes: false, suivie: false };
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { succes: false, suivie: false, erreur: "connexion" };
  magasin.delete(COOKIE_INSCRIPTION);
  const { data, error } = await supabase.rpc("rattacher_inscription", { slug_boutique: slug });
  if (error) return { succes: false, suivie: false, erreur: erreurAbonnement(error) };
  const resultat = lireResultatInscription(data);
  return { succes: true, suivie: true, rattache: resultat.rattache, bon: resultat.bon }; // US-31.4 : bon de bienvenue
}

/**
 * US-31.5 : accord aux alertes WhatsApp « nouvelles promos » (case séparée, jamais cochée d'office ; la base refuse si
 * les alertes ne sont pas proposées). La langue du site est gardée pour le message ; la base journalise l'accord.
 */
export type ResultatAlertes = { succes: boolean; actives: boolean; erreur?: ErreurAlertes };

export async function activerAlertes(source: "vitrine" | "compte"): Promise<ResultatAlertes> {
  if (source !== "vitrine" && source !== "compte") return { succes: false, actives: false, erreur: "erreur" };
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { succes: false, actives: false, erreur: "connexion" };
  const { error } = await supabase.rpc("activer_alertes_whatsapp", { langue: await getLangue(), source });
  if (error) return { succes: false, actives: false, erreur: erreurAlertes(error) };
  return { succes: true, actives: true };
}

/** Arrêt des alertes depuis le compte (toujours possible). */
export async function desactiverAlertes(): Promise<ResultatAlertes> {
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { succes: false, actives: true, erreur: "connexion" };
  const { error } = await supabase.rpc("desactiver_alertes_whatsapp");
  if (error) return { succes: false, actives: true, erreur: erreurAlertes(error) };
  return { succes: true, actives: false };
}

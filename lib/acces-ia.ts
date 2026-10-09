import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

// Les routes IA coûtent de l’argent à chaque appel : réservées aux boutiques validées,
// avec un quota par compte vérifié dans la base (consommer_quota_ia, 30 appels par heure).
export const BOUTIQUE_NON_VALIDEE = "Votre boutique doit être validée pour utiliser l’IA";
export const QUOTA_IA_ATTEINT = "Vous avez fait beaucoup de demandes à l’IA. Réessayez dans une heure ou remplissez la fiche à la main";
export type RefusIA = { message: string; statut: 401 | 403 | 429 | 503 };

/** Vérifie la session, la boutique rattachée et son statut. Renvoie null si l’accès est autorisé. */
export async function verifierAccesIA(client: SupabaseClient<Database>, messages: { connexion: string; indisponible: string }): Promise<RefusIA | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { message: messages.connexion, statut: 401 };
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) return { message: messages.indisponible, statut: 503 };
  if (!profil?.boutique_id) return { message: "Votre compte n’est rattaché à aucune boutique", statut: 403 };
  const { data: boutique, error: erreurBoutique } = await client.from("boutiques").select("statut").eq("id", profil.boutique_id).maybeSingle();
  if (erreurBoutique) return { message: messages.indisponible, statut: 503 };
  if (boutique?.statut !== "validee") return { message: BOUTIQUE_NON_VALIDEE, statut: 403 };
  return null;
}

/** Enregistre un appel à l’IA s’il reste du quota. Renvoie null si l’appel est autorisé. */
export async function consommerQuotaIA(client: SupabaseClient<Database>, indisponible: string): Promise<RefusIA | null> {
  const { data, error } = await client.rpc("consommer_quota_ia");
  if (error || typeof data !== "boolean") return { message: indisponible, statut: 503 };
  return data ? null : { message: QUOTA_IA_ATTEINT, statut: 429 };
}

import { creerClientNavigateur } from "./supabase/client";
import type { Enums } from "./supabase/types";

// Aucun identifiant de visiteur, cookie de suivi ou adresse IP n’est enregistré.
export async function enregistrerEvenement(type: Enums<"type_evenement">, boutiqueId: string, articleId?: string) {
  try {
    await creerClientNavigateur().from("evenements").insert({ type, boutique_id: boutiqueId, ...(articleId ? { article_id: articleId } : {}) });
  } catch {
    // La mesure ne doit jamais empêcher de consulter ou partager une page.
  }
}

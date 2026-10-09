import { enregistrerMesure } from "@/app/visiteurs/actions";
import type { Enums } from "./supabase/types";

// Mesure envoyée au serveur (action serveur), qui la transmet à la base avec la limite par visiteur.
// Aucun identifiant de visiteur ni cookie de suivi ; l'adresse IP n'est jamais enregistrée en clair (empreinte limitée à 24 h).
export async function enregistrerEvenement(type: Enums<"type_evenement">, boutiqueId: string, articleId?: string, taille?: string) {
  try {
    await enregistrerMesure(type, boutiqueId, articleId, taille);
  } catch {
    // La mesure ne doit jamais empêcher de consulter ou partager une page.
  }
}

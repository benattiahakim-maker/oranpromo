"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { acceptationCouvre, accepterDocuments, documentsValides, lireDocumentsAAccepter, MESSAGE_CONDITIONS_CHANGEES } from "@/lib/acceptations";

// US-34.3 : le commerçant accepte, depuis SON compte, les conditions commerçants et la politique de confidentialité
// dans la version affichée (jamais un ambassadeur à sa place : la base n'accepte que pour le compte connecté).
export type ResultatAcceptation = { ok?: true; erreur?: string };

export async function accepterConditionsEspace(documents: unknown): Promise<ResultatAcceptation> {
  try {
    const acceptes = documentsValides(documents);
    if (!acceptes || acceptes.length === 0) return { erreur: "Cochez la case pour accepter les conditions." };
    const client = await creerClientServeur();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { erreur: "Connectez-vous pour accepter les conditions." };
    const aAccepter = await lireDocumentsAAccepter(client);
    if (!acceptationCouvre(aAccepter, acceptes)) return { erreur: MESSAGE_CONDITIONS_CHANGEES };
    await accepterDocuments(client, aAccepter, "espace");
    return { ok: true };
  } catch (error) { return { erreur: error instanceof Error ? error.message : "Impossible d’enregistrer votre accord. Réessayez." }; }
}

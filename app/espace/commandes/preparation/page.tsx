import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { CATEGORIES_ARTICLE } from "@/lib/article";
import { grouperPreparation, listerAPreparer, type Preparation } from "@/lib/tableau-commandes";
import VuePreparation from "@/components/VuePreparation";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { traduireMessage } from "@/lib/textes/messages";

export async function generateMetadata() { return { title: (await getTextes()).espace.preparation.titre, robots: { index: false, follow: false } }; }

async function charger(): Promise<{ boutique: string; maintenant: number; preparation: Preparation | null; erreur: string | null }> {
  const client = await creerClientServeur();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { data: profil } = await client.from("profils").select("boutique_id, boutiques!profils_boutique_id_fkey(nom)").eq("id", user.id).maybeSingle();
  const boutique = (profil?.boutiques as unknown as { nom: string } | null)?.nom ?? "";
  const maintenant = Date.now();
  if (!profil?.boutique_id) return { boutique, maintenant, preparation: null, erreur: "Votre compte n’est rattaché à aucune boutique." };
  try { return { boutique, maintenant, preparation: grouperPreparation(await listerAPreparer(client, profil.boutique_id), CATEGORIES_ARTICLE), erreur: null }; }
  catch { return { boutique, maintenant, preparation: null, erreur: "Impossible de charger les commandes. Réessayez." }; }
}

// US-28.3 : liste de préparation imprimable (commandes confirmées seulement, décision 6).
export default async function PagePreparation() {
  const [donnees, langue] = await Promise.all([charger(), getLangue()]);
  return <VuePreparation {...donnees} erreur={donnees.erreur && traduireMessage(donnees.erreur, langue)} langue={langue} />;
}

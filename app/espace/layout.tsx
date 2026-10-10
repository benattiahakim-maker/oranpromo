import type { ReactNode } from "react";
import NavigationEspace from "@/components/NavigationEspace";
import { creerClientServeur } from "@/lib/supabase/server";
import { compterCommandesAConfirmer } from "@/lib/commandes";
import { lireResumeMaBoutique } from "@/lib/avis";
import AccepterConditionsCommercant from "@/components/AccepterConditionsCommercant";
import { lireDocumentsAAccepter, type DocumentAAccepter } from "@/lib/acceptations";

// Compteurs de la navigation : commandes à confirmer (US-20.3) et avis sans réponse (US-32). Une lecture qui échoue
// donne 0 (le lien reste, sans nombre).
async function compteurs(): Promise<{ aConfirmer: number; avisSansReponse: number }> {
  try {
    const client = await creerClientServeur();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { aConfirmer: 0, avisSansReponse: 0 };
    const { data: profil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
    if (!profil?.boutique_id) return { aConfirmer: 0, avisSansReponse: 0 };
    const [aConfirmer, avisSansReponse] = await Promise.all([
      compterCommandesAConfirmer(client, profil.boutique_id).catch(() => 0),
      lireResumeMaBoutique(client).then(r => r.sansReponse, () => 0),
    ]);
    return { aConfirmer, avisSansReponse };
  } catch { return { aConfirmer: 0, avisSansReponse: 0 }; }
}

// US-34.3 : textes que le commerçant connecté doit (re)accepter (vide pour un visiteur, un admin, un ambassadeur).
// Lecture impossible : l'espace reste ouvert (la case reviendra à la visite suivante).
async function conditionsAAccepter(): Promise<DocumentAAccepter[]> {
  try {
    const client = await creerClientServeur();
    const { data: { user } } = await client.auth.getUser();
    return user ? await lireDocumentsAAccepter(client) : [];
  } catch { return []; }
}

export default async function EspaceLayout({ children }: { children: ReactNode }) {
  const [{ aConfirmer, avisSansReponse }, conditions] = await Promise.all([compteurs(), conditionsAAccepter()]);
  // Tant que les conditions ne sont pas acceptées, chaque page de l'espace affiche la demande d'accord à la place
  // de son contenu (la navigation et la déconnexion restent).
  return <div className="font-sans [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_select:disabled]:opacity-50 [&_input[type=checkbox]]:accent-noir"><NavigationEspace aConfirmer={aConfirmer} avisSansReponse={avisSansReponse} />{conditions.length > 0 ? <AccepterConditionsCommercant documents={conditions} /> : children}</div>;
}

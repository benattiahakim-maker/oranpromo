import type { ReactNode } from "react";
import NavigationEspace from "@/components/NavigationEspace";
import { creerClientServeur } from "@/lib/supabase/server";
import { compterCommandesAConfirmer } from "@/lib/commandes";
import AccepterConditionsCommercant from "@/components/AccepterConditionsCommercant";
import { lireDocumentsAAccepter, type DocumentAAccepter } from "@/lib/acceptations";

async function commandesAConfirmer(): Promise<number> {
  try {
    const client = await creerClientServeur();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return 0;
    const { data: profil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
    return profil?.boutique_id ? await compterCommandesAConfirmer(client, profil.boutique_id) : 0;
  } catch { return 0; }
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
  const [aConfirmer, conditions] = await Promise.all([commandesAConfirmer(), conditionsAAccepter()]);
  // Tant que les conditions ne sont pas acceptées, chaque page de l'espace affiche la demande d'accord à la place
  // de son contenu (la navigation et la déconnexion restent).
  return <div className="font-sans [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_select:disabled]:opacity-50 [&_input[type=checkbox]]:accent-noir"><NavigationEspace aConfirmer={aConfirmer} />{conditions.length > 0 ? <AccepterConditionsCommercant documents={conditions} /> : children}</div>;
}

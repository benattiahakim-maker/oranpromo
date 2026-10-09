// US-28.4 : vérification légère pour la mise à jour automatique de /espace/commandes (option A, toutes les 20 s).
// Lecture avec la session de la boutique (règles RLS) ; réponse sans donnée personnelle (compteurs + dernier numéro).
// Route plutôt qu'action serveur : les actions serveur passent une à une depuis le navigateur et sont faites pour modifier.
import { creerClientServeur } from "@/lib/supabase/server";
import { boutiqueDuCompte } from "@/lib/gestion-articles";
import { lireEtatCommandes } from "@/lib/tableau-commandes";

const ENTETES = { "Cache-Control": "private, no-store" };

export async function GET() {
  const client = await creerClientServeur();
  let boutiqueId: string;
  try { boutiqueId = await boutiqueDuCompte(client); }
  catch { return Response.json({ erreur: "Non autorisé" }, { status: 401, headers: ENTETES }); }
  try { return Response.json(await lireEtatCommandes(client, boutiqueId, Date.now()), { headers: ENTETES }); }
  catch { return Response.json({ erreur: "Indisponible" }, { status: 503, headers: ENTETES }); }
}

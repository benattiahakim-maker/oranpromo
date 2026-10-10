import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import type { CommandeRecue } from "@/lib/commandes";
import { lireBonsDesCommandes } from "@/lib/bons-boutique";
import { chercherCommandes, etapeParDefaut, lireEtatCommandes, lireEtape, lireRecherche, listerEtape, RECHERCHE_MAX, type CompteursEtapes, type EtapeCommande } from "@/lib/tableau-commandes";
import VueCommandesRecues from "@/components/VueCommandesRecues";
import { getLangue, getTextes } from "@/lib/langue-serveur";

export async function generateMetadata() { return { title: (await getTextes()).espace.commandes.titre, robots: { index: false, follow: false } }; }

type Parametres = { etape?: string | string[]; vue?: string | string[]; q?: string | string[] };

/** Lecture de la page (hors du composant : l’heure de référence est prise une fois, ici). */
async function charger(parametres: Parametres) {
  const client = await creerClientServeur();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id, boutiques!profils_boutique_id_fkey(nom)").eq("id", user.id).maybeSingle();
  const boutique = (profil?.boutiques as unknown as { nom: string } | null)?.nom ?? "votre boutique";
  const maintenant = Date.now();
  const recherche = lireRecherche(parametres.q);
  let compteurs: CompteursEtapes = { a_confirmer: 0, a_preparer: 0, pretes: 0, terminees: 0 };
  let derniere: number | null = null;
  let etape: EtapeCommande = lireEtape(parametres) ?? "a_confirmer";
  let commandes: CommandeRecue[] = [], erreur = Boolean(erreurProfil);
  if (profil?.boutique_id) {
    try {
      const etat = await lireEtatCommandes(client, profil.boutique_id, maintenant);
      ({ derniere, ...compteurs } = etat);
      etape = lireEtape(parametres) ?? etapeParDefaut(compteurs);
      commandes = recherche ? await chercherCommandes(client, profil.boutique_id, recherche) : await listerEtape(client, profil.boutique_id, etape, maintenant);
      // US-33.4 : nom des bons posés (en cas d'erreur : « Bon parrainage », comme avant).
      const bons = await lireBonsDesCommandes(client, commandes.filter(c => (c.remise_bon ?? 0) > 0).map(c => c.id)).catch(() => null);
      if (bons?.size) commandes = commandes.map(c => ({ ...c, bon: bons.get(c.id) ?? null }));
    } catch { erreur = true; }
  }
  return { boutiqueId: profil?.boutique_id ?? null, boutique, maintenant, recherche, compteurs, derniere, etape, commandes, erreur };
}

// US-28.1 : étapes avec compteurs, la plus urgente d’abord, recherche par n° ou prénom.
export default async function PageCommandesRecues({ searchParams }: { searchParams: Promise<Parametres> }) {
  const parametres = await searchParams;
  const { boutiqueId, boutique, maintenant, recherche, compteurs, derniere, etape, commandes, erreur } = await charger(parametres);
  const texteRecherche = typeof parametres.q === "string" ? parametres.q.trim().slice(0, RECHERCHE_MAX) : "";
  return <VueCommandesRecues {...{ boutiqueId, boutique, maintenant, recherche: Boolean(recherche), texteRecherche, compteurs, derniere, etape, commandes, erreur, langue: await getLangue() }} />;
}

import type { Metadata } from "next";
import EntetePublic from "@/components/EntetePublic";
import CarteBoutiques from "@/components/CarteBoutiques";
import { creerClientServeur } from "@/lib/supabase/server";
import { getTextes } from "@/lib/langue-serveur";
import { versBoutiquesCarte } from "@/lib/carte";
import { estUnivers } from "@/lib/catalogue";
import { notFound } from "next/navigation";
import { getVilleOuverte, getVillesOuvertes } from "@/lib/ville-serveur";
import { cheminVille } from "@/lib/ville";
import { lireResumes } from "@/lib/avis";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ville: string }> }): Promise<Metadata> {
  const [t, { ville }] = await Promise.all([getTextes(), params]);
  return { title: t.carteBoutiques.metaTitre, alternates: { canonical: cheminVille(ville, "/carte") } };
}

// US-24.3 : carte publique des boutiques validées. Une seule lecture légère (boutiques_carte) ; la liste est rendue
// par le serveur (utilisable sans JavaScript), la carte Leaflet est chargée ensuite dans le navigateur.
export default async function Carte({ params, searchParams }: { params: Promise<{ ville: string }>; searchParams: Promise<{ univers?: string | string[] }> }) {
  const [{ ville: code }, { univers }, client, t] = await Promise.all([params, searchParams, creerClientServeur(), getTextes()]);
  const [ville, ouvertes] = await Promise.all([getVilleOuverte(code), getVillesOuvertes()]);
  if (!ville) notFound();
  // US-29.3 : épingles de la ville seulement.
  const { data, error } = await client.rpc("boutiques_carte", { code_ville: ville.code });
  const filtre = typeof univers === "string" && estUnivers(univers) ? univers : null;
  // US-32.3 : notes des boutiques de la carte, en une requête (sans elles, la carte s'affiche sans note).
  const boutiques = data && !error ? versBoutiquesCarte(data) : [];
  const resumes = await lireResumes(client, boutiques.map(b => b.id)).catch(() => null);
  const notes = Object.fromEntries([...(resumes ?? new Map()).entries()].map(([id, r]) => [id, { nombre: r.nombre, moyenne: r.moyenne }]));
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic ville={ville} choixVille={ouvertes.length > 1} />
    <main>
      {error || !data ? <p role="alert" className="px-6 py-10 text-center">{t.carteBoutiques.erreur}</p> : <CarteBoutiques boutiques={boutiques} notes={notes} univers={filtre} chemin={cheminVille(ville.code, "/carte")} ville={ville} />}
    </main>
  </div>;
}

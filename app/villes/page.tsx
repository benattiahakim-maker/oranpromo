// US-29.2 : page de choix de la ville (villes ouvertes seulement, triées par ordre puis nom).
// ?retour= : page à rouvrir dans la ville choisie ; ?inconnue= : ville inconnue ou fermée demandée dans l'adresse.
import type { Metadata } from "next";
import EntetePublic from "@/components/EntetePublic";
import ChoixVille from "@/components/ChoixVille";
import { getTextes } from "@/lib/langue-serveur";
import { getCookieVille, getVillesOuvertes } from "@/lib/ville-serveur";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTextes();
  return { title: t.villes.metaTitre, alternates: { canonical: "/villes" } };
}

export default async function Villes({ searchParams }: { searchParams: Promise<{ retour?: string | string[]; inconnue?: string | string[] }> }) {
  const [{ retour, inconnue }, t, villes, cookie] = await Promise.all([searchParams, getTextes(), getVillesOuvertes(), getCookieVille()]);
  const actuelle = cookie && villes.some(v => v.code === cookie) ? cookie : null;
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic />
    <main>
      <h1 className="font-titre px-5 pt-8 text-3xl">{t.villes.titre}</h1>
      {typeof inconnue === "string" && inconnue && <p role="alert" className="mx-5 mt-4 border border-noir px-4 py-3 text-sm">{t.villes.inconnue}</p>}
      <p className="px-5 pt-3 text-sm text-gris">{t.villes.texte}</p>
      <ChoixVille villes={villes} actuelle={actuelle} retour={typeof retour === "string" ? retour : ""} />
    </main>
  </div>;
}

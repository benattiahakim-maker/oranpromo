import type { Metadata } from "next";
import EntetePublic from "@/components/EntetePublic";
import CarteBoutiques from "@/components/CarteBoutiques";
import { creerClientServeur } from "@/lib/supabase/server";
import { getTextes } from "@/lib/langue-serveur";
import { versBoutiquesCarte } from "@/lib/carte";
import { estUnivers } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTextes();
  return { title: t.carteBoutiques.metaTitre };
}

// US-24.3 : carte publique des boutiques validées. Une seule lecture légère (boutiques_carte) ; la liste est rendue
// par le serveur (utilisable sans JavaScript), la carte Leaflet est chargée ensuite dans le navigateur.
export default async function Carte({ searchParams }: { searchParams: Promise<{ univers?: string | string[] }> }) {
  const [{ univers }, client, t] = await Promise.all([searchParams, creerClientServeur(), getTextes()]);
  const { data, error } = await client.rpc("boutiques_carte");
  const filtre = typeof univers === "string" && estUnivers(univers) ? univers : null;
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic />
    <main>
      {error || !data ? <p role="alert" className="px-6 py-10 text-center">{t.carteBoutiques.erreur}</p> : <CarteBoutiques boutiques={versBoutiquesCarte(data)} univers={filtre} />}
    </main>
  </div>;
}

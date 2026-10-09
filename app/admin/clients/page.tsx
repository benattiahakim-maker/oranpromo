import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { listerClientsSurveilles, listerNoShowsDeclares, listerNumerosPartages } from "@/lib/clients";
import ClientsSurveilles from "@/components/ClientsSurveilles";

export const metadata = { title: "Clients", robots: { index: false, follow: false } };

export default async function Clients() {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  let listes, noShows, numerosPartages;
  try { [listes, noShows, numerosPartages] = await Promise.all([listerClientsSurveilles(client), listerNoShowsDeclares(client), listerNumerosPartages(client)]); }
  catch { return <main className="p-6"><h1 className="font-titre text-[28px]">Clients</h1><p role="alert" className="my-6">Impossible de charger les clients. Réessayez.</p></main>; }
  return <main className="px-6 pb-10 text-noir"><h1 className="mt-6 font-titre text-[28px] font-normal">Clients</h1><ClientsSurveilles bloques={listes.bloques} avecNoShows={listes.avecNoShows} noShows={noShows} numerosPartages={numerosPartages} /></main>;
}

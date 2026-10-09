import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { lireBudget, listerParrainages, signauxParrainages } from "@/lib/parrainage-admin";
import BudgetParrainage from "@/components/BudgetParrainage";
import ParrainagesAdmin from "@/components/ParrainagesAdmin";

// US-27.5 : parrainages, signaux, budget (admin seulement).
export const metadata = { title: "Parrainages", robots: { index: false, follow: false } };

export default async function Parrainages() {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  let budget, parrainages;
  try { [budget, parrainages] = await Promise.all([lireBudget(client), listerParrainages(client)]); }
  catch { return <main className="p-6"><h1 className="font-titre text-[28px]">Parrainages</h1><p role="alert" className="my-6">Impossible de charger les parrainages. Réessayez.</p></main>; }
  const signaux = Object.fromEntries(signauxParrainages(parrainages));
  return <main className="px-6 pb-10 text-noir"><h1 className="mt-6 font-titre text-[28px] font-normal">Parrainages</h1>
    <BudgetParrainage budget={budget} />
    <ParrainagesAdmin parrainages={parrainages} signaux={signaux} />
  </main>;
}

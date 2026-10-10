import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { aujourdhuiAlger, derniersMois, lireBudget, listerLignesDeCote, listerReleves, moisDepuisParametre } from "@/lib/parrainage-admin";
import BudgetParrainage from "@/components/BudgetParrainage";
import RelevesAdmin from "@/components/RelevesAdmin";
import SignauxInscriptions from "@/components/SignauxInscriptions";
import { lireSignauxInscriptions, type InscriptionsBoutique } from "@/lib/inscriptions-admin";

// US-27.5 : remboursement des bons aux boutiques, par mois (admin seulement).
// US-31.4 : signaux des inscriptions en boutique (sans eux, la page s'affiche quand même).
export const metadata = { title: "Remboursements", robots: { index: false, follow: false } };

export default async function Remboursements({ searchParams }: { searchParams: Promise<{ mois?: string | string[] }> }) {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  const mois = moisDepuisParametre((await searchParams).mois);
  const possibles = derniersMois(12);
  if (!possibles.includes(mois)) possibles.push(mois);
  let budget, releves, deCote;
  try { [budget, releves, deCote] = await Promise.all([lireBudget(client), listerReleves(client, mois), listerLignesDeCote(client)]); }
  catch { return <main className="p-6"><h1 className="font-titre text-[28px]">Remboursements</h1><p role="alert" className="my-6">Impossible de charger les relevés. Réessayez.</p></main>; }
  const inscriptions: InscriptionsBoutique[] | null = await lireSignauxInscriptions(client).catch(() => null);
  return <main className="px-6 pb-10 text-noir"><h1 className="mt-6 font-titre text-[28px] font-normal">Remboursements</h1>
    <BudgetParrainage budget={budget} />
    <RelevesAdmin mois={mois} moisPossibles={possibles} releves={releves} deCote={deCote} aujourdhui={aujourdhuiAlger()} />
    {inscriptions && <SignauxInscriptions boutiques={inscriptions} />}
  </main>;
}

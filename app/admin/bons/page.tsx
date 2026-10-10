import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { lireSignaux, listerProgrammes, type SignalBoutique } from "@/lib/bons-admin";
import { listerVilles } from "@/lib/villes-admin";
import ProgrammesBons from "@/components/ProgrammesBons";
import NouvelleCampagne from "@/components/NouvelleCampagne";

// US-33.5 : programmes de bons (bienvenue, campagnes) : chiffres, arrêt, signaux, nouvelle campagne (admin seulement).
export const metadata = { title: "Bons", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Bons() {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  let programmes, villes;
  try { [programmes, villes] = await Promise.all([listerProgrammes(client), listerVilles(client)]); }
  catch { return <main className="p-6"><h1 className="font-titre text-[28px]">Bons</h1><p role="alert" className="my-6">Impossible de charger les programmes. Réessayez.</p></main>; }
  const signaux: Record<string, SignalBoutique[]> = Object.fromEntries(await Promise.all(programmes.map(async p =>
    [p.id, await lireSignaux(client, p.id).catch(() => [])] as const)));
  return <main className="px-6 pb-10 text-noir"><h1 className="mt-6 font-titre text-[28px] font-normal">Bons</h1>
    <ProgrammesBons programmes={programmes} signaux={signaux} maintenant={new Date().toISOString()} />
    <NouvelleCampagne villes={villes.filter(v => v.ouverte).map(v => ({ code: v.code, nom: v.nom }))} />
  </main>;
}

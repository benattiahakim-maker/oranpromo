import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { filtreBoutiques, lireRoleAdministration, listerBoutiques, STATUTS_BOUTIQUE } from "@/lib/boutique";
import NouvelleBoutique from "@/components/NouvelleBoutique";
import BoutiquesAdministration from "@/components/BoutiquesAdministration";

export default async function Boutiques({ searchParams }: { searchParams: Promise<{ statut?: string | string[] }> }) {
  const client = await creerClientServeur();
  let role;
  try { role = await lireRoleAdministration(client); }
  catch (error) { return <main className="p-6"><p role="alert">{error instanceof Error ? error.message : "Accès réservé"}</p></main>; }
  const statut = filtreBoutiques((await searchParams).statut, role);
  let boutiques = null;
  let erreur = "";
  try { boutiques = await listerBoutiques(client, statut); }
  catch { erreur = "Impossible de charger les boutiques. Réessayez."; }
  return <main className="p-6 text-noir">
    <h1 className="my-6 font-titre text-[28px] font-normal">Les boutiques</h1>
    <form method="get" className="flex flex-col gap-3"><label className="etiquette">Filtrer par statut<select name="statut" defaultValue={statut ?? "tous"} className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base"><option value="tous">Tous les statuts</option>{Object.entries(STATUTS_BOUTIQUE).map(([valeur, texte]) => <option key={valeur} value={valeur}>{texte}</option>)}</select></label><button type="submit" className="min-h-[44px] border border-noir px-3 py-2">Filtrer</button></form>
    {erreur ? <p role="alert" className="my-6">{erreur}</p> : <BoutiquesAdministration boutiques={boutiques ?? []} role={role} />}
    <NouvelleBoutique />
    <Link href="/espace" className="my-6 inline-flex min-h-[44px] items-center">Retour à mon espace</Link>
  </main>;
}

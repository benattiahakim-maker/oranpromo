import { redirect } from "next/navigation";
import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireProfilClient, listerMesNoShows, messageNoShows, type MonNoShow } from "@/lib/clients";
import FormulaireProfilClient from "@/components/FormulaireProfilClient";
import MesNoShows from "@/components/MesNoShows";

export const metadata = { title: "Mon compte", robots: { index: false, follow: false } };

export default async function MonCompte({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  let profil;
  try { profil = await lireProfilClient(await creerClientServeur()); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">Impossible de charger votre profil. Réessayez.</p></main>; }
  if (!profil) redirect("/compte/connexion?suite=/compte");
  const avertissement = messageNoShows(profil.no_shows, profil.bloque);
  let noShows: MonNoShow[] = [];
  try { noShows = await listerMesNoShows(await creerClientServeur()); } catch { noShows = []; }
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon compte</p><h1 className="font-titre text-[28px] font-normal">{profil.nom ?? "Mon profil"}</h1></header>
    {avertissement && <p role="alert" className="mt-5 border border-trait p-4 text-sm leading-[1.6]">{avertissement}</p>}
    {noShows.length > 0 && <MesNoShows noShows={noShows} />}
    <div className="mt-6"><FormulaireProfilClient nom={profil.nom} telephone={profil.telephone} /></div>
    <Link href="/compte/commandes" className="etiquette mt-8 flex min-h-[44px] items-center justify-center border border-noir">Mes commandes</Link>
    {profil.boutique_id && <Link href="/espace" className="etiquette mt-3 flex min-h-[44px] items-center justify-center border border-trait">Mon espace boutique</Link>}
    {erreur === "deconnexion" && <p role="alert" className="mt-4">Impossible de vous déconnecter. Réessayez.</p>}
  </main>;
}

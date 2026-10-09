import { redirect } from "next/navigation";
import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireProfilClient, listerMesNoShows, messageNoShows, type MonNoShow } from "@/lib/clients";
import FormulaireProfilClient from "@/components/FormulaireProfilClient";
import MesNoShows from "@/components/MesNoShows";
import NumeroVerifie from "@/components/NumeroVerifie";
import { modeConnexionClient } from "@/lib/telephone";
import { getTextes } from "@/lib/langue-serveur";

export const metadata = { title: "Mon compte", robots: { index: false, follow: false } };

export default async function MonCompte({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const t = (await getTextes()).compte;
  let profil;
  try { profil = await lireProfilClient(await creerClientServeur()); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">{t.chargementImpossible}</p></main>; }
  if (!profil) redirect("/compte/connexion?suite=/compte");
  const avertissement = messageNoShows(profil.no_shows, profil.bloque);
  const parTelephone = modeConnexionClient() === "telephone";
  let noShows: MonNoShow[] = [];
  try { noShows = await listerMesNoShows(await creerClientServeur()); } catch { noShows = []; }
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">{t.monCompte}</p><h1 dir="auto" className="font-titre text-[28px] font-normal">{profil.nom ?? t.monProfil}</h1></header>
    {avertissement && <p role="alert" className="mt-5 border border-trait p-4 text-sm leading-[1.6]">{avertissement}</p>}
    {noShows.length > 0 && <MesNoShows noShows={noShows} />}
    {/* US-21.2 : en mode téléphone (ou numéro déjà vérifié), le numéro se vérifie par code et ne se saisit plus à la main. */}
    <NumeroVerifie telephone={profil.telephone} verifie={Boolean(profil.telephone_verifie_le)} verificationActive={parTelephone && profil.role === "client"} />
    <div className="mt-6"><FormulaireProfilClient nom={profil.nom} telephone={profil.telephone} telephoneModifiable={!parTelephone && !profil.telephone_verifie_le} /></div>
    <Link href="/compte/commandes" className="etiquette mt-8 flex min-h-[44px] items-center justify-center border border-noir">{t.mesCommandes}</Link>
    {profil.boutique_id && <Link href="/espace" className="etiquette mt-3 flex min-h-[44px] items-center justify-center border border-trait">{t.monEspace}</Link>}
    {erreur === "deconnexion" && <p role="alert" className="mt-4">{t.deconnexionImpossible}</p>}
  </main>;
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireProfilClient, listerMesNoShows, messageNoShows, type MonNoShow } from "@/lib/clients";
import FormulaireProfilClient from "@/components/FormulaireProfilClient";
import MesNoShows from "@/components/MesNoShows";
import NumeroVerifie from "@/components/NumeroVerifie";
import { modeConnexionClient } from "@/lib/telephone";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { traduireMessage } from "@/lib/textes/messages";
import { cookies } from "next/headers";
import ChoixParrain from "@/components/ChoixParrain";
import MonParrainage from "@/components/MonParrainage";
import MesBons from "@/components/MesBons";
import AjouterCodeBon from "@/components/AjouterCodeBon";
import { afficherMonParrainage, COOKIE_PARRAIN, lireMonParrainage, normaliserCodeParrainage, preparerInvitation, type MonParrainage as DonneesParrainage } from "@/lib/parrainage";
import { lireMesBons, type BonClient } from "@/lib/bons";
import { compterMesBoutiques } from "@/lib/abonnements";
import { remplir } from "@/lib/langue";

export const metadata = { title: "Mon compte", robots: { index: false, follow: false } };

export default async function MonCompte({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const t = (await getTextes()).compte;
  let profil;
  try { profil = await lireProfilClient(await creerClientServeur()); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">{t.chargementImpossible}</p></main>; }
  if (!profil) redirect("/compte/connexion?suite=/compte");
  const avertissement = traduireMessage(messageNoShows(profil.no_shows, profil.bloque), await getLangue());
  const parTelephone = modeConnexionClient() === "telephone";
  let noShows: MonNoShow[] = [];
  try { noShows = await listerMesNoShows(await creerClientServeur()); } catch { noShows = []; }
  // US-27 : parrainage et bons (rien ne s'affiche tant que le parrainage est fermé et que le client n'a ni bon ni filleul).
  let parrainage: DonneesParrainage | null = null, bons: BonClient[] = [];
  if (profil.role === "client") {
    const client = await creerClientServeur();
    [parrainage, bons] = await Promise.all([lireMonParrainage(client).catch(() => null), lireMesBons(client).catch(() => [])]);
  }
  const invitation = parrainage?.actif && parrainage.peut_parrainer ? await preparerInvitation(await creerClientServeur(), await getLangue()).catch(() => null) : null;
  // US-31.2 : boutiques suivies (clients seulement).
  const nombreBoutiques = profil.role === "client" ? await compterMesBoutiques(await creerClientServeur()) : null;
  const ts = (await getTextes()).suivre;
  const codeInvite = normaliserCodeParrainage((await cookies()).get(COOKIE_PARRAIN)?.value) ?? "";
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">{t.monCompte}</p><h1 dir="auto" className="font-titre text-[28px] font-normal">{profil.nom ?? t.monProfil}</h1></header>
    {avertissement && <p role="alert" className="mt-5 border border-trait p-4 text-sm leading-[1.6]">{avertissement}</p>}
    {noShows.length > 0 && <MesNoShows noShows={noShows} />}
    {/* US-21.2 : en mode téléphone (ou numéro déjà vérifié), le numéro se vérifie par code et ne se saisit plus à la main. */}
    <NumeroVerifie telephone={profil.telephone} verifie={Boolean(profil.telephone_verifie_le)} verificationActive={parTelephone && profil.role === "client"} />
    <div className="mt-6"><FormulaireProfilClient nom={profil.nom} telephone={profil.telephone} telephoneModifiable={!parTelephone && !profil.telephone_verifie_le} /></div>
    {parrainage?.peut_choisir && <ChoixParrain initial={parrainage.parrain_saisi ? "" : codeInvite} parrainSaisi={parrainage.parrain_saisi} saisies={parrainage.saisies} />}
    <Link href="/compte/commandes" className="etiquette mt-8 flex min-h-[44px] items-center justify-center border border-noir">{t.mesCommandes}</Link>
    {nombreBoutiques !== null && <Link href="/compte/boutiques" className="etiquette mt-3 flex min-h-[44px] items-center justify-center border border-noir">{remplir(ts.mesBoutiques, { n: nombreBoutiques })}</Link>}
    {/* US-34.4 : « Mes données » (droit d'accès). « Fermer mon compte » : pas encore (durées de conservation à fixer). */}
    <Link href="/compte/donnees" className="etiquette mt-3 flex min-h-[44px] items-center justify-center border border-trait">{(await getTextes()).donnees.mesDonnees}</Link>
    {profil.boutique_id && <Link href="/espace" className="etiquette mt-3 flex min-h-[44px] items-center justify-center border border-trait">{t.monEspace}</Link>}
    {bons.length > 0 && <MesBons bons={bons} />}
    {/* US-33.3 : code d'une campagne (numéro vérifié obligatoire, vérifié aussi par la base). */}
    {profil.role === "client" && profil.telephone_verifie_le && <AjouterCodeBon />}
    {parrainage && afficherMonParrainage(parrainage) && <MonParrainage parrainage={parrainage} invitation={invitation} />}
    {erreur === "deconnexion" && <p role="alert" className="mt-4">{t.deconnexionImpossible}</p>}
  </main>;
}

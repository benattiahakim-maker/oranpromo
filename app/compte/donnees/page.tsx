import { redirect } from "next/navigation";
import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { getTextes } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { CHEMINS, formaterVersion } from "@/lib/juridique";
import { formaterDate, lireMesDonnees, type Compteur, type MesDonnees } from "@/lib/donnees-compte";

export const metadata = { title: "Mes données", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// US-34.4 : « Mes données » (loi 18-07, art. 34). Lecture seule. « Fermer mon compte » : pas encore (question 5 de US-34).
export default async function PageMesDonnees() {
  const textes = await getTextes();
  const t = textes.donnees;
  let donnees: MesDonnees | null;
  try { donnees = await lireMesDonnees(await creerClientServeur()); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">{t.chargementImpossible}</p></main>; }
  if (!donnees) redirect("/compte/connexion?suite=/compte/donnees");
  const compteur = (c: Compteur, feminin: boolean) => c.nombre === 0 || !c.dernier ? (feminin ? t.aucune : t.aucun)
    : remplir(feminin ? t.nombreDerniere : t.nombreDernier, { n: c.nombre, date: formaterDate(c.dernier) });
  const lignes: [string, React.ReactNode][] = [
    [t.numero, donnees.telephone ? remplir(donnees.telephoneVerifieLe ? t.numeroVerifie : t.numeroNonVerifie, { numero: donnees.telephone, date: donnees.telephoneVerifieLe ? formaterDate(donnees.telephoneVerifieLe) : "" }) : t.aucun],
    [t.nom, donnees.nom ?? t.aucun],
    [t.compte, remplir(t.creeLe, { date: formaterDate(donnees.creeLe) })],
    [t.commandes, compteur(donnees.commandes, true)],
    [t.bons, compteur(donnees.bons, false)],
    [t.avis, compteur(donnees.avis, false)],
    [t.boutiques, donnees.boutiques.length ? <ul>{donnees.boutiques.map((b, i) => <li key={i}>{remplir(t.suivieDepuis, { nom: b.nom, date: formaterDate(b.depuis) })}</li>)}</ul> : t.aucune],
    [t.accords, donnees.accords.length ? <ul>{donnees.accords.map((a, i) => <li key={i}>{remplir(t.accord, { document: textes.juridique.titres[a.document], version: formaterVersion(a.version), date: formaterDate(a.accepteLe) })}</li>)}</ul> : t.aucun],
  ];
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><h1 className="font-titre text-[28px] font-normal">{t.mesDonnees}</h1><p className="mt-2 text-sm text-gris">{t.intro}</p></header>
    <dl aria-label={t.mesDonnees}>{lignes.map(([titre, valeur]) => <div key={titre} className="border-b border-trait py-3">
      <dt className="etiquette text-xs text-gris">{titre}</dt><dd dir="auto" className="mt-1 break-words text-sm leading-[1.6]"><bdi>{valeur}</bdi></dd></div>)}</dl>
    <p className="mt-6 text-xs leading-[1.6] text-gris">{t.droits} <Link href={CHEMINS.confidentialite} className="underline">{t.lienPolitique}</Link>.</p>
    <Link href="/compte" className="etiquette mt-8 flex min-h-[44px] items-center justify-center border border-noir">{t.retour}</Link>
  </main>;
}

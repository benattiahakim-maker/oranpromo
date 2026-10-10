// US-28.1 : affichage de /espace/commandes (étapes, recherche, tableau), séparé de la lecture des données.
import Link from "next/link";
import Form from "next/form";
import type { CommandeRecue } from "@/lib/commandes";
import { remplir, type Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import { LIGNES_PAR_ETAPE, ORDRE_ETAPES, RECHERCHE_MAX, type CompteursEtapes, type EtapeCommande } from "@/lib/tableau-commandes";
import TableauCommandes from "@/components/TableauCommandes";
import MiseAJourCommandes, { BanniereNouvelle, EtatMiseAJour } from "@/components/MiseAJourCommandes";

export type DonneesCommandesRecues = { boutiqueId: string | null; boutique: string; maintenant: number; recherche: boolean; texteRecherche: string; compteurs: CompteursEtapes; derniere?: number | null; etape: EtapeCommande; commandes: CommandeRecue[]; erreur: boolean; langue?: Langue };

export default function VueCommandesRecues({ boutiqueId, boutique, maintenant, recherche, texteRecherche, compteurs, derniere = null, etape, commandes, erreur, langue = "fr" }: DonneesCommandesRecues) {
  const e = textesDe(langue).espace, t = e.commandes;
  const lienEtape = (e: EtapeCommande) => `/espace/commandes?etape=${e}`;
  // US-28.4 : mise à jour automatique (seulement si la boutique est chargée).
  const contenu = <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir lg:max-w-[1120px]">
    <header className="flex flex-col gap-3 px-4 pb-3 pt-5 lg:flex-row lg:items-end lg:justify-between lg:px-8">
      <div><p className="etiquette text-gris">{e.commun.monEspace}</p><h1 className="font-titre text-[26px] font-normal lg:text-[30px]">{t.titre}</h1><EtatMiseAJour /></div>
      <div className="flex gap-2 lg:w-[520px]">
        <Form action="/espace/commandes" role="search" className="flex min-h-11 min-w-0 flex-1 items-center border border-noir">
          {!recherche && <input type="hidden" name="etape" value={etape} />}
          <label htmlFor="recherche-commande" className="sr-only">{t.recherche}</label>
          <span aria-hidden="true" className="ps-3 text-gris">⌕</span>
          <input id="recherche-commande" name="q" type="search" defaultValue={texteRecherche} maxLength={RECHERCHE_MAX} placeholder={t.recherche} autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none" />
          {texteRecherche && <Link href={lienEtape(etape)} aria-label={t.effacerRecherche} className="flex min-h-11 min-w-11 items-center justify-center text-gris">×</Link>}
        </Form>
        {/* US-26.3 : remise par QR code ou code à 6 chiffres (gardé) ; bon et parrainage : QR code seulement (relecture n°6). */}
        <Link href="/espace/scanner" aria-label={t.scannerLibelle} className="etiquette flex min-h-11 items-center gap-2 bg-noir px-3 text-blanc"><span aria-hidden="true">▣</span>{e.commun.scanner}</Link>
      </div>
    </header>
    <BanniereNouvelle />
    {recherche
      ? <p role="status" className="px-4 pb-2 text-[13px] text-gris lg:px-8">{erreur ? "" : remplir(commandes.length > 1 ? t.resultats : t.resultat, { n: commandes.length, q: texteRecherche })}</p>
      : <nav aria-label={t.etapesLibelle} className="mx-2 flex lg:mx-8">{ORDRE_ETAPES.map(x => <Link key={x} href={lienEtape(x)} aria-current={x === etape ? "page" : undefined} className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 ${x === etape ? "border-b-2 border-noir" : "border-b border-trait text-gris"}`}><span className="whitespace-nowrap text-[9.5px] uppercase tracking-[1.1px]">{t.etapes[x].libelle}</span><span className={`text-[17px] ${x === etape ? "font-medium" : ""}`}>{compteurs[x]}</span></Link>)}</nav>}
    <div className="lg:px-8">
      {erreur ? <p role="alert" className="px-4 py-6">{t.impossible}</p>
        : !boutiqueId ? <p className="px-4 py-6">{e.commun.sansBoutique}</p>
        : <>
          {/* US-28.3 : liste de préparation imprimable. */}
          {!recherche && etape === "a_preparer" && commandes.length > 0 && <div className="flex px-4 py-2.5 lg:justify-end lg:px-0"><Link href="/espace/commandes/preparation" className="etiquette flex min-h-11 flex-1 items-center justify-center gap-2 border border-noir px-4 lg:flex-none"><span aria-hidden="true">☰</span>{remplir(compteurs.a_preparer > 1 ? t.preparationPlusieurs : t.preparationUne, { n: compteurs.a_preparer })}</Link></div>}
          {!recherche && etape === "pretes" && commandes.length > 0 && <p className="border-b border-trait px-4 py-2 text-xs text-gris">{t.remisePretes}</p>}
          <TableauCommandes key={recherche ? `q-${texteRecherche}` : etape} commandes={commandes} etape={recherche ? null : etape} boutique={boutique} maintenant={maintenant} />
          {!recherche && commandes.length >= LIGNES_PAR_ETAPE && <p className="px-4 py-3 text-xs text-gris">{remplir(t.seules, { n: LIGNES_PAR_ETAPE })}</p>}
          {recherche && <p className="px-4 py-3 text-xs text-gris">{t.rienTrouve}</p>}
        </>}
    </div>
  </main>;
  return boutiqueId && !erreur ? <MiseAJourCommandes initial={{ ...compteurs, derniere }} maintenant={maintenant}>{contenu}</MiseAJourCommandes> : contenu;
}

// US-28.1 : affichage de /espace/commandes (étapes, recherche, tableau), séparé de la lecture des données.
import Link from "next/link";
import Form from "next/form";
import type { CommandeRecue } from "@/lib/commandes";
import { ETAPES, LIGNES_PAR_ETAPE, ORDRE_ETAPES, RECHERCHE_MAX, type CompteursEtapes, type EtapeCommande } from "@/lib/tableau-commandes";
import TableauCommandes from "@/components/TableauCommandes";

export type DonneesCommandesRecues = { boutiqueId: string | null; boutique: string; maintenant: number; recherche: boolean; texteRecherche: string; compteurs: CompteursEtapes; etape: EtapeCommande; commandes: CommandeRecue[]; erreur: boolean };

export default function VueCommandesRecues({ boutiqueId, boutique, maintenant, recherche, texteRecherche, compteurs, etape, commandes, erreur }: DonneesCommandesRecues) {
  const lienEtape = (e: EtapeCommande) => `/espace/commandes?etape=${e}`;
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir lg:max-w-[1120px]">
    <header className="flex flex-col gap-3 px-4 pb-3 pt-5 lg:flex-row lg:items-end lg:justify-between lg:px-8">
      <div><p className="etiquette text-gris">Mon espace</p><h1 className="font-titre text-[26px] font-normal lg:text-[30px]">Commandes reçues</h1></div>
      <div className="flex gap-2 lg:w-[520px]">
        <Form action="/espace/commandes" role="search" className="flex min-h-11 min-w-0 flex-1 items-center border border-noir">
          {!recherche && <input type="hidden" name="etape" value={etape} />}
          <label htmlFor="recherche-commande" className="sr-only">N° ou prénom</label>
          <span aria-hidden="true" className="pl-3 text-gris">⌕</span>
          <input id="recherche-commande" name="q" type="search" defaultValue={texteRecherche} maxLength={RECHERCHE_MAX} placeholder="N° ou prénom" autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none" />
          {texteRecherche && <Link href={lienEtape(etape)} aria-label="Effacer la recherche" className="flex min-h-11 min-w-11 items-center justify-center text-gris">×</Link>}
        </Form>
        {/* US-26.3 : remise par QR code ou code à 4 chiffres (gardé). */}
        <Link href="/espace/scanner" aria-label="Scanner un QR code client" className="etiquette flex min-h-11 items-center gap-2 bg-noir px-3 text-blanc"><span aria-hidden="true">▣</span>Scanner</Link>
      </div>
    </header>
    {recherche
      ? <p role="status" className="px-4 pb-2 text-[13px] text-gris lg:px-8">{erreur ? "" : `${commandes.length} résultat${commandes.length > 1 ? "s" : ""} pour « ${texteRecherche} » · toutes les étapes`}</p>
      : <nav aria-label="Étapes" className="mx-2 flex lg:mx-8">{ORDRE_ETAPES.map(e => <Link key={e} href={lienEtape(e)} aria-current={e === etape ? "page" : undefined} className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 ${e === etape ? "border-b-2 border-noir" : "border-b border-trait text-gris"}`}><span className="whitespace-nowrap text-[9.5px] uppercase tracking-[1.1px]">{ETAPES[e].libelle}</span><span className={`text-[17px] ${e === etape ? "font-medium" : ""}`}>{compteurs[e]}</span></Link>)}</nav>}
    <div className="lg:px-8">
      {erreur ? <p role="alert" className="px-4 py-6">Impossible de charger les commandes. Réessayez.</p>
        : !boutiqueId ? <p className="px-4 py-6">Votre compte n&apos;est rattaché à aucune boutique</p>
        : <>
          {/* US-28.3 : liste de préparation imprimable. */}
          {!recherche && etape === "a_preparer" && commandes.length > 0 && <div className="flex px-4 py-2.5 lg:justify-end lg:px-0"><Link href="/espace/commandes/preparation" className="etiquette flex min-h-11 flex-1 items-center justify-center gap-2 border border-noir px-4 lg:flex-none"><span aria-hidden="true">☰</span>Liste de préparation ({compteurs.a_preparer} commande{compteurs.a_preparer > 1 ? "s" : ""})</Link></div>}
          {!recherche && etape === "pretes" && commandes.length > 0 && <p className="border-b border-trait px-4 py-2 text-xs text-gris">Remise : scannez le QR code du client (bouton « Scanner » en haut), ou ouvrez la commande pour « Remis sans QR code ».</p>}
          <TableauCommandes key={recherche ? `q-${texteRecherche}` : etape} commandes={commandes} etape={recherche ? null : etape} boutique={boutique} maintenant={maintenant} />
          {!recherche && commandes.length >= LIGNES_PAR_ETAPE && <p className="px-4 py-3 text-xs text-gris">Seules les {LIGNES_PAR_ETAPE} premières sont affichées : cherchez par n° ou prénom.</p>}
          {recherche && <p className="px-4 py-3 text-xs text-gris">Rien trouvé ? Tapez le numéro de commande (ex. 131) ou le début du prénom.</p>}
        </>}
    </div>
  </main>;
}

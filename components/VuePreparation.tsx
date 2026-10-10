// US-28.3 : liste de préparation, regroupée par article puis taille / contenance ; feuille A4 noir et blanc à l’impression.
import Link from "next/link";
import Isole from "@/components/Isole";
import Prix from "@/components/Prix";
import BoutonImprimer from "@/components/BoutonImprimer";
import { dateLongue, type Preparation } from "@/lib/tableau-commandes";
import { remplir, type Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";

export default function VuePreparation({ boutique, maintenant, preparation, erreur, langue = "fr" }: { boutique: string; maintenant: number; preparation: Preparation | null; erreur: string | null; langue?: Langue }) {
  const n = preparation?.commandes.length ?? 0;
  const e = textesDe(langue).espace, t = e.preparation;
  const pieces = (x: number) => remplir(x > 1 ? t.pieces : t.piece, { n: x });
  return <main className="mx-auto w-full max-w-[390px] bg-blanc px-4 pb-8 pt-5 text-noir lg:max-w-[720px] print:max-w-none print:p-0">
    <style>{"@page { size: A4; margin: 14mm; }"}</style>
    <Link href="/espace/commandes?etape=a_preparer" className="inline-flex min-h-11 items-center text-[13px] underline print:hidden">{t.retour}</Link>
    <header className="flex flex-col gap-1 print:flex-row print:items-baseline print:justify-between">
      <h1 className="font-titre text-[24px] font-normal lg:text-[28px]">{t.titre}</h1>
      <p className="text-[13px] text-gris print:text-noir">{boutique && <><Isole langue={langue}>{boutique}</Isole> · </>}{dateLongue(maintenant, langue, t.dateLongue)}{preparation && n > 0 ? ` · ${remplir(n > 1 ? t.confirmees : t.confirmee, { n })} · ${pieces(preparation.pieces)}` : ""}</p>
    </header>
    {erreur ? <p role="alert" className="py-6">{erreur}</p>
      : !preparation || !n ? <p className="py-8 text-center text-sm text-gris">{t.rien}</p>
      : <>
        <div className="my-3 print:hidden"><BoutonImprimer libelle={t.imprimer} /></div>
        {preparation.articles.map(a => <section key={a.cle} aria-label={a.titre} className="border-t-[1.5px] border-noir py-2.5 [break-inside:avoid]">
          <h2 className="flex justify-between gap-3 text-[15px] font-medium"><span><Isole langue={langue}>{a.titre}</Isole></span><span className="shrink-0">{pieces(a.total)}</span></h2>
          <ul>{a.tailles.map(t => <li key={t.taille} className="flex items-start gap-2.5 border-t border-trait py-1.5">
            <span aria-hidden="true" className="text-lg leading-none">☐</span>
            <div><p className="text-sm"><Isole langue={langue}>{t.taille}</Isole> <strong className="font-medium">× {t.quantite}</strong></p>
              <p className="text-xs text-gris print:text-noir">{t.commandes.map((c, i) => <span key={c.numero}>{i > 0 && " · "}{remplir(e.tableau.numeroCourt, { n: c.numero })} <Isole langue={langue}>{c.prenom}</Isole> ×{c.quantite}</span>)}</p></div>
          </li>)}</ul>
        </section>)}
        <section aria-label={t.parCommande} className="border-t-[1.5px] border-noir pt-2.5 [break-inside:avoid]">
          <h2 className="etiquette text-[10px]">{t.parCommande}</h2>
          <ul className="mt-1 text-[13px] leading-relaxed print:columns-2">{preparation.commandes.map(c => <li key={c.numero}><span aria-hidden="true">☐ </span>{remplir(e.tableau.numeroCourt, { n: c.numero })} · <Isole langue={langue}>{c.prenom}</Isole> · {pieces(c.pieces)} · <Prix montant={c.montant} langue={langue} /></li>)}</ul>
          <p className="mt-2.5 text-xs text-gris print:hidden">{t.uneFois}</p>
        </section>
      </>}
  </main>;
}

// US-28.3 : liste de préparation, regroupée par article puis taille / contenance ; feuille A4 noir et blanc à l’impression.
import Link from "next/link";
import Prix from "@/components/Prix";
import BoutonImprimer from "@/components/BoutonImprimer";
import { dateLongue, type Preparation } from "@/lib/tableau-commandes";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export default function VuePreparation({ boutique, maintenant, preparation, erreur }: { boutique: string; maintenant: number; preparation: Preparation | null; erreur: string | null }) {
  const n = preparation?.commandes.length ?? 0;
  return <main className="mx-auto w-full max-w-[390px] bg-blanc px-4 pb-8 pt-5 text-noir lg:max-w-[720px] print:max-w-none print:p-0">
    <style>{"@page { size: A4; margin: 14mm; }"}</style>
    <Link href="/espace/commandes?etape=a_preparer" className="inline-flex min-h-11 items-center text-[13px] underline print:hidden">← Commandes</Link>
    <header className="flex flex-col gap-1 print:flex-row print:items-baseline print:justify-between">
      <h1 className="font-titre text-[24px] font-normal lg:text-[28px]">Liste de préparation</h1>
      <p className="text-[13px] text-gris print:text-noir">{[boutique, dateLongue(maintenant)].filter(Boolean).join(" · ")}{preparation && n > 0 ? ` · ${pluriel(n, "commande")} confirmée${n > 1 ? "s" : ""} · ${pluriel(preparation.pieces, "pièce")}` : ""}</p>
    </header>
    {erreur ? <p role="alert" className="py-6">{erreur}</p>
      : !preparation || !n ? <p className="py-8 text-center text-sm text-gris">Rien à préparer pour le moment.</p>
      : <>
        <div className="my-3 print:hidden"><BoutonImprimer /></div>
        {preparation.articles.map(a => <section key={a.cle} aria-label={a.titre} className="border-t-[1.5px] border-noir py-2.5 [break-inside:avoid]">
          <h2 className="flex justify-between gap-3 text-[15px] font-medium"><span>{a.titre}</span><span className="shrink-0">{pluriel(a.total, "pièce")}</span></h2>
          <ul>{a.tailles.map(t => <li key={t.taille} className="flex items-start gap-2.5 border-t border-trait py-1.5">
            <span aria-hidden="true" className="text-lg leading-none">☐</span>
            <div><p className="text-sm">{t.taille} <strong className="font-medium">× {t.quantite}</strong></p>
              <p className="text-xs text-gris print:text-noir">{t.commandes.map(c => `N° ${c.numero} ${c.prenom} ×${c.quantite}`).join(" · ")}</p></div>
          </li>)}</ul>
        </section>)}
        <section aria-label="Par commande" className="border-t-[1.5px] border-noir pt-2.5 [break-inside:avoid]">
          <h2 className="etiquette text-[10px]">Par commande</h2>
          <ul className="mt-1 text-[13px] leading-relaxed print:columns-2">{preparation.commandes.map(c => <li key={c.numero}><span aria-hidden="true">☐ </span>N° {c.numero} · {c.prenom} · {pluriel(c.pieces, "pièce")} · <Prix montant={c.montant} /></li>)}</ul>
          <p className="mt-2.5 text-xs text-gris print:hidden">Une fois préparées : cochez-les dans « À préparer » puis « Marquer prêtes ».</p>
        </section>
      </>}
  </main>;
}

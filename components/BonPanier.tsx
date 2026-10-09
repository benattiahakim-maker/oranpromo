"use client";
import { formaterPrix } from "@/lib/prix";
import { aEncaisser, bonApplicable, MONTANT_BON } from "@/lib/bons";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.4 : bon au panier. Case cochée par défaut (choix gardé par le panier) ; absente sous 1 000 DA, avec la raison.
export default function BonPanier({ total, utiliser, onChange, desactive }: { total: number; utiliser: boolean; onChange: (oui: boolean) => void; desactive?: boolean }) {
  const t = useTextes().parrainage;
  const tPanier = useTextes().panier;
  const langue = useLangue();
  if (!bonApplicable(total, true)) return <p className="mb-4 border border-trait p-3 text-sm">{t.sousMinimum}</p>;
  return <div className="mb-4">
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-noir px-3">
      <input type="checkbox" checked={utiliser} disabled={desactive} onChange={e => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-noir" />
      <span className="text-sm">{t.utiliserBon}</span>
    </label>
    {utiliser && <dl className="mt-3 text-sm">
      <div className="flex justify-between py-1"><dt>{tPanier.total}</dt><dd>{formaterPrix(total, langue)}</dd></div>
      <div className="flex justify-between border-b border-noir py-1"><dt>{t.ligneBon}</dt><dd dir="ltr">−{formaterPrix(MONTANT_BON, langue)}</dd></div>
      <div className="flex justify-between pt-2 text-base font-medium"><dt>{t.aPayerBoutique}</dt><dd>{formaterPrix(aEncaisser(total, MONTANT_BON), langue)}</dd></div>
    </dl>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">{t.noteBon}</p>
  </div>;
}

"use client";
import { formaterPrix } from "@/lib/prix";
import { remplir } from "@/lib/langue";
import { aEncaisser, estBonProgramme, MINIMUM_COMMANDE_BON, MONTANT_BON, type BonClient } from "@/lib/bons";
import { libelleUtiliserBon, nomDuBon } from "@/lib/bons-affichage";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.4 : bon au panier. Case cochée par défaut (choix gardé par le panier) ; absente sous le minimum, avec la raison.
// US-33.2 : le bon proposé (le plus gros utilisable, comme utiliser_bon) peut être un bon de bienvenue ou de campagne.
// Sans bon précis (ancien appel) : bon parrainage de 300 DA dès 1 000 DA.
export default function BonPanier({ total, utiliser, onChange, desactive, bon = null, applicable }: {
  total: number; utiliser: boolean; onChange: (oui: boolean) => void; desactive?: boolean; bon?: BonClient | null; applicable?: boolean;
}) {
  const t = useTextes().parrainage;
  const tPanier = useTextes().panier;
  const langue = useLangue();
  const programme = bon !== null && estBonProgramme(bon);
  const montant = bon?.montant ?? MONTANT_BON;
  const peut = applicable ?? total >= (bon?.minimum_achat ?? MINIMUM_COMMANDE_BON);
  if (!peut) return <p className="mb-4 border border-trait p-3 text-sm">{programme && bon
    ? <>{nomDuBon(bon, t, langue)} · {remplir(t.minimumProgramme, { minimum: formaterPrix(bon.minimum_achat ?? 0, langue) })}</>
    : t.sousMinimum}</p>;
  return <div className="mb-4">
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-noir px-3">
      <input type="checkbox" checked={utiliser} disabled={desactive} onChange={e => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-noir" />
      <span className="text-sm">{bon ? libelleUtiliserBon(bon, t, langue) : t.utiliserBon}</span>
    </label>
    {utiliser && <dl className="mt-3 text-sm">
      <div className="flex justify-between py-1"><dt>{tPanier.total}</dt><dd>{formaterPrix(total, langue)}</dd></div>
      <div className="flex justify-between border-b border-noir py-1"><dt>{bon ? nomDuBon(bon, t, langue) : t.ligneBon}</dt><dd dir="ltr">−{formaterPrix(montant, langue)}</dd></div>
      <div className="flex justify-between pt-2 text-base font-medium"><dt>{t.aPayerBoutique}</dt><dd>{formaterPrix(aEncaisser(total, montant), langue)}</dd></div>
    </dl>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">{programme ? t.noteBonProgramme : t.noteBon}</p>
  </div>;
}

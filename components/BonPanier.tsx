"use client";
import { remplir } from "@/lib/langue";
import Prix from "@/components/Prix";
import { formaterPrix } from "@/lib/prix";
import { aEncaisser, estBonProgramme, MINIMUM_COMMANDE_BON, MONTANT_BON, type BonClient, type OptionBon, type RaisonBonPanier } from "@/lib/bons";
import { libelleUtiliserBon, nomDuBon, texteRaisonBon } from "@/lib/bons-affichage";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.4 : bon au panier. Case cochée par défaut (choix gardé par le panier) ; absente sous le minimum, avec la raison.
// US-33.2 : le bon proposé (le plus gros utilisable, comme utiliser_bon) peut être un bon de bienvenue ou de campagne.
// US-33.3 : plusieurs bons : le client choisit (le plus avantageux est proposé), avec la raison de ceux qui ne vont pas.
// Sans bon précis (ancien appel) : bon parrainage de 300 DA dès 1 000 DA.
export default function BonPanier({ total, utiliser, onChange, desactive, bon = null, applicable, raison, options = [], onChoisir }: {
  total: number; utiliser: boolean; onChange: (oui: boolean) => void; desactive?: boolean; bon?: BonClient | null; applicable?: boolean;
  raison?: RaisonBonPanier; options?: OptionBon[]; onChoisir?: (id: string) => void;
}) {
  const t = useTextes().parrainage;
  const tPanier = useTextes().panier;
  const langue = useLangue();
  const programme = bon !== null && estBonProgramme(bon);
  const montant = bon?.montant ?? MONTANT_BON;
  const peut = applicable ?? total >= (bon?.minimum_achat ?? MINIMUM_COMMANDE_BON);
  const choix = options.length > 1 && options.some(o => o.raison === "ok") && <fieldset className="mb-3 border border-trait p-3">
    <legend className="etiquette px-1 text-xs text-gris">{t.mesBons}</legend>
    {options.map(o => <label key={o.bon.id} className={`flex min-h-11 items-start gap-3 py-1 ${o.raison === "ok" ? "cursor-pointer" : "text-gris"}`}>
      <input type="radio" name="bon-panier" checked={bon?.id === o.bon.id} disabled={desactive || o.raison !== "ok"} onChange={() => onChoisir?.(o.bon.id)} className="mt-1 h-5 w-5 shrink-0 accent-noir" />
      <span className="text-sm"><span className="block">{nomDuBon(o.bon, t, langue)} <bdi>(<Prix montant={o.bon.montant} langue={langue} moins />)</bdi></span>
        {o.raison !== "ok" && <span className="block text-xs">{texteRaisonBon(o.bon, o.raison, t, langue)}</span>}</span>
    </label>)}
  </fieldset>;
  if (!peut) {
    const texte = bon && (programme || (raison && raison !== "minimum")) ? `${nomDuBon(bon, t, langue)} · ${texteRaisonBon(bon, raison ?? "minimum", t, langue) ?? ""}` : t.sousMinimum;
    return <p className="mb-4 border border-trait p-3 text-sm">{texte}</p>;
  }
  return <div className="mb-4">
    {choix}
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-noir px-3">
      <input type="checkbox" checked={utiliser} disabled={desactive} onChange={e => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-noir" />
      <span className="text-sm">{bon ? libelleUtiliserBon(bon, t, langue) : remplir(t.utiliserBon, { montant: formaterPrix(MONTANT_BON, langue) })}</span>
    </label>
    {utiliser && <dl className="mt-3 text-sm">
      <div className="flex justify-between py-1"><dt>{tPanier.total}</dt><dd><Prix montant={total} langue={langue} /></dd></div>
      <div className="flex justify-between border-b border-noir py-1"><dt>{bon ? nomDuBon(bon, t, langue) : t.ligneBon}</dt><dd><Prix montant={montant} langue={langue} moins /></dd></div>
      <div className="flex justify-between pt-2 text-base font-medium"><dt>{t.aPayerBoutique}</dt><dd><Prix montant={aEncaisser(total, montant)} langue={langue} /></dd></div>
    </dl>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">{programme ? t.noteBonProgramme : t.noteBon}</p>
  </div>;
}

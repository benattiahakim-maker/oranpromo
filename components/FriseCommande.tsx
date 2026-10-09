import { etapesFrise, formaterDateHeure, type EvenementSuivi, type StatutCommande } from "@/lib/commandes";

// US-20.2 : frise du suivi d’une commande (changements enregistrés, puis étapes à venir grisées).
export default function FriseCommande({ statut, suivi }: { statut: StatutCommande; suivi: EvenementSuivi[] }) {
  const etapes = etapesFrise(statut, suivi);
  return <ol aria-label="Suivi de la commande" className="m-0 list-none p-0">{etapes.map((etape, i) => <li key={`${etape.statut}-${i}`} className="relative flex gap-3.5 pb-4">
    {i < etapes.length - 1 && <span aria-hidden className="absolute left-[5px] top-3.5 -bottom-0.5 w-px bg-trait" />}
    <span aria-hidden className={`mt-[3px] h-[11px] w-[11px] shrink-0 border border-noir ${etape.faite ? "bg-noir" : "bg-blanc"}`} />
    <div className="flex flex-col gap-0.5">
      <span className={`etiquette ${etape.faite ? "" : "text-gris"}`}>{etape.libelle}{etape.faite ? "" : " (à venir)"}</span>
      {etape.date && <span className="text-xs text-gris">{formaterDateHeure(etape.date)}</span>}
      {etape.note && <span className="text-[13px] font-light">« {etape.note} »</span>}
    </div>
  </li>)}</ol>;
}

"use client";
import Link from "next/link";
import { CHEMINS, VERSION_PROVISOIRE } from "@/lib/juridique";
import { DOCUMENTS_CLIENT } from "@/lib/acceptations";
import { useTextes } from "./FournisseurTextes";

// US-34.2 : case « J'accepte les conditions… » (jamais cochée d'office), liens vers les deux textes (nouvel onglet)
// et, tant que l'avocat n'a pas relu, la mention « version provisoire ». Utilisée à l'inscription et au panier.
export default function CaseConditions({ coche, onChange, desactive, invalide }: { coche: boolean; onChange: (oui: boolean) => void; desactive?: boolean; invalide?: boolean }) {
  const t = useTextes().juridique;
  return <div className="flex flex-col gap-2">
    <label className="flex cursor-pointer items-start gap-3 border border-noir p-3">
      <input type="checkbox" checked={coche} disabled={desactive} aria-invalid={invalide || undefined} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-noir" />
      <span className="text-sm leading-[1.6]">{t.caseInscription}</span>
    </label>
    <p className="m-0 flex flex-wrap gap-x-4 text-[13px]">
      {DOCUMENTS_CLIENT.map(document => <Link key={document} href={CHEMINS[document]} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center underline">{t.titres[document]}</Link>)}
    </p>
    {VERSION_PROVISOIRE && <p className="m-0 text-xs text-gris">{t.provisoire}</p>}
  </div>;
}

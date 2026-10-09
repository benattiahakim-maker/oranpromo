"use client";
import Link from "next/link";
import { remplir } from "@/lib/langue";
import { compteursParrainage, type MonParrainage as DonneesParrainage } from "@/lib/parrainage";
import { formaterJourMois } from "@/lib/bons";
import PartageParrainage, { type LienInvitation } from "./PartageParrainage";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.3 : bloc « Mon parrainage » de /compte. Prénom + initiale des filleuls récompensés seulement, jamais de numéro.
export default function MonParrainage({ parrainage, invitation }: { parrainage: DonneesParrainage; invitation: LienInvitation | null }) {
  const t = useTextes().parrainage;
  const langue = useLangue();
  const { valides, enAttente } = compteursParrainage(parrainage);
  return <section aria-labelledby="titre-mon-parrainage" className="mt-8 border-t border-trait pt-6">
    <h2 id="titre-mon-parrainage" className="etiquette text-xs text-gris">{t.monParrainage}</h2>
    <div className="mt-3 grid grid-cols-2 border border-trait">
      <p className="p-3"><span className="block font-titre text-[32px] leading-none">{valides}</span><span className="mt-1 block text-xs leading-[1.5]">{valides === 1 ? t.valideUn : t.valides}</span></p>
      <p className="border-s border-trait p-3"><span className="block font-titre text-[32px] leading-none">{enAttente}</span><span className="mt-1 block text-xs leading-[1.5]">{t.enAttente}</span></p>
    </div>
    {parrainage.plafond_atteint && <p role="status" className="mt-3 border border-noir p-3 text-sm">{t.plafond}</p>}
    {parrainage.filleuls.length > 0
      ? <ul aria-label={t.monParrainage} className="mt-2">{parrainage.filleuls.map((f, i) =>
        <li key={i} className="flex justify-between gap-3 border-b border-trait py-3 text-sm"><span><bdi>{remplir(t.filleul, { prenom: f.prenom, date: f.valide_le ? formaterJourMois(f.valide_le, langue) : "" })}</bdi></span><span className="text-end">{f.statut === "en_file" ? t.bonEnFile : t.bonFilleul}</span></li>)}</ul>
      : <p className="mt-3 text-sm text-gris">{t.aucunFilleul}</p>}
    <p className="mt-2 text-xs text-gris">{t.discretion}</p>
    {invitation && <div className="mt-4"><PartageParrainage invitation={invitation} cadre={false} /></div>}
    <Link href="/parrainage" className="mt-1 flex min-h-11 items-center justify-center text-sm text-gris underline">{t.commentMarche}</Link>
  </section>;
}

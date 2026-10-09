"use client";
import { remplir } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import { etatBon, type BonClient } from "@/lib/bons";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.3 : « Mes bons » dans /compte : disponible (jusqu'au …), réservé (commande n° …), utilisé (le … chez …), expiré, en file.
export default function MesBons({ bons, maintenant }: { bons: BonClient[]; maintenant?: Date }) {
  const t = useTextes().parrainage;
  const langue = useLangue();
  return <section aria-labelledby="titre-mes-bons" className="mt-8 border-t border-trait pt-6">
    <h2 id="titre-mes-bons" className="etiquette text-xs text-gris">{t.mesBons}</h2>
    <ul className="mt-1">{bons.map(bon => {
      const etat = etatBon(bon, langue, maintenant);
      return <li key={bon.id} className={`flex justify-between gap-3 border-b border-trait py-3 ${etat.actif ? "" : "text-gris"}`}>
        <span><span className="block text-[15px]">{t.nomBon}</span><span className="block text-xs text-gris"><bdi>{remplir(t[etat.cle], etat.valeurs)}</bdi></span></span>
        <span className={`whitespace-nowrap ${etat.actif ? "font-medium" : ""}`}>{formaterPrix(bon.montant, langue)}</span>
      </li>;
    })}</ul>
    <p className="mt-3 text-xs leading-[1.6] text-gris">{t.aideBons}</p>
  </section>;
}

"use client";
import { remplir } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import { etatBon, type BonClient } from "@/lib/bons";
import { aideMesBons, detailBonProgramme, detailInscription, nomDuBon } from "@/lib/bons-affichage";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-27.3 : « Mes bons » dans /compte : disponible (jusqu'au …), réservé (commande n° …), utilisé (le … chez …), expiré, en file.
// US-33.2 : nom du bon (« Bon de bienvenue ») et, pour un bon de programme disponible, « 300 DA dès 2 000 DA d'achat · jusqu'au 9/11 ».
// US-31.4 : bon de l'inscription en boutique pas encore utilisable dans la boutique d'origine : « Chez … : dès le 11/10. Ailleurs : tout de suite. »
export default function MesBons({ bons, maintenant }: { bons: BonClient[]; maintenant?: Date }) {
  const t = useTextes().parrainage;
  const langue = useLangue();
  // Bon par bon (disponible, réservé, en file) : montant réel et qui paie (BleDeal, ou BleDeal et la boutique d'inscription).
  const aide = aideMesBons(bons.filter(b => etatBon(b, langue, maintenant).actif), t, langue);
  return <section aria-labelledby="titre-mes-bons" className="mt-8 border-t border-trait pt-6">
    <h2 id="titre-mes-bons" className="etiquette text-xs text-gris">{t.mesBons}</h2>
    <ul className="mt-1">{bons.map(bon => {
      const etat = etatBon(bon, langue, maintenant);
      const detail = etat.cle === "disponible" ? detailBonProgramme(bon, t, langue) : null;
      const inscription = etat.cle === "disponible" ? detailInscription(bon, t, maintenant) : null;
      return <li key={bon.id} className={`flex justify-between gap-3 border-b border-trait py-3 ${etat.actif ? "" : "text-gris"}`}>
        <span><span className="block text-[15px]">{nomDuBon(bon, t, langue)}</span><span className="block text-xs text-gris"><bdi>{detail ?? remplir(t[etat.cle], etat.valeurs)}</bdi></span>{inscription && <span dir="auto" className="block text-xs text-gris">{inscription}</span>}</span>
        <span className={`whitespace-nowrap ${etat.actif ? "font-medium" : ""}`}>{formaterPrix(bon.montant, langue)}</span>
      </li>;
    })}</ul>
    {aide && <p className="mt-3 text-xs leading-[1.6] text-gris">{aide}</p>}
  </section>;
}

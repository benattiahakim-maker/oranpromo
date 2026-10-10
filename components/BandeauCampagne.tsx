import Link from "next/link";
import { remplir, type Langue } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import { formaterJourMoisNumerique } from "@/lib/bons";
import type { CampagneOuverte } from "@/lib/campagnes";
import type { fr } from "@/lib/textes/fr";

/** « Aïd : 500 DA offerts dès 4 000 DA d'achat avec le code AID2026, jusqu'au 5/6. » (texte n° 14). */
export function texteBandeau(c: CampagneOuverte, t: typeof fr.parrainage, langue: Langue): string {
  const valeurs = { nom: langue === "ar" ? c.nom_ar : c.nom_fr, montant: formaterPrix(c.montant, langue), minimum: formaterPrix(c.minimum_achat, langue), code: c.code };
  return c.fin ? remplir(t.bandeau, { ...valeurs, date: formaterJourMoisNumerique(c.fin) }) : remplir(t.bandeauSansDate, valeurs);
}

// US-33.3 : bandeau de l'accueil d'une ville pendant une campagne, avec le lien vers ses conditions (loi 18-05, art. 30).
export default function BandeauCampagne({ campagnes, t, langue }: { campagnes: CampagneOuverte[]; t: typeof fr.parrainage; langue: Langue }) {
  if (campagnes.length === 0) return null;
  return <section aria-label={t.conditionsCampagne} className="border-b border-noir bg-blanc px-5 py-3 text-sm leading-[1.6]">
    {campagnes.map(c => <p key={c.code}><bdi>{texteBandeau(c, t, langue)}</bdi>{" "}
      <Link href={`/campagne/${c.code}`} className="underline">{t.conditionsCampagne}</Link></p>)}
  </section>;
}

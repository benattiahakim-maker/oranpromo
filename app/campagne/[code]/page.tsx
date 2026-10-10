import type { Metadata } from "next";
import EntetePublic from "@/components/EntetePublic";
import { creerClientServeur } from "@/lib/supabase/server";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import { formaterJourMoisNumerique } from "@/lib/bons";
import { lireCampagnesOuvertes, normaliserCodeBon } from "@/lib/campagnes";
import { getVillesOuvertes } from "@/lib/ville-serveur";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conditions de la campagne", robots: { index: false, follow: true } };

// US-33.3 : conditions d'une campagne ouverte (loi 18-05, art. 30 : conditions claires et accessibles) : montant,
// minimum, univers, villes, dates, une fois par numéro, QR code obligatoire, règle d'annulation.
export default async function ConditionsCampagne({ params }: { params: Promise<{ code: string }> }) {
  const code = normaliserCodeBon(decodeURIComponent((await params).code));
  const [textes, langue] = await Promise.all([getTextes(), getLangue()]);
  const t = textes.parrainage;
  const campagnes = code ? await lireCampagnesOuvertes(await creerClientServeur()).catch(() => []) : [];
  const c = campagnes.find(x => x.code === code);
  const villes = c && c.villes.length > 0 ? await getVillesOuvertes().catch(() => []) : [];
  const nomVille = (v: string) => { const ville = villes.find(x => x.code === v); return ville ? (langue === "ar" ? ville.nom_ar ?? ville.nom : ville.nom) : v; };
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    {!c ? <p role="status" className="pt-8 text-center text-sm">{t.conditionsAucune}</p> : <>
      <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">{t.conditionsCampagne}</p>
        <h1 className="font-titre text-[28px] font-normal">{remplir(t.conditionsTitre, { nom: langue === "ar" ? c.nom_ar : c.nom_fr })}</h1></header>
      <ul className="mt-4 text-sm leading-[1.8]">
        <li className="border-b border-trait py-2" dir="auto">{remplir(t.conditionsCode, { code: c.code })}</li>
        <li className="border-b border-trait py-2">{remplir(t.conditionsMontant, { montant: formaterPrix(c.montant, langue), minimum: formaterPrix(c.minimum_achat, langue) })}</li>
        {c.univers && <li className="border-b border-trait py-2">{remplir(t.raisonUnivers, { univers: t.universBon[c.univers] })}</li>}
        <li className="border-b border-trait py-2">{c.villes.length > 0 ? remplir(t.conditionsVilles, { villes: c.villes.map(nomVille).join(", ") }) : t.conditionsToutesVilles}</li>
        <li className="border-b border-trait py-2">{c.fin ? remplir(t.conditionsDates, { debut: formaterJourMoisNumerique(c.debut), fin: formaterJourMoisNumerique(c.fin) }) : remplir(t.conditionsDepuis, { debut: formaterJourMoisNumerique(c.debut) })}</li>
        <li className="border-b border-trait py-2">{t.conditionsNumero}</li>
        <li className="border-b border-trait py-2">{t.conditionsQr}</li>
        <li className="py-2">{t.noteBonProgramme}</li>
      </ul>
    </>}
  </main></>;
}

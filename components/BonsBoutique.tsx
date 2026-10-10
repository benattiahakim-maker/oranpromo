import type { ReactNode } from "react";
import { casReleveBoutique, dateHeureAlger, etatReleveBoutique, ETATS_LIGNE, montantDA, resumeReleve, type ReleveBoutique } from "@/lib/parrainage-admin";
import { moisAlger, nomMois } from "@/lib/bons";
import { aRembourserLigne, origineLigne, textePlafond, totauxParOrigine, type PlafondBoutique } from "@/lib/bons-boutique";
import type { Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import Prix from "./Prix";
import Isole from "./Isole";
import { remplirAvec } from "./Numero";

// US-27.5 : bloc « Bons à rembourser » de /espace (relevés de la boutique seulement, lus sous RLS).
// US-31.4 : montants remboursés sans la part de la boutique (bon d'inscription utilisé chez elle).
// US-33.4 : totaux du mois par origine (« Aïd 2026 · 14 bons · 7 000 DA », « Bienvenue », « Parrainage ») et plafond des campagnes ouvertes.
// US-35 : en arabe (textes `espace.bons`, à valider) ; prix par <Prix> (« دج »), numéros et dates isolés de gauche à droite.
// En français, le rendu est le même qu'avant (mêmes fonctions de lib/).
export default function BonsBoutique({ releves, noms = new Map(), plafonds = [], maintenant = new Date(), langue = "fr" }: {
  releves: ReleveBoutique[]; noms?: Map<string, string>; plafonds?: PlafondBoutique[]; maintenant?: Date; langue?: Langue;
}) {
  if (!releves.length && !plafonds.length) return null;
  const t = textesDe(langue).espace.bons, ar = langue === "ar";
  const courant = releves.find(r => r.mois === moisAlger(maintenant));
  const passes = releves.filter(r => r !== courant);
  const origines = courant ? totauxParOrigine(courant.lignes, noms, t) : [];
  const ltr = (texte: string | number) => <bdi dir="ltr">{texte}</bdi>;
  const montant = (n: number): ReactNode => ar ? <Prix montant={n} langue="ar" /> : montantDA(n);
  const bons = (n: number) => ar ? remplirAvec(n > 1 ? t.plusieurs : t.un, { n: ltr(n) }) : `${n} bon${n > 1 ? "s" : ""}`;
  const resume = (r: { nombre: number; montant: number }): ReactNode => ar ? remplirAvec(t.resume, { bons: bons(r.nombre), montant: montant(r.montant) }) : resumeReleve(r);
  const plafond = (p: PlafondBoutique): ReactNode => ar
    ? remplirAvec(t.plafond, { nom: <Isole langue={langue}>{p.nom_ar || p.nom_fr}</Isole>, compte: ltr(`${p.utilises} / ${p.plafond}`) })
    : textePlafond(p);
  const etat = (r: ReleveBoutique): ReactNode => {
    if (!ar) return etatReleveBoutique(r);
    const { cas, date } = casReleveBoutique(r);
    return remplirAvec(t[cas], { mois: nomMois(r.mois, "ar"), montant: montant(r.montant), date: ltr(date), reference: ltr(r.reference_paiement ?? "") });
  };
  const etatsLigne: Record<string, string> = ar ? { a_rembourser: t.etatARembourser, de_cote: t.etatDeCote, refuse: t.etatRefuse } : ETATS_LIGNE;
  const ligne = (l: ReleveBoutique["lignes"][number]): ReactNode => ar
    ? remplirAvec(t.ligne, { numero: ltr(l.numero_commande), origine: <Isole langue={langue}>{origineLigne(l, noms, t)}</Isole>, date: ltr(dateHeureAlger(l.remise_le)) })
    : `N° ${l.numero_commande} · ${origineLigne(l, noms)} · ${dateHeureAlger(l.remise_le)}`;
  return <section aria-labelledby="bons-boutique" className="mt-6 border border-trait p-4">
    <h2 id="bons-boutique" className="etiquette">{t.titre}</h2>
    <p className="mt-2 text-sm">{ar ? remplirAvec(t.ceMois, { resume: resume(courant ?? { nombre: 0, montant: 0 }) }) : `Ce mois-ci : ${courant ? resumeReleve(courant) : "0 bon · 0 DA"}`}</p>
    {origines.length > 0 && <ul aria-label={t.parOrigine} className="mt-1">{origines.map(o =>
      <li key={o.origine} className="flex justify-between gap-3 py-1 text-sm"><span><Isole langue={langue}>{o.origine}</Isole> · {bons(o.nombre)}</span><span className="shrink-0">{montant(o.montant)}</span></li>)}</ul>}
    {plafonds.map(p => <p key={p.nom_fr} className="mt-2 text-sm">{plafond(p)}</p>)}
    {passes.length > 0 && <ul className="mt-2">{passes.map(r => <li key={r.id} className="border-t border-trait py-2 text-sm">{etat(r)}</li>)}</ul>}
    {releves.some(r => r.lignes.length) && <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm underline">{t.detail}</summary>
      <ul>{releves.flatMap(r => r.lignes).map(l => <li key={l.id} className="flex justify-between gap-3 border-t border-trait py-2 text-xs text-gris"><span>{ligne(l)}</span><span className="shrink-0 text-noir">{l.statut === "a_rembourser" ? montant(aRembourserLigne(l)) : etatsLigne[l.statut] ?? l.statut}</span></li>)}</ul>
    </details>}
    {releves.some(r => r.lignes.some(l => (l.part_boutique ?? 0) > 0)) && <p className="mt-2 text-xs leading-[1.6] text-gris">{t.partBoutique}</p>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">{t.explication}</p>
  </section>;
}

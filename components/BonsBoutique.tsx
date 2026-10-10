import { dateHeureAlger, etatReleveBoutique, ETATS_LIGNE, montantDA, resumeReleve, type ReleveBoutique } from "@/lib/parrainage-admin";
import { moisAlger } from "@/lib/bons";
import { aRembourserLigne, origineLigne, textePlafond, totauxParOrigine, type PlafondBoutique } from "@/lib/bons-boutique";

// US-27.5 : bloc « Bons à rembourser » de /espace (relevés de la boutique seulement, lus sous RLS).
// US-31.4 : montants remboursés sans la part de la boutique (bon d'inscription utilisé chez elle).
// US-33.4 : totaux du mois par origine (« Aïd 2026 · 14 bons · 7 000 DA », « Bienvenue », « Parrainage ») et plafond des campagnes ouvertes.
export default function BonsBoutique({ releves, noms = new Map(), plafonds = [], maintenant = new Date() }: {
  releves: ReleveBoutique[]; noms?: Map<string, string>; plafonds?: PlafondBoutique[]; maintenant?: Date;
}) {
  if (!releves.length && !plafonds.length) return null;
  const courant = releves.find(r => r.mois === moisAlger(maintenant));
  const passes = releves.filter(r => r !== courant);
  const origines = courant ? totauxParOrigine(courant.lignes, noms) : [];
  return <section aria-labelledby="bons-boutique" className="mt-6 border border-trait p-4">
    <h2 id="bons-boutique" className="etiquette">Bons à rembourser</h2>
    <p className="mt-2 text-sm">Ce mois-ci : {courant ? resumeReleve(courant) : "0 bon · 0 DA"}</p>
    {origines.length > 0 && <ul aria-label="Par origine" className="mt-1">{origines.map(o =>
      <li key={o.origine} className="flex justify-between gap-3 py-1 text-sm"><span>{o.origine} · {o.nombre} bon{o.nombre > 1 ? "s" : ""}</span><span className="shrink-0">{montantDA(o.montant)}</span></li>)}</ul>}
    {plafonds.map(p => <p key={p.nom_fr} className="mt-2 text-sm">{textePlafond(p)}</p>)}
    {passes.length > 0 && <ul className="mt-2">{passes.map(r => <li key={r.id} className="border-t border-trait py-2 text-sm">{etatReleveBoutique(r)}</li>)}</ul>}
    {releves.some(r => r.lignes.length) && <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm underline">Détail des commandes</summary>
      <ul>{releves.flatMap(r => r.lignes).map(l => <li key={l.id} className="flex justify-between gap-3 border-t border-trait py-2 text-xs text-gris"><span>N° {l.numero_commande} · {origineLigne(l, noms)} · {dateHeureAlger(l.remise_le)}</span><span className="shrink-0 text-noir">{l.statut === "a_rembourser" ? montantDA(aRembourserLigne(l)) : ETATS_LIGNE[l.statut] ?? l.statut}</span></li>)}</ul>
    </details>}
    {releves.some(r => r.lignes.some(l => (l.part_boutique ?? 0) > 0)) && <p className="mt-2 text-xs leading-[1.6] text-gris">Bon de bienvenue d’un client inscrit chez vous : vous déduisez tout le bon en caisse et BleDeal vous rembourse le bon moins votre part.</p>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">BleDeal vous rembourse chaque mois les bons (parrainage, bienvenue, campagnes) déduits sur des commandes remises par QR code (relevé clôturé le 1er, paiement avant le 10). Par code à 6 chiffres, le bon ne s’applique pas.</p>
  </section>;
}

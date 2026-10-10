import { dateHeureAlger, etatReleveBoutique, ETATS_LIGNE, montantDA, resumeReleve, type ReleveBoutique } from "@/lib/parrainage-admin";
import { moisAlger } from "@/lib/bons";

// US-27.5 : bloc « Bons parrainage à rembourser » de /espace (relevés de la boutique seulement, lus sous RLS).
export default function BonsBoutique({ releves, maintenant = new Date() }: { releves: ReleveBoutique[]; maintenant?: Date }) {
  if (!releves.length) return null;
  const courant = releves.find(r => r.mois === moisAlger(maintenant));
  const passes = releves.filter(r => r !== courant);
  return <section aria-labelledby="bons-boutique" className="mt-6 border border-trait p-4">
    <h2 id="bons-boutique" className="etiquette">Bons parrainage à rembourser</h2>
    <p className="mt-2 text-sm">Ce mois-ci : {courant ? resumeReleve(courant) : "0 bon · 0 DA"}</p>
    {passes.length > 0 && <ul className="mt-2">{passes.map(r => <li key={r.id} className="border-t border-trait py-2 text-sm">{etatReleveBoutique(r)}</li>)}</ul>}
    {releves.some(r => r.lignes.length) && <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm underline">Détail des commandes</summary>
      <ul>{releves.flatMap(r => r.lignes).map(l => <li key={l.id} className="flex justify-between gap-3 border-t border-trait py-2 text-xs text-gris"><span>N° {l.numero_commande} · {dateHeureAlger(l.remise_le)}</span><span className="shrink-0 text-noir">{l.statut === "a_rembourser" ? montantDA(l.montant) : ETATS_LIGNE[l.statut] ?? l.statut}</span></li>)}</ul>
    </details>}
    <p className="mt-2 text-xs leading-[1.6] text-gris">BleDeal vous rembourse chaque mois les bons de 300 DA déduits sur des commandes remises par QR code (relevé clôturé le 1er, paiement avant le 10). Par code à 4 chiffres, le bon ne s’applique pas.</p>
  </section>;
}

"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActionMotif from "@/components/ActionMotif";
import { deciderLigneDeCote, marquerRelevePaye, mettreLigneDeCote } from "@/app/admin/remboursements/actions";
import { dateHeureAlger, ETATS_LIGNE, ETATS_RELEVE, libelleMois, montantDA, parametreMois, resumeReleve, signalRemiseRapide, signauxReleve, type LigneReleveAdmin, type ReleveAdmin } from "@/lib/parrainage-admin";

// US-27.5 : relevés mensuels des bons par boutique, détail, export, « Mettre de côté », « Marquer comme payé ».
const MODES: Record<string, string> = { qr: "QR code", code: "code" };

export default function RelevesAdmin({ mois, moisPossibles, releves, deCote, aujourdhui }: { mois: string; moisPossibles: string[]; releves: ReleveAdmin[]; deCote: (LigneReleveAdmin & { boutique: { nom: string } | null })[]; aujourdhui: string }) {
  const router = useRouter();
  const total = releves.reduce((s, r) => s + r.montant, 0);
  const nombre = releves.reduce((s, r) => s + r.nombre, 0);
  return <>
    <div className="mt-6 flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col text-xs text-gris">Mois<select value={mois} onChange={e => router.push(`/admin/remboursements?mois=${parametreMois(e.target.value)}`)} className="mt-1 min-h-11 w-full min-w-0 border border-trait bg-blanc px-2 text-sm text-noir">{moisPossibles.map(m => <option key={m} value={m}>{libelleMois(m)}</option>)}</select></label>
      <a href={`/admin/remboursements/export?mois=${parametreMois(mois)}`} className="etiquette inline-flex min-h-11 shrink-0 items-center border border-noir px-3">Exporter CSV</a>
    </div>
    <p className="mt-4 text-sm">{libelleMois(mois)} : {resumeReleve({ nombre, montant: total })} à rembourser · {releves.length} boutique{releves.length > 1 ? "s" : ""}</p>
    <section aria-labelledby="releves" className="mt-4">
      <h2 id="releves" className="etiquette">Relevés par boutique</h2>
      {releves.length ? <ul>{releves.map(r => <li key={r.id}><Releve releve={r} aujourdhui={aujourdhui} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun bon utilisé ce mois-ci.</p>}
    </section>
    <section aria-labelledby="de-cote" className="mt-6">
      <h2 id="de-cote" className="etiquette">Lignes mises de côté ({deCote.length})</h2>
      {deCote.length ? <ul>{deCote.map(l => <li key={l.id} className="border-b border-trait py-3"><p className="text-sm">N° {l.numero_commande} · {l.boutique?.nom ?? ""} · {montantDA(l.montant)}</p><p className="text-xs text-gris">{l.libelle_origine ? `${l.libelle_origine} · ` : ""}{dateHeureAlger(l.remise_le)} · {l.client}{l.motif ? ` · motif : ${l.motif}` : ""}</p>
        <div className="flex flex-wrap gap-x-2"><ActionMotif libelle="Rembourser" confirmer="Rembourser" etiquette={`Rembourser la ligne de la commande n° ${l.numero_commande}`} aide="La ligne revient sur le relevé en cours de la boutique." action={m => deciderLigneDeCote(l.id, "rembourser", m)} /><ActionMotif libelle="Refuser" confirmer="Refuser" etiquette={`Refuser la ligne de la commande n° ${l.numero_commande}`} aide="La ligne ne sera pas remboursée ; le motif est gardé." action={m => deciderLigneDeCote(l.id, "refuser", m)} /></div></li>)}</ul>
        : <p className="py-3 text-sm text-gris">Aucune ligne en attente de décision.</p>}
    </section>
    <p className="mt-6 text-xs leading-[1.6] text-gris">Le relevé du mois est « en cours » ; le 1er il passe « à payer ». Payez chaque boutique hors du site (CCP, BaridiMob, virement) avant le 10, puis « Marquer comme payé » avec la référence : le relevé n’est plus modifiable. Les coordonnées de paiement des boutiques ne sont pas sur le site.</p>
  </>;
}

function Releve({ releve: r, aujourdhui }: { releve: ReleveAdmin; aujourdhui: string }) {
  const signaux = signauxReleve(r);
  return <div className="border-b border-trait py-3.5">
    <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm">{r.boutique?.nom ?? "Boutique"}</span><span className="etiquette shrink-0 whitespace-nowrap">{ETATS_RELEVE[r.statut] ?? r.statut}</span></div>
    <p className="text-sm font-medium">{resumeReleve(r)}</p>
    {r.statut === "paye" && r.paye_le && <p className="text-xs text-gris">Payé le {r.paye_le.slice(8, 10)}/{r.paye_le.slice(5, 7)}/{r.paye_le.slice(0, 4)} · réf. {r.reference_paiement}</p>}
    {r.boutique && !r.boutique.bons_acceptes && <p className="text-xs text-gris">Boutique retirée des bons</p>}
    {signaux.length > 0 && <ul className="mt-2 border-l-2 border-noir pl-2">{signaux.map(s => <li key={s} className="text-xs font-medium">Signal : {s}</li>)}</ul>}
    <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm underline">Détail ({r.lignes.length})</summary>
      <ul>{r.lignes.map(l => <li key={l.id} className="border-t border-trait py-2.5">
        <div className="flex justify-between gap-3 text-sm"><span>N° {l.numero_commande} · {l.client}</span><span className="shrink-0">{l.statut === "a_rembourser" ? montantDA(l.montant) : ETATS_LIGNE[l.statut] ?? l.statut}</span></div>
        <p className="text-xs text-gris">{l.libelle_origine ? `${l.libelle_origine} · ` : ""}{dateHeureAlger(l.remise_le)} · {MODES[l.mode_remise] ?? l.mode_remise} · commande {montantDA(l.total_commande)}{l.motif ? ` · motif : ${l.motif}` : ""}</p>
        {signalRemiseRapide(l.commande) && <p className="text-xs font-medium">Signal : {signalRemiseRapide(l.commande)}</p>}
        {l.statut === "a_rembourser" && r.statut !== "paye" && <ActionMotif libelle="Mettre de côté" confirmer="Mettre de côté" etiquette={`Mettre de côté la commande n° ${l.numero_commande}`} aide="La ligne sort du relevé à payer et attend une décision." action={m => mettreLigneDeCote(l.id, m)} />}
      </li>)}</ul>
      <a href={`/admin/remboursements/export?mois=${parametreMois(r.mois)}&boutique=${r.boutique?.id ?? ""}`} className="mt-2 inline-flex min-h-11 items-center text-sm underline">Exporter CSV de cette boutique</a>
    </details>
    {r.statut === "a_payer" && <Payer releve={r} aujourdhui={aujourdhui} />}
  </div>;
}

function Payer({ releve: r, aujourdhui }: { releve: ReleveAdmin; aujourdhui: string }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(aujourdhui);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function payer() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const res = await marquerRelevePaye(r.id, reference, date); setMessage(res.message); if (res.succes) { setOuvert(false); router.refresh(); } else setConfirmation(false); }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (!ouvert) return <div className="mt-2"><button type="button" onClick={() => setOuvert(true)} aria-label={`Marquer comme payé le relevé de ${r.boutique?.nom ?? "la boutique"}`} className="etiquette min-h-11 w-full bg-noir px-3 text-blanc">Marquer comme payé</button>{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
  return <div className="mt-2 border border-trait p-3">
    <label htmlFor={`${id}-ref`} className="text-xs text-gris">Référence du paiement (obligatoire)</label>
    <input id={`${id}-ref`} value={reference} maxLength={60} onChange={e => { setReference(e.target.value); setConfirmation(false); }} className="mt-1 min-h-11 w-full border border-trait px-3 text-sm" />
    <label htmlFor={`${id}-date`} className="mt-2 block text-xs text-gris">Date du paiement</label>
    <input id={`${id}-date`} type="date" value={date} max={aujourdhui} onChange={e => { setDate(e.target.value); setConfirmation(false); }} className="mt-1 min-h-11 w-full border border-trait px-3 text-sm" />
    {confirmation && <p className="mt-2 text-sm font-medium">Confirmer le paiement de {montantDA(r.montant)} à {r.boutique?.nom ?? "la boutique"} ? Le relevé ne sera plus modifiable.</p>}
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={enCours} onClick={() => (confirmation ? void payer() : setConfirmation(true))} className="etiquette min-h-11 flex-1 bg-noir px-3 text-blanc">{confirmation ? "Confirmer" : "Marquer comme payé"}</button>
      <button type="button" disabled={enCours} onClick={() => { setOuvert(false); setConfirmation(false); }} className="etiquette min-h-11 border border-trait px-3">Retour</button>
    </div>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}

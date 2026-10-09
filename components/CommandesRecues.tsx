"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changerStatutCommandeBoutique } from "@/app/espace/commandes/actions";
import { ACTION_BOUTIQUE, annulableParBoutique, formaterDateHeure, libelleMotif, MOTIFS_ANNULATION, MOTIFS_BOUTIQUE, NOTE_SUIVI_MAX, quantiteTotale, STATUTS_COMMANDE, type CommandeRecue, type MotifBoutique, type StatutCommande } from "@/lib/commandes";
import { telephoneLisible } from "@/lib/clients";
import { formaterPrix } from "@/lib/prix";
import { lienContactClient } from "@/lib/whatsapp";

// US-20.3 : commandes reçues par la boutique, avec les boutons de changement de statut.
export default function CommandesRecues({ commandes, boutique }: { commandes: CommandeRecue[]; boutique: string }) {
  if (!commandes.length) return <p className="py-8 text-center text-sm text-gris">Aucune commande ici pour le moment.</p>;
  return <ul>{commandes.map(c => <li key={c.id}><CarteCommande commande={c} boutique={boutique} /></li>)}</ul>;
}

function CarteCommande({ commande, boutique }: { commande: CommandeRecue; boutique: string }) {
  const router = useRouter();
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState<MotifBoutique | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [stockACorriger, setStockACorriger] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const action = ACTION_BOUTIQUE[commande.statut];

  async function changer(statut: StatutCommande) {
    if (verrou.current) return;
    if (statut === "annulee" && !motif) { setMessage("Choisissez le motif de l’annulation."); return; }
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await changerStatutCommandeBoutique(commande.id, statut, statut === "annulee" ? motif : null, note);
      setMessage(resultat.message);
      if (resultat.succes) { setStockACorriger(statut === "annulee" && motif === "plus_en_stock"); setAnnulation(false); setNote(""); router.refresh(); }
    } catch { setMessage("Impossible de modifier la commande. Vérifiez votre connexion."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const motifAffiche = libelleMotif(commande.motif_annulation);
  return <article aria-label={`Commande n° ${commande.numero}`} className="flex flex-col gap-1.5 border-b border-trait py-4">
    <div className="flex items-start justify-between gap-3"><span className="text-sm">N° {commande.numero} · {commande.client_nom}</span><span className="etiquette whitespace-nowrap text-right">{STATUTS_COMMANDE[commande.statut]}{commande.statut === "prete" && commande.expire_le ? ` · jusqu’au ${formaterDateHeure(commande.expire_le)}` : ""}</span></div>
    <p className="text-xs text-gris">{formaterDateHeure(commande.cree_le)} · <a href={lienContactClient(commande.client_telephone, commande.numero, boutique)} target="_blank" rel="noopener noreferrer" className="underline">{telephoneLisible(commande.client_telephone)} · WhatsApp</a></p>
    <ul className="text-[13px] font-light">{commande.lignes_commande.map(l => <li key={l.id}>{l.titre} · {l.taille} × {l.quantite} · {formaterPrix(l.prix_unitaire * l.quantite)}</li>)}</ul>
    <p className="text-sm">Total {formaterPrix(commande.total)} · {quantiteTotale(commande.lignes_commande)} pièce{quantiteTotale(commande.lignes_commande) > 1 ? "s" : ""}</p>
    {commande.note && <p className="text-sm text-gris">Note du client : « {commande.note} »</p>}
    {motifAffiche && <p className="text-sm text-gris">Motif : {motifAffiche}</p>}
    {(action || annulableParBoutique(commande.statut)) && !annulation && <div className="mt-1 flex gap-2">
      {action && <button type="button" disabled={enCours} onClick={() => void changer(action.statut)} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{action.libelle}</button>}
      <button type="button" disabled={enCours} onClick={() => { setAnnulation(true); setMessage(""); }} className="etiquette min-h-11 border border-noir px-3">Annuler</button>
    </div>}
    {annulation && <fieldset className="mt-1 border border-trait p-3">
      <legend className="etiquette px-1">Motif de l’annulation</legend>
      <div className="flex flex-wrap gap-1.5">{MOTIFS_BOUTIQUE.map(m => <button key={m} type="button" aria-pressed={motif === m} onClick={() => setMotif(m)} className={`min-h-11 border px-2.5 text-sm ${motif === m ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{MOTIFS_ANNULATION[m]}</button>)}</div>
      <label htmlFor={`note-${commande.id}`} className="etiquette mt-3 block text-xs">Message au client (facultatif)</label>
      <textarea id={`note-${commande.id}`} rows={2} maxLength={NOTE_SUIVI_MAX} value={note} disabled={enCours} onChange={e => setNote(e.target.value)} className="mt-1 box-border w-full resize-none rounded-none border border-trait p-2 font-[inherit] text-base" />
      <div className="mt-2 flex gap-2"><button type="button" disabled={enCours} onClick={() => void changer("annulee")} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Annuler la commande</button><button type="button" disabled={enCours} onClick={() => setAnnulation(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div>
    </fieldset>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {stockACorriger && <Link href="/espace" className="text-sm underline">Corriger le stock dans Mes articles</Link>}
  </article>;
}

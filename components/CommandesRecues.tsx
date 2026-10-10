"use client";
import { useRef, useState } from "react";
import Numero from "@/components/Numero";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changerStatutCommandeBoutique, declarerClientPasVenu } from "@/app/espace/commandes/actions";
import { nomBon } from "@/lib/bons-boutique";
import { ACTION_BOUTIQUE, annulableParBoutique, estStockInsuffisant, formaterDateHeure, peutDeclarerNoShow, libelleMotif, MOTIFS_ANNULATION, MOTIFS_BOUTIQUE, NOTE_SUIVI_MAX, quantiteTotale, STATUTS_COMMANDE, type CommandeRecue, type MotifBoutique, type StatutCommande } from "@/lib/commandes";
import { formaterPrix } from "@/lib/prix";
import { lienContactClient } from "@/lib/whatsapp";
import { aEncaisser } from "@/lib/bons";

// US-20.3 : commandes reçues par la boutique, avec les boutons de changement de statut.
export default function CommandesRecues({ commandes, boutique }: { commandes: CommandeRecue[]; boutique: string }) {
  if (!commandes.length) return <p className="py-8 text-center text-sm text-gris">Aucune commande ici pour le moment.</p>;
  return <ul>{commandes.map(c => <li key={c.id}><CarteCommande commande={c} boutique={boutique} /></li>)}</ul>;
}

/** Détail d’une commande avec ses boutons ; US-28.1 : réutilisé, sans changement de règle, sous la ligne dépliée du tableau (`dansTableau`). */
export function CarteCommande({ commande, boutique, dansTableau = false }: { commande: CommandeRecue; boutique: string; dansTableau?: boolean }) {
  const router = useRouter();
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState<MotifBoutique | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [stockACorriger, setStockACorriger] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [pasVenu, setPasVenu] = useState(false);
  const [sansQr, setSansQr] = useState(false);
  const [maintenant] = useState(() => Date.now());
  const verrou = useRef(false);
  const action = ACTION_BOUTIQUE[commande.statut];

  async function changer(statut: StatutCommande) {
    if (verrou.current) return;
    if (statut === "annulee" && !motif) { setMessage("Choisissez le motif de l’annulation."); return; }
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await changerStatutCommandeBoutique(commande.id, statut, statut === "annulee" ? motif : null, note);
      setMessage(resultat.message);
      if (resultat.succes) { setSansQr(false); setStockACorriger(statut === "annulee" && motif === "plus_en_stock"); setAnnulation(false); setNote(""); router.refresh(); }
      // Confirmation refusée : le stock ne suffit plus (vente en direct) → corriger le stock ou annuler.
      else setStockACorriger(estStockInsuffisant(resultat.message));
    } catch { setMessage("Impossible de modifier la commande. Vérifiez votre connexion."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  async function signalerPasVenu() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await declarerClientPasVenu(commande.id);
      setMessage(resultat.message);
      if (resultat.succes) { setPasVenu(false); router.refresh(); }
    } catch { setMessage("Impossible de signaler ce client. Vérifiez votre connexion."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const motifAffiche = libelleMotif(commande.motif_annulation);
  return <article aria-label={`Commande n° ${commande.numero}`} className={`flex flex-col gap-1.5 ${dansTableau ? "max-w-[560px] py-1" : "border-b border-trait py-4"}`}>
    {!dansTableau && <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm">N° {commande.numero} · {commande.client_nom}</span><span className="etiquette shrink-0 whitespace-nowrap text-right">{STATUTS_COMMANDE[commande.statut]}</span></div>}
    {dansTableau && <p className="text-sm">{commande.client_nom} · {STATUTS_COMMANDE[commande.statut]}</p>}
    {commande.statut === "prete" && commande.expire_le && <p className="text-xs text-gris">À récupérer jusqu’au {formaterDateHeure(commande.expire_le)}</p>}
    <p className="text-xs text-gris">{formaterDateHeure(commande.cree_le)} · <a href={lienContactClient(commande.client_telephone, commande.numero, boutique)} target="_blank" rel="noopener noreferrer" className="underline"><Numero telephone={commande.client_telephone} lisible /> · WhatsApp</a></p>
    <ul className="text-[13px] font-light">{commande.lignes_commande.map(l => <li key={l.id}>{l.titre} · {l.taille} × {l.quantite} · {formaterPrix(l.prix_unitaire * l.quantite)}</li>)}</ul>
    <p className="text-sm">Total {formaterPrix(commande.total)} · {quantiteTotale(commande.lignes_commande)} pièce{quantiteTotale(commande.lignes_commande) > 1 ? "s" : ""}</p>
    {/* US-27.4, US-33.4 : bon BleDeal remboursé à la boutique, avec son nom. */}
    {(commande.remise_bon ?? 0) > 0 && <p className="text-sm font-medium">{nomBon(commande.bon)} −{formaterPrix(commande.remise_bon)} · à encaisser {formaterPrix(aEncaisser(commande.total, commande.remise_bon))}</p>}
    {commande.note && <p className="text-sm text-gris">Note du client : « {commande.note} »</p>}
    {motifAffiche && <p className="text-sm text-gris">Motif : {motifAffiche}</p>}
    {commande.no_show_le && <p className="text-sm text-gris">Client pas venu · signalé le {formaterDateHeure(commande.no_show_le)}{commande.no_show_annule_le ? " (annulé par BleDeal)" : ""}</p>}
    {commande.statut === "prete" && !annulation && <p className="text-sm">Remise : scannez le QR code du client. <Link href="/espace/scanner" className="underline">Scanner</Link></p>}
    {(action || annulableParBoutique(commande.statut)) && !annulation && <div className="mt-1 flex gap-2">
      {action && commande.statut !== "prete" && <button type="button" disabled={enCours} onClick={() => void changer(action.statut)} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{action.libelle}</button>}
      <button type="button" disabled={enCours} onClick={() => { setAnnulation(true); setMessage(""); }} className="etiquette min-h-11 border border-noir px-3">Annuler</button>
    </div>}
    {/* US-26.3, décision 2 : remise manuelle gardée, derrière une confirmation. */}
    {commande.statut === "prete" && !annulation && (sansQr
      ? <div className="mt-1 flex flex-col gap-2 border border-trait p-3"><p className="text-sm">Le client n’a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez.</p>{(commande.remise_bon ?? 0) > 0 && <p className="text-sm font-medium">Sans QR code, le bon ne s’applique pas : encaissez {formaterPrix(commande.total)}. Le bon reste au client.</p>}<div className="flex gap-2"><button type="button" disabled={enCours} onClick={() => void changer("recuperee")} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Confirmer la remise</button><button type="button" disabled={enCours} onClick={() => setSansQr(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div></div>
      : <button type="button" disabled={enCours} onClick={() => { setSansQr(true); setMessage(""); }} className="min-h-11 self-start text-sm underline">Remis sans QR code</button>)}
    {annulation && <fieldset className="mt-1 border border-trait p-3">
      <legend className="etiquette px-1">Motif de l’annulation</legend>
      <div className="flex flex-wrap gap-1.5">{MOTIFS_BOUTIQUE.map(m => <button key={m} type="button" aria-pressed={motif === m} onClick={() => setMotif(m)} className={`min-h-11 border px-2.5 text-sm ${motif === m ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{MOTIFS_ANNULATION[m]}</button>)}</div>
      <label htmlFor={`note-${commande.id}`} className="etiquette mt-3 block text-xs">Message au client (facultatif)</label>
      <textarea id={`note-${commande.id}`} rows={2} maxLength={NOTE_SUIVI_MAX} value={note} disabled={enCours} onChange={e => setNote(e.target.value)} className="mt-1 box-border w-full resize-none rounded-none border border-trait p-2 font-[inherit] text-base" />
      <div className="mt-2 flex gap-2"><button type="button" disabled={enCours} onClick={() => void changer("annulee")} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Annuler la commande</button><button type="button" disabled={enCours} onClick={() => setAnnulation(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div>
    </fieldset>}
    {peutDeclarerNoShow(commande, maintenant) && !annulation && (pasVenu
      ? <div className="mt-1 flex flex-col gap-2 border border-trait p-3"><p className="text-sm">Le client n’est pas venu chercher sa commande ? Il recevra un avertissement sur WhatsApp ; au 5e oubli, son compte est bloqué.</p><div className="flex gap-2"><button type="button" disabled={enCours} onClick={() => void signalerPasVenu()} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Confirmer : pas venu</button><button type="button" disabled={enCours} onClick={() => setPasVenu(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div></div>
      : <button type="button" disabled={enCours} onClick={() => { setPasVenu(true); setMessage(""); }} className="etiquette mt-1 min-h-11 border border-noir px-3">Client pas venu</button>)}
    {message && <p role="status" className="text-sm">{message}</p>}
    {stockACorriger && <Link href="/espace" className="text-sm underline">Corriger le stock dans Mes articles</Link>}
  </article>;
}

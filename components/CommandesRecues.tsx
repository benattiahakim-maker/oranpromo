"use client";
import Isole from "@/components/Isole";
import { useRef, useState } from "react";
import Prix from "@/components/Prix";
import Numero from "@/components/Numero";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changerStatutCommandeBoutique, declarerClientPasVenu } from "@/app/espace/commandes/actions";
import { nomBon } from "@/lib/bons-boutique";
import { ACTION_BOUTIQUE, annulableParBoutique, estStockInsuffisant, formaterDateHeure, peutDeclarerNoShow, MOTIFS_ANNULATION, MOTIFS_BOUTIQUE, NOTE_SUIVI_MAX, quantiteTotale, type CommandeRecue, type MotifAnnulation, type MotifBoutique, type StatutCommande } from "@/lib/commandes";
import { lienContactClient } from "@/lib/whatsapp";
import { aEncaisser } from "@/lib/bons";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";

// US-20.3 : commandes reçues par la boutique, avec les boutons de changement de statut.
export default function CommandesRecues({ commandes, boutique }: { commandes: CommandeRecue[]; boutique: string }) {
  const t = useTextes().espace.carte;
  if (!commandes.length) return <p className="py-8 text-center text-sm text-gris">{t.aucune}</p>;
  return <ul>{commandes.map(c => <li key={c.id}><CarteCommande commande={c} boutique={boutique} /></li>)}</ul>;
}

/** Détail d’une commande avec ses boutons ; US-28.1 : réutilisé, sans changement de règle, sous la ligne dépliée du tableau (`dansTableau`). */
export function CarteCommande({ commande, boutique, dansTableau = false }: { commande: CommandeRecue; boutique: string; dansTableau?: boolean }) {
  const router = useRouter();
  const textes = useTextes(), t = textes.espace.carte, c = textes.espace.commun, langue = useLangue();
  const statuts = textes.commandes.statuts, motifs = textes.commandes.motifs;
  const date = (iso: string) => formaterDateHeure(iso, langue);
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
    if (statut === "annulee" && !motif) { setMessage(t.choisirMotif); return; }
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await changerStatutCommandeBoutique(commande.id, statut, statut === "annulee" ? motif : null, note);
      setMessage(resultat.message);
      if (resultat.succes) { setSansQr(false); setStockACorriger(statut === "annulee" && motif === "plus_en_stock"); setAnnulation(false); setNote(""); router.refresh(); }
      // Confirmation refusée : le stock ne suffit plus (vente en direct) → corriger le stock ou annuler.
      else setStockACorriger(estStockInsuffisant(resultat.message));
    } catch { setMessage(textes.espace.tableau.ligneImpossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  async function signalerPasVenu() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await declarerClientPasVenu(commande.id);
      setMessage(resultat.message);
      if (resultat.succes) { setPasVenu(false); router.refresh(); }
    } catch { setMessage(t.signalerImpossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const motifAffiche = commande.motif_annulation && Object.hasOwn(MOTIFS_ANNULATION, commande.motif_annulation) ? motifs[commande.motif_annulation as MotifAnnulation] : null;
  const pieces = quantiteTotale(commande.lignes_commande);
  return <article aria-label={remplir(t.commande, { n: commande.numero })} className={`flex flex-col gap-1.5 ${dansTableau ? "max-w-[560px] py-1" : "border-b border-trait py-4"}`}>
    {!dansTableau && <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm">{remplir(textes.espace.tableau.numeroCourt, { n: commande.numero })} · <Isole langue={langue}>{commande.client_nom}</Isole></span><span className="etiquette shrink-0 whitespace-nowrap text-end">{statuts[commande.statut]}</span></div>}
    {dansTableau && <p className="text-sm"><Isole langue={langue}>{commande.client_nom}</Isole> · {statuts[commande.statut]}</p>}
    {commande.statut === "prete" && commande.expire_le && <p className="text-xs text-gris">{remplir(t.aRecuperer, { date: date(commande.expire_le) })}</p>}
    <p className="text-xs text-gris">{date(commande.cree_le)} · <a href={lienContactClient(commande.client_telephone, commande.numero, boutique)} target="_blank" rel="noopener noreferrer" className="underline"><Numero telephone={commande.client_telephone} lisible /> · {t.whatsapp}</a></p>
    <ul className="text-[13px] font-light">{commande.lignes_commande.map(l => <li key={l.id}><Isole langue={langue}>{l.titre}</Isole> · <Isole langue={langue}>{l.taille}</Isole> × {l.quantite} · <Prix montant={l.prix_unitaire * l.quantite} langue={langue} /></li>)}</ul>
    <p className="text-sm">{t.total} <Prix montant={commande.total} langue={langue} /> · {remplir(pieces > 1 ? t.pieces : t.piece, { n: pieces })}</p>
    {/* US-27.4, US-33.4 : bon BleDeal remboursé à la boutique, avec son nom. */}
    {(commande.remise_bon ?? 0) > 0 && <p className="text-sm font-medium">{nomBon(commande.bon, textes.parrainage, langue)} <Prix montant={commande.remise_bon} moins langue={langue} /> · {t.aEncaisser} <Prix montant={aEncaisser(commande.total, commande.remise_bon)} langue={langue} /></p>}
    {commande.note && <p className="text-sm text-gris">{remplir(t.noteClient, { note: commande.note })}</p>}
    {motifAffiche && <p className="text-sm text-gris">{remplir(t.motif, { motif: motifAffiche })}</p>}
    {commande.no_show_le && <p className="text-sm text-gris">{remplir(t.pasVenuSignale, { date: date(commande.no_show_le) })}{commande.no_show_annule_le ? t.annuleParBleDeal : ""}</p>}
    {commande.statut === "prete" && !annulation && <p className="text-sm">{t.remiseScan} <Link href="/espace/scanner" className="underline">{c.scanner}</Link></p>}
    {(action || annulableParBoutique(commande.statut)) && !annulation && <div className="mt-1 flex gap-2">
      {action && commande.statut !== "prete" && <button type="button" disabled={enCours} onClick={() => void changer(action.statut)} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{t.actions[action.statut as keyof typeof t.actions] ?? action.libelle}</button>}
      <button type="button" disabled={enCours} onClick={() => { setAnnulation(true); setMessage(""); }} className="etiquette min-h-11 border border-noir px-3">{c.annuler}</button>
    </div>}
    {/* US-26.3, décision 2 : remise manuelle gardée, derrière une confirmation. */}
    {commande.statut === "prete" && !annulation && (sansQr
      ? <div className="mt-1 flex flex-col gap-2 border border-trait p-3"><p className="text-sm">{t.sansQrQuestion}</p>{(commande.remise_bon ?? 0) > 0 && <p className="text-sm font-medium">{(() => { const [avant, apres] = t.sansQrBon.split("{montant}"); return <>{avant}<Prix montant={commande.total} langue={langue} />{apres}</>; })()}</p>}<div className="flex gap-2"><button type="button" disabled={enCours} onClick={() => void changer("recuperee")} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{t.confirmerRemise}</button><button type="button" disabled={enCours} onClick={() => setSansQr(false)} className="etiquette min-h-11 border border-trait px-3">{c.retour}</button></div></div>
      : <button type="button" disabled={enCours} onClick={() => { setSansQr(true); setMessage(""); }} className="min-h-11 self-start text-sm underline">{t.remisSansQr}</button>)}
    {annulation && <fieldset className="mt-1 border border-trait p-3">
      <legend className="etiquette px-1">{t.motifAnnulation}</legend>
      <div className="flex flex-wrap gap-1.5">{MOTIFS_BOUTIQUE.map(m => <button key={m} type="button" aria-pressed={motif === m} onClick={() => setMotif(m)} className={`min-h-11 border px-2.5 text-sm ${motif === m ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{motifs[m]}</button>)}</div>
      <label htmlFor={`note-${commande.id}`} className="etiquette mt-3 block text-xs">{t.messageClient}</label>
      <textarea id={`note-${commande.id}`} rows={2} maxLength={NOTE_SUIVI_MAX} value={note} disabled={enCours} onChange={e => setNote(e.target.value)} className="mt-1 box-border w-full resize-none rounded-none border border-trait p-2 font-[inherit] text-base" />
      <div className="mt-2 flex gap-2"><button type="button" disabled={enCours} onClick={() => void changer("annulee")} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{t.annulerCommande}</button><button type="button" disabled={enCours} onClick={() => setAnnulation(false)} className="etiquette min-h-11 border border-trait px-3">{c.retour}</button></div>
    </fieldset>}
    {peutDeclarerNoShow(commande, maintenant) && !annulation && (pasVenu
      ? <div className="mt-1 flex flex-col gap-2 border border-trait p-3"><p className="text-sm">{t.pasVenuQuestion}</p><div className="flex gap-2"><button type="button" disabled={enCours} onClick={() => void signalerPasVenu()} className="etiquette min-h-11 flex-1 bg-noir text-blanc">{t.confirmerPasVenu}</button><button type="button" disabled={enCours} onClick={() => setPasVenu(false)} className="etiquette min-h-11 border border-trait px-3">{c.retour}</button></div></div>
      : <button type="button" disabled={enCours} onClick={() => { setPasVenu(true); setMessage(""); }} className="etiquette mt-1 min-h-11 border border-noir px-3">{t.clientPasVenu}</button>)}
    {message && <p role="status" className="text-sm">{message}</p>}
    {stockACorriger && <Link href="/espace" className="text-sm underline">{textes.espace.tableau.corrigerStock}</Link>}
  </article>;
}

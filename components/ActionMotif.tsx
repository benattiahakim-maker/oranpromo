"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// US-27.5 : action admin qui demande un motif (3 à 300 caractères, vérifié par la base) puis une confirmation.
export type ResultatAction = { succes: boolean; message: string };
export default function ActionMotif({ libelle, confirmer, aide, action, etiquette }: { libelle: string; confirmer: string; aide?: string; etiquette: string; action: (motif: string) => Promise<ResultatAction> }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function valider() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const r = await action(motif); setMessage(r.message); if (r.succes) { setOuvert(false); setMotif(""); router.refresh(); } }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <div className="mt-2">
    {!ouvert ? <button type="button" onClick={() => { setOuvert(true); setMessage(""); }} aria-label={etiquette} className="etiquette min-h-11 border border-noir px-3">{libelle}</button>
      : <div className="border border-trait p-3">
        <label htmlFor={id} className="text-xs text-gris">Motif (obligatoire)</label>
        <input id={id} value={motif} maxLength={300} onChange={e => setMotif(e.target.value)} className="mt-1 min-h-11 w-full border border-trait px-3 text-sm" />
        {aide && <p className="mt-2 text-xs leading-[1.6] text-gris">{aide}</p>}
        <div className="mt-3 flex gap-2"><button type="button" disabled={enCours} onClick={() => void valider()} className="etiquette min-h-11 flex-1 bg-noir px-3 text-blanc">{confirmer}</button><button type="button" disabled={enCours} onClick={() => setOuvert(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div>
      </div>}
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}

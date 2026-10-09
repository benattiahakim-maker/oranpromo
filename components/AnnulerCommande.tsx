"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { annulerMaCommande } from "@/app/compte/actions";
import { NOTE_SUIVI_MAX } from "@/lib/commandes";

export default function AnnulerCommande({ id }: { id: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function annuler() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = await annulerMaCommande(id, note); setMessage(resultat.message); if (resultat.succes) { setOuvert(false); router.refresh(); } }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (!ouvert) return <div><button type="button" onClick={() => setOuvert(true)} className="etiquette min-h-11 w-full border border-noir">Annuler ma commande</button>{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
  return <div className="border border-trait p-4">
    <label htmlFor="note-annulation" className="etiquette block text-xs">Un mot pour la boutique (facultatif)</label>
    <textarea id="note-annulation" rows={2} maxLength={NOTE_SUIVI_MAX} value={note} disabled={enCours} onChange={e => setNote(e.target.value)} className="mt-2 box-border w-full resize-none rounded-none border border-trait p-3 font-[inherit] text-base" />
    <div className="mt-3 flex gap-2"><button type="button" disabled={enCours} onClick={() => void annuler()} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Confirmer l’annulation</button><button type="button" disabled={enCours} onClick={() => setOuvert(false)} className="etiquette min-h-11 border border-trait px-3">Retour</button></div>
    {message && <p role="alert" className="mt-2 text-sm">{message}</p>}
  </div>;
}

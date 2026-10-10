"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { arreterProgrammeAdmin } from "@/app/admin/bons/actions";
import { conditionsProgramme, etatProgramme, resumeProgramme, textesSignal, type ProgrammeAdmin, type SignalBoutique } from "@/lib/bons-admin";

// US-33.5 : programmes de bons (bienvenue, campagnes) avec leurs chiffres, « Arrêter », et signaux (jamais automatiques).
export default function ProgrammesBons({ programmes, signaux, maintenant }: { programmes: ProgrammeAdmin[]; signaux: Record<string, SignalBoutique[]>; maintenant: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ id: string; texte: string } | null>(null);
  const [confirmer, setConfirmer] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function arreter(id: string) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true);
    try { const r = await arreterProgrammeAdmin(id); setMessage({ id, texte: r.message }); setConfirmer(null); if (r.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (!programmes.length) return <p className="mt-6 text-sm">Aucun programme.</p>;
  const avecSignaux = programmes.filter(p => (signaux[p.id] ?? []).length > 0);
  return <>
    <ul aria-label="Programmes" className="mt-6">{programmes.map(p => <li key={p.id} className="border-t border-trait py-4">
      <div className="flex items-start justify-between gap-3"><p className="text-[15px]">{p.nom_fr}{p.code ? ` · ${p.code}` : ""}</p><span className="etiquette shrink-0">{etatProgramme(p, new Date(maintenant))}</span></div>
      <p className="mt-1 text-sm">{resumeProgramme(p)}</p>
      <p className="mt-1 text-xs text-gris">{conditionsProgramme(p)}</p>
      {p.actif && (confirmer === p.id
        ? <div className="mt-2 border border-noir p-3 text-sm"><p>Arrêter « {p.nom_fr} » ? Plus aucun nouveau bon ; les bons déjà donnés restent valables jusqu’à leur échéance.</p>
          <div className="mt-2 flex gap-2"><button type="button" disabled={enCours} onClick={() => void arreter(p.id)} className="etiquette min-h-11 flex-1 bg-noir text-blanc">Arrêter</button>
          <button type="button" onClick={() => setConfirmer(null)} className="etiquette min-h-11 flex-1 border border-noir">Annuler</button></div></div>
        : <button type="button" onClick={() => { setConfirmer(p.id); setMessage(null); }} className="etiquette mt-2 min-h-11 border border-noir px-4">Arrêter</button>)}
      {message?.id === p.id && <p role="status" className="mt-2 text-sm">{message.texte}</p>}
    </li>)}</ul>
    <section aria-labelledby="signaux-bons" className="mt-6 border border-trait p-4">
      <h2 id="signaux-bons" className="etiquette">Signaux</h2>
      {avecSignaux.length ? avecSignaux.map(p => <div key={p.id} className="mt-3"><p className="text-sm font-medium">{p.nom_fr}</p>
        <ul className="mt-1">{(signaux[p.id] ?? []).flatMap(s => textesSignal(s, p)).map((t, i) => <li key={i} className="py-1 text-sm">{t}</li>)}</ul></div>)
        : <p className="mt-2 text-sm">Aucun signal.</p>}
      <p className="mt-3 text-xs leading-[1.6] text-gris">Rien n’est bloqué automatiquement : vous décidez avec « Mettre de côté » ou « Refuser » dans les <Link href="/admin/remboursements" className="underline">remboursements</Link>.</p>
    </section>
  </>;
}

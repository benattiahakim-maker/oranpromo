"use client";
// US-32.2 : écran « Donner mon avis » (maquette docs/maquettes/AvisBoutiques.dc.html, vues ② ③ ⑨).
import { useRef, useState } from "react";
import Link from "next/link";
import { donnerMonAvis } from "@/app/compte/commandes/[id]/avis/actions";
import { COMMENTAIRE_AVIS_MAX, CRITERES_AVIS, type CritereAvis } from "@/lib/avis";
import { remplir } from "@/lib/langue";
import { useTextes } from "./FournisseurTextes";

export default function FormulaireAvis({ commande }: { commande: string }) {
  const t = useTextes().avis;
  const [note, setNote] = useState(0);
  const [criteres, setCriteres] = useState<CritereAvis[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState("");
  const [publie, setPublie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);

  async function publier(e: React.FormEvent) {
    e.preventDefault();
    if (verrou.current) return;
    if (!note) { setErreur(t.noteRequise); return; }
    verrou.current = true; setEnCours(true); setErreur("");
    try {
      const r = await donnerMonAvis(commande, { note, criteres, commentaire });
      if (r.succes) setPublie(r.message); else setErreur(r.message);
    } catch { setErreur(t.impossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  if (publie) return <div className="py-6 text-center">
    <p role="status" className="border border-noir p-4 text-[15px]">{publie}</p>
    <Link href={`/compte/commandes/${commande}`} className="etiquette mt-6 flex min-h-11 items-center justify-center border border-noir">{t.retourCommande}</Link>
  </div>;

  const basculer = (c: CritereAvis) => setCriteres(liste => liste.includes(c) ? liste.filter(x => x !== c) : [...liste, c]);
  return <form onSubmit={e => void publier(e)} noValidate className="flex flex-col gap-5 pt-5">
    <fieldset>
      <legend className="etiquette text-xs">{t.note}</legend>
      <div role="radiogroup" aria-label={t.note} className="mt-2 flex justify-center gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={note === n} aria-label={remplir(t.etoiles, { n })}
          onClick={() => { setNote(n); setErreur(""); }} disabled={enCours}
          className={`min-h-11 min-w-11 text-[30px] leading-none ${n <= note ? "text-noir" : "text-trait"}`}>★</button>)}
      </div>
      <p className="mt-1 text-center text-xs text-gris">{t.noteObligatoire}</p>
    </fieldset>
    <div className="flex flex-wrap justify-center gap-2">
      {CRITERES_AVIS.map(c => <button key={c} type="button" aria-pressed={criteres.includes(c)} onClick={() => basculer(c)} disabled={enCours}
        className={`min-h-11 border px-3 text-sm ${criteres.includes(c) ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{t.criteres[c]}</button>)}
    </div>
    <div>
      <label htmlFor="commentaire-avis" className="etiquette block text-xs">{t.commentaire}</label>
      <textarea id="commentaire-avis" rows={4} maxLength={COMMENTAIRE_AVIS_MAX} value={commentaire} disabled={enCours}
        onChange={e => setCommentaire(e.target.value)} aria-describedby="compteur-avis"
        className="mt-2 box-border w-full resize-none rounded-none border border-trait p-3 font-[inherit] text-base" />
      <p id="compteur-avis" className="text-end text-xs text-gris" dir="ltr">{remplir(t.compteur, { n: commentaire.length })}</p>
    </div>
    {erreur && <p role="alert" className="border border-noir p-3 text-sm leading-[1.6]">{erreur}</p>}
    <button type="submit" disabled={enCours} className="etiquette min-h-[54px] bg-noir text-blanc">{t.publier}</button>
    <p className="text-center text-xs leading-[1.6] text-gris">{t.rappel}</p>
  </form>;
}

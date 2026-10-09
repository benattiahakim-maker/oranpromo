"use client";
import { useEffect, useRef, useState } from "react";
import { LONGUEUR_ARABE_MAX, texteArabeTraduction, TRADUCTION_INDISPONIBLE, validerTraductionIA } from "@/lib/ia-traduction";

export default function DescriptionArabe({ titre, description, valeur, onChange, occupe = false }: { titre: string; description: string; valeur: string; onChange: (valeur: string) => void; occupe?: boolean }) {
  const [enCours, setEnCours] = useState(false), [message, setMessage] = useState("");
  const requete = useRef<AbortController | null>(null), revision = useRef(0);
  const actuel = useRef({ titre, description, valeur, occupe });
  useEffect(() => { actuel.current = { titre, description, valeur, occupe }; }, [titre, description, valeur, occupe]);
  useEffect(() => () => requete.current?.abort(), []);
  async function generer() {
    if (enCours || occupe || !titre.trim()) return;
    requete.current?.abort(); const controleur = new AbortController(); requete.current = controleur;
    const avant = revision.current; setEnCours(true); setMessage("");
    try {
      const reponse = await fetch("/api/ia/traduire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titre, description }), signal: AbortSignal.any([controleur.signal, AbortSignal.timeout(18000)]) });
      const resultat = await reponse.json();
      if (controleur.signal.aborted) return;
      if (!reponse.ok) { setMessage(resultat.message || TRADUCTION_INDISPONIBLE); return; }
      if (avant !== revision.current || actuel.current.titre !== titre || actuel.current.description !== description || actuel.current.valeur !== valeur || actuel.current.occupe) { setMessage("Votre saisie a changé pendant la traduction. Elle a été conservée."); return; }
      onChange(texteArabeTraduction(validerTraductionIA(resultat, !description.trim())));
    } catch { if (!controleur.signal.aborted) setMessage(TRADUCTION_INDISPONIBLE); }
    finally { if (!controleur.signal.aborted) setEnCours(false); }
  }
  return <section aria-label="Description en arabe" className="mx-auto w-full max-w-[390px] bg-blanc font-sans text-noir">
    <button type="button" disabled={occupe || enCours || !titre.trim()} onClick={() => void generer()} className="min-h-[44px] w-full border border-noir bg-blanc px-3 py-2 text-sm text-noir">{enCours ? "Traduction en cours…" : "Générer en arabe"}</button>
    <label className="mt-3 block text-sm">Texte arabe (facultatif)<textarea name="descriptionAr" value={valeur} disabled={occupe} onChange={event => { revision.current++; onChange(event.target.value); }} rows={5} maxLength={LONGUEUR_ARABE_MAX} dir="rtl" lang="ar" className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir" /></label>
    {message && <p role="status" className="mt-3 text-sm text-gris">{message}</p>}
  </section>;
}

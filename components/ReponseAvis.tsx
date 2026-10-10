"use client";

// US-32.4 : « Votre réponse publique (une seule fois) » (maquette ⑦). Espace commerçant : français seulement.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publierReponse } from "@/app/espace/avis/actions";
import { REPONSE_AVIS_MAX } from "@/lib/avis";

export default function ReponseAvis({ avisId }: { avisId: string }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const verrou = useRef(false);
  const longueur = Array.from(texte).length;
  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current) return;
    if (!texte.trim()) { setErreur("Écrivez votre réponse."); return; }
    if (longueur > REPONSE_AVIS_MAX) { setErreur(`La réponse doit contenir ${REPONSE_AVIS_MAX} caractères au plus.`); return; }
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      const resultat = await publierReponse(avisId, texte);
      if (resultat.succes) { setMessage(resultat.message); router.refresh(); }
      else setErreur(resultat.message);
    } catch { setErreur("Impossible de publier la réponse. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (message) return <p role="status" className="mt-3 text-sm">{message}</p>;
  return <form onSubmit={envoyer} className="mt-3 flex flex-col gap-2">
    <label htmlFor={`reponse-${avisId}`} className="text-sm">Votre réponse publique (une seule fois)</label>
    <textarea id={`reponse-${avisId}`} name="reponse" value={texte} onChange={e => setTexte(e.target.value)} rows={3} maxLength={REPONSE_AVIS_MAX} aria-describedby={`compteur-${avisId}`} aria-invalid={erreur ? true : undefined} className="w-full border border-trait p-2" />
    <p id={`compteur-${avisId}`} className="text-end text-xs text-gris">{longueur}/{REPONSE_AVIS_MAX}</p>
    <button disabled={enCours} className="etiquette min-h-11 bg-noir px-3 text-blanc disabled:opacity-40">{enCours ? "Publication…" : "Publier la réponse"}</button>
    {erreur && <p role="alert" className="text-sm">{erreur}</p>}
  </form>;
}

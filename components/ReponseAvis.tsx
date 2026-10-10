"use client";

// US-32.4 : « Votre réponse publique (une seule fois) » (maquette ⑦). US-35 : dans la langue de l'espace.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publierReponse } from "@/app/espace/avis/actions";
import { REPONSE_AVIS_MAX } from "@/lib/avis";
import { useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";

export default function ReponseAvis({ avisId }: { avisId: string }) {
  const router = useRouter();
  const t = useTextes().espace.avis;
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const verrou = useRef(false);
  const longueur = Array.from(texte).length;
  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current) return;
    if (!texte.trim()) { setErreur(t.reponseVide); return; }
    if (longueur > REPONSE_AVIS_MAX) { setErreur(remplir(t.reponseTrop, { n: REPONSE_AVIS_MAX })); return; }
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      const resultat = await publierReponse(avisId, texte);
      if (resultat.succes) { setMessage(resultat.message); router.refresh(); }
      else setErreur(resultat.message);
    } catch { setErreur(t.publierImpossible); }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (message) return <p role="status" className="mt-3 text-sm">{message}</p>;
  return <form onSubmit={envoyer} className="mt-3 flex flex-col gap-2">
    <label htmlFor={`reponse-${avisId}`} className="text-sm">{t.reponseLibelle}</label>
    <textarea id={`reponse-${avisId}`} name="reponse" value={texte} onChange={e => setTexte(e.target.value)} rows={3} maxLength={REPONSE_AVIS_MAX} aria-describedby={`compteur-${avisId}`} aria-invalid={erreur ? true : undefined} dir="auto" className="w-full border border-trait p-2" />
    <p id={`compteur-${avisId}`} dir="ltr" className="text-end text-xs text-gris">{longueur}/{REPONSE_AVIS_MAX}</p>
    <button disabled={enCours} className="etiquette min-h-11 bg-noir px-3 text-blanc disabled:opacity-40">{enCours ? t.publication : t.publier}</button>
    {erreur && <p role="alert" className="text-sm">{erreur}</p>}
  </form>;
}

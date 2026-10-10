"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { choisirParrain } from "@/app/compte/parrainage/actions";
import { remplir } from "@/lib/langue";
import { modificationsRestantes, textesParrainage } from "@/lib/parrainage";
import { useTextes } from "./FournisseurTextes";

// US-27.2 : saisie du parrain (numéro WhatsApp ou code), avant la première commande et dans les 7 jours.
// Réponse toujours identique quand la base accepte (pas d'énumération) ; les erreurs ne portent que sur le filleul.
// `vouvoiement` : hors des pages du parrainage (/compte, panier) ; les pages du parrainage tutoient (décision 9 du 9/10).
export default function ChoixParrain({ initial = "", parrainSaisi, saisies, titre = true, vouvoiement = false }: { initial?: string; parrainSaisi: boolean; saisies: number; titre?: boolean; vouvoiement?: boolean }) {
  const t = textesParrainage(useTextes().parrainage, vouvoiement);
  const router = useRouter();
  const [saisie, setSaisie] = useState(initial);
  const [modifier, setModifier] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const restantes = modificationsRestantes(saisies);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      const resultat = await choisirParrain(saisie, vouvoiement);
      if (resultat.succes) { setMessage(resultat.message); setModifier(false); setSaisie(""); router.refresh(); }
      else setErreur(resultat.message);
    } catch { setErreur(t.impossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const enregistre = (parrainSaisi || message) && !modifier;
  return <section aria-labelledby="titre-parrain" className={titre ? "mt-6 border border-noir p-4" : "mt-4"}>
    <h2 id="titre-parrain" className="sr-only">{t.tonParrain}</h2>
    {message && <p role="status" className="mt-3 border border-noir p-3 text-sm leading-[1.6]">{message}</p>}
    {enregistre ? <div className="mt-3 flex items-center justify-between gap-3 text-sm">
      <span>{t.parrainEnregistre}</span>
      {restantes > 0 && <button type="button" onClick={() => { setModifier(true); setMessage(""); }} className="min-h-11 underline">{t.modifier}</button>}
    </div>
    : <form onSubmit={e => void valider(e)}>
      <label htmlFor="saisie-parrain" className="etiquette block text-xs">{t.champ}</label>
      <input id="saisie-parrain" name="parrain" value={saisie} onChange={e => setSaisie(e.target.value)} maxLength={40} autoComplete="off" inputMode="text" dir="ltr" disabled={enCours}
        className="mt-2 box-border min-h-12 w-full rounded-none border border-noir px-3 text-start text-base" />
      <p className="mt-2 text-xs leading-[1.6] text-gris">{t.rappel}</p>
      {parrainSaisi && <p className="mt-1 text-xs text-gris">{remplir(t.modificationsRestantes, { n: restantes })}</p>}
      <button type="submit" disabled={enCours || !saisie.trim()} className="etiquette mt-3 min-h-12 w-full bg-noir text-blanc disabled:opacity-60">{enCours ? t.envoi : t.valider}</button>
    </form>}
    {erreur && <p role="alert" className="mt-3 text-sm">{erreur}</p>}
  </section>;
}

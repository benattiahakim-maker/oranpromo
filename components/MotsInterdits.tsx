"use client";

// US-32 (suite) : liste des mots interdits du filtre des avis, tenue par l'admin (onglet « Mots interdits » de /admin/moderation).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ajouterMot, retirerMot } from "@/app/admin/moderation/actions";

type Resultat = { succes: boolean; message: string };

export default function MotsInterdits({ mots }: { mots: string[] }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState("");
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function agir(action: () => Promise<Resultat>, apres?: () => void) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage(""); setErreur("");
    try { const resultat = await action(); if (resultat.succes) { setMessage(resultat.message); apres?.(); router.refresh(); } else setErreur(resultat.message); }
    catch { setErreur("Impossible d’effectuer cette action. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <section aria-labelledby="titre-mots">
    <h2 id="titre-mots" className="font-titre text-[22px] font-normal">Mots interdits</h2>
    <p className="mt-2 text-sm text-gris">Un avis ou une réponse qui contient un de ces mots est refusé à l’envoi. Un seul mot à la fois, en français, en darja ou en arabe ; il est enregistré en minuscules, sans accents (« Arnaqué » devient « arnaque »). Les avis déjà publiés ne changent pas.</p>
    <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void agir(() => ajouterMot(nouveau), () => setNouveau("")); }}>
      <label className="sr-only" htmlFor="mot-interdit">Nouveau mot interdit</label>
      <input id="mot-interdit" value={nouveau} onChange={event => setNouveau(event.target.value)} maxLength={40} autoComplete="off" disabled={enCours}
        className="min-h-[44px] min-w-0 flex-1 border border-trait bg-blanc px-3 py-2 text-base" />
      <button type="submit" disabled={enCours || !nouveau.trim()} className="etiquette min-h-[44px] shrink-0 border border-noir bg-noir px-4 text-blanc">Ajouter</button>
    </form>
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
    <p className="mt-6 text-sm text-gris">{mots.length > 1 ? `${mots.length} mots` : mots.length === 1 ? "1 mot" : "Aucun mot : seuls les liens et les numéros de téléphone sont refusés."}</p>
    {mots.length > 0 && <ul aria-label="Mots interdits" className="mt-2 border-t border-trait">{mots.map(mot => <li key={mot} className="flex items-center justify-between gap-3 border-b border-trait py-2">
      <span dir="auto" className="min-w-0 break-words">{mot}</span>
      <button type="button" disabled={enCours} aria-label={`Retirer « ${mot} »`} onClick={() => void agir(() => retirerMot(mot))} className="min-h-[44px] shrink-0 border border-noir px-4 text-sm">Retirer</button>
    </li>)}</ul>}
  </section>;
}

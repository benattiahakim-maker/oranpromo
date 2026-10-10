"use client";

// US-29.4 : liste des villes de /admin/villes (maquette 9 et texte 16) et ville de chaque ambassadeur.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { definirVilleAmbassadeur, ouvrirVille, type ResultatVille } from "@/app/admin/villes/actions";
import { resumeVille, texteConfirmationVille, type AmbassadeurVille, type VilleAvecCompte } from "@/lib/villes-admin";

export default function VillesAdministration({ villes, ambassadeurs }: { villes: VilleAvecCompte[]; ambassadeurs: AmbassadeurVille[] }) {
  const router = useRouter();
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function agir(action: () => Promise<ResultatVille>) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage(""); setErreur("");
    try { const resultat = await action(); if (resultat.succes) { setMessage(resultat.message); setAConfirmer(null); router.refresh(); } else setErreur(resultat.message); }
    catch { setErreur("Impossible d’effectuer cette action. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  const choisie = villes.find(ville => ville.code === aConfirmer);
  const confirmation = choisie ? texteConfirmationVille(choisie.nom, !choisie.ouverte) : null;
  return <>
    <ul className="border-t border-trait">{villes.map(ville => <li key={ville.code} className="flex items-center justify-between gap-3 border-b border-trait py-4">
      <div className="min-w-0"><p className="text-lg">{ville.nom} <span lang="ar" dir="rtl" className="text-gris">{ville.nom_ar}</span></p><p className="text-sm text-gris">{resumeVille(ville)}</p></div>
      <button type="button" disabled={enCours} aria-pressed={ville.ouverte} aria-label={`${ville.nom} : ${ville.ouverte ? "ouverte, fermer" : "fermée, ouvrir"}`} onClick={() => { setMessage(""); setErreur(""); setAConfirmer(ville.code); }}
        className={`etiquette min-h-[44px] w-[120px] shrink-0 border border-noir px-3 py-2 ${ville.ouverte ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}>{ville.ouverte ? "Ouverte" : "Fermée"}</button>
    </li>)}</ul>
    {choisie && confirmation && <div role="group" aria-label="Confirmation" className="my-4 border border-noir p-4">
      <p><strong>{confirmation.question}</strong> {confirmation.suite}</p>
      <div className="mt-4 flex gap-2"><button type="button" disabled={enCours} onClick={() => void agir(() => ouvrirVille(choisie.code, !choisie.ouverte))} className="etiquette min-h-[44px] border border-noir bg-noir px-6 text-blanc">{choisie.ouverte ? "Fermer" : "Ouvrir"}</button>
        <button type="button" disabled={enCours} onClick={() => setAConfirmer(null)} className="etiquette min-h-[44px] border border-noir px-6">Annuler</button></div>
    </div>}
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
    <section aria-labelledby="ambassadeurs-villes" className="mt-10 border-t border-trait pt-6">
      <h2 id="ambassadeurs-villes" className="font-titre text-[28px] font-normal">Ville des ambassadeurs</h2>
      <p className="mt-2 text-sm text-gris">Un ambassadeur avec une ville ne crée des boutiques que dans cette ville.</p>
      {ambassadeurs.length ? <ul className="mt-4">{ambassadeurs.map(ambassadeur => <LigneAmbassadeur key={ambassadeur.id} ambassadeur={ambassadeur} villes={villes} agir={agir} enCours={enCours} />)}</ul> : <p className="mt-4">Aucun ambassadeur pour l’instant.</p>}
    </section>
  </>;
}

function LigneAmbassadeur({ ambassadeur, villes, agir, enCours }: { ambassadeur: AmbassadeurVille; villes: VilleAvecCompte[]; agir: (action: () => Promise<ResultatVille>) => Promise<void>; enCours: boolean }) {
  const [ville, setVille] = useState(ambassadeur.ville ?? "");
  const nom = ambassadeur.nom || ambassadeur.telephone || "Ambassadeur sans nom";
  return <li className="border-b border-trait py-4"><label className="etiquette">{nom}
    <select value={ville} disabled={enCours} onChange={event => setVille(event.target.value)} aria-label={`Ville de ${nom}`} className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base normal-case tracking-normal">
      <option value="">Toutes les villes</option>{villes.map(v => <option key={v.code} value={v.code}>{v.nom}</option>)}
    </select></label>
    <button type="button" disabled={enCours || ville === (ambassadeur.ville ?? "")} onClick={() => void agir(() => definirVilleAmbassadeur(ambassadeur.id, ville || null))} className="mt-3 min-h-[44px] w-full border border-noir px-3 py-2">Enregistrer</button>
  </li>;
}

"use client";
import { useId, useState, useTransition } from "react";
import { useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import type { ErreurAlertes } from "@/lib/alertes-whatsapp";
import { activerAlertes } from "@/app/compte/boutiques/actions";

// US-31.5 : après « Suivre », l'alerte WhatsApp est proposée À PART (maquette SuivreBoutique, écran ②) :
// case jamais cochée d'office ; « Enregistrer » sans la case n'enregistre rien. Suivre ne vaut pas accord.
export default function AccordAlertes({ nom }: { nom: string }) {
  const t = useTextes().alertes;
  const id = useId();
  const [coche, setCoche] = useState(false);
  const [fini, setFini] = useState<"activees" | "pasDAlerte" | null>(null);
  const [erreur, setErreur] = useState<ErreurAlertes | null>(null);
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    setErreur(null);
    if (!coche) { setFini("pasDAlerte"); return; }
    demarrer(async () => {
      const resultat = await activerAlertes("vitrine");
      if (resultat.succes) setFini("activees"); else setErreur(resultat.erreur ?? "erreur");
    });
  }

  return <div className="mt-3 border border-trait p-4 text-start">
    <p dir="auto" className="text-sm">{remplir(t.vousSuivez, { nom })}</p>
    {fini ? <p role="status" className="mt-3 text-sm">{t[fini]}</p> : <>
      <div className="mt-3 flex items-start gap-3">
        <input id={id} type="checkbox" checked={coche} onChange={e => setCoche(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-noir" />
        <label htmlFor={id} className="text-sm leading-[1.5]">{t.caseAccord}</label>
      </div>
      <button type="button" disabled={enCours} onClick={enregistrer} className="etiquette mt-3 flex min-h-12 w-full items-center justify-center border border-noir px-2 disabled:opacity-60">{enCours ? t.enCours : t.enregistrer}</button>
    </>}
    {erreur && <p role="alert" className="mt-2 text-sm text-erreur">{t[erreur]}</p>}
  </div>;
}

"use client";
import { useState } from "react";
import { telephoneLisible } from "@/lib/clients";
import CodeTelephone from "./CodeTelephone";
import { useTextes } from "./FournisseurTextes";

// US-21.2 : numéro du client dans /compte. Vérifié → affiché sans champ modifiable, « Changer de numéro » relance
// une vérification par code. Non vérifié (mode téléphone) → vérification demandée avant de commander.
export default function NumeroVerifie({ telephone, verifie, verificationActive }: { telephone: string | null; verifie: boolean; verificationActive: boolean }) {
  const textes = useTextes();
  const t = textes.numero;
  const [changer, setChanger] = useState(false);
  if (verifie && telephone) return <section aria-labelledby="titre-numero" className="mt-6 border border-trait p-4">
    <h2 id="titre-numero" className="etiquette m-0 text-xs">{t.verifie}</h2>
    <p dir="ltr" className="mb-0 mt-2 text-start text-base"><bdi>{telephoneLisible(telephone)}</bdi></p>
    <p className="m-0 text-[13px] text-gris">{textes.profil.contact}</p>
    {verificationActive && (changer
      ? <div className="mt-4"><CodeTelephone usage="verification" onVerifie={() => setChanger(false)} /></div>
      : <button type="button" onClick={() => setChanger(true)} className="mt-3 min-h-11 text-sm underline">{t.changer}</button>)}
  </section>;
  if (!verificationActive) return null;
  return <section aria-labelledby="titre-numero" className="mt-6 border border-noir p-4">
    <h2 id="titre-numero" className="etiquette m-0 text-xs">{t.verifierTitre}</h2>
    <p className="mb-4 mt-2 text-sm leading-[1.6]">{t.verifierTexte}</p>
    <CodeTelephone usage="verification" numeroInitial={telephone} />
  </section>;
}

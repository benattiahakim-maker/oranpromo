"use client";
import { useState } from "react";
import { telephoneLisible } from "@/lib/clients";
import CodeTelephone from "./CodeTelephone";

// US-21.2 : numéro du client dans /compte. Vérifié → affiché sans champ modifiable, « Changer de numéro » relance
// une vérification par code. Non vérifié (mode téléphone) → vérification demandée avant de commander.
export default function NumeroVerifie({ telephone, verifie, verificationActive }: { telephone: string | null; verifie: boolean; verificationActive: boolean }) {
  const [changer, setChanger] = useState(false);
  if (verifie && telephone) return <section aria-labelledby="titre-numero" className="mt-6 border border-trait p-4">
    <h2 id="titre-numero" className="etiquette m-0 text-xs">Téléphone vérifié</h2>
    <p className="mb-0 mt-2 text-base">{telephoneLisible(telephone)}</p>
    <p className="m-0 text-[13px] text-gris">La boutique vous contacte sur ce numéro pour votre commande.</p>
    {verificationActive && (changer
      ? <div className="mt-4"><CodeTelephone usage="verification" onVerifie={() => setChanger(false)} /></div>
      : <button type="button" onClick={() => setChanger(true)} className="mt-3 min-h-11 text-sm underline">Changer de numéro</button>)}
  </section>;
  if (!verificationActive) return null;
  return <section aria-labelledby="titre-numero" className="mt-6 border border-noir p-4">
    <h2 id="titre-numero" className="etiquette m-0 text-xs">Vérifiez votre numéro pour commander</h2>
    <p className="mb-4 mt-2 text-sm leading-[1.6]">Nous vous envoyons un code à 6 chiffres sur WhatsApp (ou par SMS). La boutique vous contactera sur ce numéro.</p>
    <CodeTelephone usage="verification" numeroInitial={telephone} />
  </section>;
}

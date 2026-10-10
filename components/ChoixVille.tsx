"use client";
// US-29.2 : liste des villes ouvertes (page /villes). Choisir = formulaire (marche sans JavaScript).
// « Me localiser » compare la position avec les bornes des villes DANS le téléphone : rien n'est envoyé ni gardé.
import { useState } from "react";
import { choisirVille } from "@/app/ville/actions";
import { OPTIONS_LOCALISATION_CLIENTE } from "@/lib/carte";
import { remplir } from "@/lib/langue";
import { nomVille, villeDeLaPosition, type Ville } from "@/lib/ville";
import { useLangue, useTextes } from "./FournisseurTextes";

type Etat = "aucun" | "recherche" | "trouvee" | "hors" | "introuvable";

export default function ChoixVille({ villes, actuelle, retour }: { villes: Ville[]; actuelle: string | null; retour: string }) {
  const t = useTextes().villes, langue = useLangue();
  const [etat, setEtat] = useState<Etat>("aucun");
  const [proche, setProche] = useState<string | null>(null);

  function localiser() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setEtat("introuvable"); return; }
    setEtat("recherche");
    navigator.geolocation.getCurrentPosition(
      position => {
        const ville = villeDeLaPosition(villes, position.coords.latitude, position.coords.longitude);
        setProche(ville?.code ?? null); setEtat(ville ? "trouvee" : "hors");
      },
      () => { setProche(null); setEtat("introuvable"); },
      OPTIONS_LOCALISATION_CLIENTE,
    );
  }

  const villeProche = villes.find(v => v.code === proche);
  return <>
    <div className="px-5 pt-5">
      <button type="button" onClick={localiser} disabled={etat === "recherche"} className="etiquette flex min-h-12 w-full items-center justify-center gap-2 border border-noir">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        {t.localiser}
      </button>
      <p className="mt-2 text-xs text-gris">{t.confidentialite}</p>
      <p role="status" className="mt-2 text-sm">
        {etat === "recherche" && t.recherche}
        {etat === "trouvee" && villeProche && remplir(t.proche, { ville: nomVille(villeProche, langue) })}
        {etat === "hors" && t.horsVilles}
        {etat === "introuvable" && t.introuvable}
      </p>
    </div>
    <form action={choisirVille} className="px-5 pb-10 pt-2">
      <input type="hidden" name="retour" value={retour} />
      <ul aria-label={t.liste} className="border-t border-trait">
        {villes.map(v => {
          const marquee = v.code === (proche ?? actuelle);
          return <li key={v.code} className="border-b border-trait">
            <button name="ville" value={v.code} aria-current={v.code === actuelle ? "true" : undefined}
              className={`flex min-h-14 w-full items-center justify-between gap-3 px-1 text-start ${marquee ? "font-medium" : ""}`}>
              <span className="font-titre text-xl">{nomVille(v, langue)}{v.code === actuelle && <span className="sr-only"> ({t.actuelle})</span>}</span>
              <span className="text-sm text-gris">{remplir(v.boutiques > 1 ? t.boutiques : t.boutiqueUne, { n: v.boutiques })} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span>
            </button>
          </li>;
        })}
      </ul>
    </form>
  </>;
}

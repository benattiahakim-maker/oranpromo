"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useTextes } from "@/components/FournisseurTextes";
import { nePlusRecevoir, type ResultatLien } from "@/app/alertes/[jeton]/actions";

// US-31.5 : page du lien « Ne plus recevoir » (maquette SuivreBoutique, écran ⑨). Un bouton (POST) : la simple
// ouverture du lien par un aperçu ne désabonne pas. Déjà désactivées : le message final s'affiche tout de suite.
export default function NePlusRecevoir({ jeton, dejaFait }: { jeton: string; dejaFait: boolean }) {
  const t = useTextes().alertes;
  const [resultat, setResultat] = useState<ResultatLien | null>(dejaFait ? "desactivees" : null);
  const [enCours, demarrer] = useTransition();

  if (resultat === "desactivees") return <div role="status" className="border border-trait p-4">
    <p className="text-sm">{t.lienFait}</p>
    <p className="mt-1.5 text-xs text-gris">{t.lienToujours}</p>
    <Link href="/compte/boutiques" className="mt-3 inline-block text-sm underline">{t.mesBoutiques}</Link>
  </div>;
  return <div>
    <p className="text-sm leading-[1.6]">{t.lienQuestion}</p>
    <button type="button" disabled={enCours} onClick={() => demarrer(async () => setResultat(await nePlusRecevoir(jeton)))}
      className="etiquette mt-4 flex min-h-12 w-full items-center justify-center bg-noir px-2 text-blanc disabled:opacity-60">{enCours ? t.enCours : t.lienBouton}</button>
    {resultat && <p role="alert" className="mt-2 text-sm text-erreur">{resultat === "invalide" ? t.lienInvalide : t.erreur}</p>}
  </div>;
}

"use client";
// US-23 : sélecteur de langue, toujours visible dans l'en-tête. Il montre l'autre langue, écrite dans sa langue.
import { choisirLangue } from "@/app/langue/actions";
import { useTextes } from "./FournisseurTextes";

export default function ChoixLangue() {
  const t = useTextes();
  return <form action={choisirLangue} aria-label={t.langue.groupe}>
    <button name="langue" value={t.langue.autreCode} lang={t.langue.autreCode} aria-label={t.langue.autreNom}
      className="inline-flex min-h-11 min-w-11 items-center justify-center border border-noir px-2 text-sm">{t.langue.autre}</button>
  </form>;
}

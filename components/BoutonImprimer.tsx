"use client";

// US-22 : imprime l'affiche ; le bouton n'apparaît pas sur la feuille.
export default function BoutonImprimer() {
  return <button type="button" onClick={() => window.print()} className="etiquette flex min-h-12 w-full items-center justify-center bg-noir px-4 text-blanc print:hidden">Imprimer</button>;
}

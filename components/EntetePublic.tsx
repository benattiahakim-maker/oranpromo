"use client";
import Link from "next/link";
import LienPanier from "./LienPanier";
import ChoixLangue from "./ChoixLangue";
import { useTextes } from "./FournisseurTextes";

// US-23 : la recherche passe en icône pour laisser la place au sélecteur de langue à 375 px.
// US-24.3 : lien « Carte » ; le panier passe en icône de sac avec le nombre.
export default function EntetePublic() {
  const t = useTextes();
  return <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-1 border-b border-trait px-4 py-4">
    <Link href="/" dir="ltr" className="font-titre text-lg tracking-[0.18em]">ORANPROMO</Link>
    <nav aria-label={t.entete.navigation} className="flex items-center gap-0.5">
      <Link href="/catalogue" aria-label={t.entete.rechercher} title={t.entete.rechercher} className="inline-flex min-h-11 min-w-11 items-center justify-center">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
      </Link>
      <Link href="/carte" className="etiquette inline-flex min-h-11 items-center px-1.5">{t.entete.carte}</Link>
      <LienPanier />
      <ChoixLangue />
    </nav>
  </header>;
}

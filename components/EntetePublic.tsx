"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LienPanier from "./LienPanier";
import ChoixLangue from "./ChoixLangue";
import { useLangue, useTextes } from "./FournisseurTextes";
import { remplir } from "@/lib/langue";
import { cheminVille, nomVille, type Ville } from "@/lib/ville";

// US-23 : la recherche passe en icône pour laisser la place au sélecteur de langue à 375 px.
// US-24.3 : lien « Carte » ; le panier passe en icône de sac avec le nombre.
// US-29.2 : sur une page de ville, logo, recherche et carte restent dans la ville (/oran, /oran/catalogue, /oran/carte) ;
// bouton « Oran ▾ » vers /villes quand au moins 2 villes sont ouvertes. Sans ville (pages globales) : anciennes
// adresses, qui renvoient vers la ville gardée.
export default function EntetePublic({ ville, choixVille = false }: { ville?: Pick<Ville, "code" | "nom" | "nom_ar">; choixVille?: boolean }) {
  const t = useTextes(), langue = useLangue();
  const chemin = usePathname() ?? "/";
  const lien = (suite: string) => (ville ? cheminVille(ville.code, suite) : suite);
  const nom = ville ? nomVille(ville, langue) : "";
  return <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-1 border-b border-trait px-4 py-4">
    <div className="flex min-w-0 items-center gap-2">
      <Link href={lien("/")} dir="ltr" className="font-titre text-[26px] leading-none">BleDeal</Link>
      {ville && choixVille && <Link href={`/villes?${new URLSearchParams({ retour: chemin })}`} aria-label={remplir(t.entete.changerVille, { ville: nom })}
        className="etiquette inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-1 text-[11px]">{nom} <span aria-hidden="true">▾</span></Link>}
    </div>
    <nav aria-label={t.entete.navigation} className="flex items-center gap-0.5">
      <Link href={lien("/catalogue")} aria-label={t.entete.rechercher} title={t.entete.rechercher} className="inline-flex min-h-11 min-w-11 items-center justify-center">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
      </Link>
      <Link href={lien("/carte")} className="etiquette inline-flex min-h-11 items-center px-1.5">{t.entete.carte}</Link>
      <LienPanier />
      <ChoixLangue />
    </nav>
  </header>;
}

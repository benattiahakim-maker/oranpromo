"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { abonnerPanier, lirePanier, nombreArticlesPanier, panierBrut } from "@/lib/panier";
import { remplir } from "@/lib/langue";
import { useTextes } from "./FournisseurTextes";

export default function LienPanier() {
  const t = useTextes();
  const brut = useSyncExternalStore(abonnerPanier, panierBrut, () => "");
  const nombre = nombreArticlesPanier(lirePanier(brut));
  // US-24.3 : icône de sac avec le nombre d'articles (place pour « Carte » et la langue à 375 px) ; le nom complet reste lu.
  const nom = !nombre ? t.entete.panier : nombre === 1 ? t.entete.panierUnArticle : remplir(t.entete.panierArticles, { n: nombre });
  return <Link href="/panier" aria-label={nom} title={nom} className="relative inline-flex min-h-11 min-w-11 items-center justify-center">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 8h14l-1 13H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
    {nombre > 0 && <span aria-hidden="true" dir="ltr" className="absolute end-0.5 top-1 inline-flex h-4 min-w-4 items-center justify-center bg-noir px-1 text-[10px] leading-none text-blanc">{nombre}</span>}
  </Link>;
}

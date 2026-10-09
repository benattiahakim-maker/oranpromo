"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { abonnerPanier, lirePanier, nombreArticlesPanier, panierBrut } from "@/lib/panier";

export default function LienPanier() {
  const brut = useSyncExternalStore(abonnerPanier, panierBrut, () => "");
  const nombre = nombreArticlesPanier(lirePanier(brut));
  return <Link href="/panier" className="etiquette inline-flex min-h-11 items-center">Panier{nombre ? ` (${nombre})` : ""}</Link>;
}

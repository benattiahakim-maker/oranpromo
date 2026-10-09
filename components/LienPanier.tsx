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
  return <Link href="/panier" className="etiquette inline-flex min-h-11 items-center">{nombre ? remplir(t.entete.panierAvecNombre, { n: nombre }) : t.entete.panier}</Link>;
}

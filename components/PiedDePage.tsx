"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTextes } from "./FournisseurTextes";
import type { Textes } from "@/lib/textes";

/** Pages en français seulement (espace, administration, lien « Confirmer ») : le pied de page y reste en français, en ltr. */
export function pageEnFrancais(chemin: string | null): boolean {
  return /^\/(espace|admin|confirmer)(\/|$)/.test(chemin ?? "");
}

type LiensJuridiques = Pick<Textes["juridique"], "piedDePage" | "conditions" | "commercants" | "confidentialite">;

// US-34.1 : liens juridiques en bas de toutes les pages (« Contact » viendra avec l'adresse de contact de la société).
// Revue RTL (10/10) : sous l'espace, l'administration et « Confirmer », libellés français (`francais`) et sens gauche-droite.
export default function PiedDePage({ francais }: { francais?: LiensJuridiques }) {
  const textes = useTextes().juridique;
  const enFrancais = Boolean(francais) && pageEnFrancais(usePathname());
  const t = enFrancais && francais ? francais : textes;
  return <footer {...(enFrancais ? { dir: "ltr", lang: "fr" } : {})} className="mx-auto mt-auto w-full max-w-lg border-t border-trait px-4 py-3">
    <nav aria-label={t.piedDePage} className="flex flex-wrap items-center gap-x-1 text-xs text-gris">
      <Link href="/conditions" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.conditions}</Link>
      <span aria-hidden="true">·</span>
      <Link href="/conditions-commercants" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.commercants}</Link>
      <span aria-hidden="true">·</span>
      <Link href="/confidentialite" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.confidentialite}</Link>
    </nav>
  </footer>;
}

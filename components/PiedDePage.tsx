"use client";
import Link from "next/link";
import { useTextes } from "./FournisseurTextes";

// US-34.1 : liens juridiques en bas de toutes les pages (« Contact » viendra avec l'adresse de contact de la société).
export default function PiedDePage() {
  const t = useTextes().juridique;
  return <footer className="mx-auto mt-auto w-full max-w-lg border-t border-trait px-4 py-3">
    <nav aria-label={t.piedDePage} className="flex flex-wrap items-center gap-x-1 text-xs text-gris">
      <Link href="/conditions" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.conditions}</Link>
      <span aria-hidden="true">·</span>
      <Link href="/conditions-commercants" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.commercants}</Link>
      <span aria-hidden="true">·</span>
      <Link href="/confidentialite" className="inline-flex min-h-11 items-center px-1 underline-offset-2 hover:underline">{t.confidentialite}</Link>
    </nav>
  </footer>;
}

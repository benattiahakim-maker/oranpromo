"use client";
import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import { useTextes } from "@/components/FournisseurTextes";

export default function PageIntrouvable() {
  const t = useTextes();
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">{t.introuvable.titre}</h1><Link href="/" className="etiquette mt-6 inline-flex min-h-11 items-center bg-noir px-6 text-blanc">{t.introuvable.retour}</Link></main></>;
}

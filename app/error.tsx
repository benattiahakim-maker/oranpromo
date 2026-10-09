"use client";
import EntetePublic from "@/components/EntetePublic";
import { useTextes } from "@/components/FournisseurTextes";

export default function Erreur({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTextes();
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">{t.erreur.titre}</h1><button type="button" onClick={retry} className="etiquette mt-6 min-h-11 cursor-pointer bg-noir px-6 text-blanc">{t.erreur.reessayer}</button></main></>;
}

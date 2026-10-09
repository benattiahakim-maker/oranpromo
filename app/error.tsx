"use client";
import EntetePublic from "@/components/EntetePublic";

export default function Erreur({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">Une erreur est survenue</h1><button type="button" onClick={retry} className="etiquette mt-6 min-h-11 cursor-pointer bg-noir px-6 text-blanc">Réessayer</button></main></>;
}

import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";

export default function PageIntrouvable() {
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">Page introuvable</h1><Link href="/" className="etiquette mt-6 inline-flex min-h-11 items-center bg-noir px-6 text-blanc">Retour à l’accueil</Link></main></>;
}

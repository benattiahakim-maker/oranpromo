import Link from "next/link";
import { remplir } from "@/lib/langue";
import type { Textes } from "@/lib/textes";

// US-31.3 : bandeau de la vitrine après le QR code de l'affiche (/i/<slug>), pour un visiteur pas encore connecté.
// « Créer mon compte » = connexion client (le compte est créé à la première connexion), retour sur la vitrine ensuite.
export default function BienvenueBoutique({ nom, slug, t }: { nom: string; slug: string; t: Textes["suivre"] }) {
  return <section aria-label={remplir(t.bienvenueTitre, { nom })} className="mx-6 mt-2 border border-noir p-5 text-center">
    <h2 dir="auto" className="font-titre break-words text-xl">{remplir(t.bienvenueTitre, { nom })}</h2>
    <p className="mt-2 text-sm leading-[1.6]">{t.bienvenueTexte}</p>
    <Link href={`/compte/connexion?suite=${encodeURIComponent(`/b/${slug}`)}`} className="etiquette mt-4 flex min-h-12 items-center justify-center bg-noir px-2 text-blanc">{t.creerCompte}</Link>
  </section>;
}

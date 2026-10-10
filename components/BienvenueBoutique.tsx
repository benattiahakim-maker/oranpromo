import Link from "next/link";
import { remplir, type Langue } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import type { OffreInscription } from "@/lib/inscription-boutique";
import type { Textes } from "@/lib/textes";

// US-31.3 : bandeau de la vitrine après le QR code de l'affiche (/i/<slug>), pour un visiteur pas encore connecté.
// « Créer mon compte » = connexion client (le compte est créé à la première connexion), retour sur la vitrine ensuite.
// US-31.4 : avec l'offre ouverte, le bon de bienvenue (maquette SuivreBoutique, écran ⑧).
export default function BienvenueBoutique({ nom, slug, t, offre = null, langue = "fr" }: { nom: string; slug: string; t: Textes["suivre"]; offre?: OffreInscription | null; langue?: Langue }) {
  return <section aria-label={remplir(t.bienvenueTitre, { nom })} className="mx-6 mt-2 border border-noir p-5 text-center">
    <h2 dir="auto" className="font-titre break-words text-xl">{remplir(t.bienvenueTitre, { nom })}</h2>
    <p className="mt-2 text-sm leading-[1.6]">{t.bienvenueTexte}</p>
    {offre && <div className="mt-3 border-t border-trait pt-3">
      <p dir="auto" className="text-sm font-medium leading-[1.6]">{remplir(t.bonInscription, { montant: formaterPrix(offre.montant, langue), minimum: formaterPrix(offre.minimum_achat, langue) })}</p>
      <p className="mt-1 text-xs text-gris">{t.bonInscriptionNumero}</p>
    </div>}
    <Link href={`/compte/connexion?suite=${encodeURIComponent(`/b/${slug}`)}`} className="etiquette mt-4 flex min-h-12 items-center justify-center bg-noir px-2 text-blanc">{t.creerCompte}</Link>
  </section>;
}

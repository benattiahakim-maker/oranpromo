import Link from "next/link";
import { texteAbonnes, texteBonsInscription, type NombreAbonnes } from "@/lib/abonnements";
import type { Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";

// US-31.3 : nombre de clients qui suivent la boutique (visible seulement par la boutique, jamais public), avec le
// rappel de l'affiche dont le QR code inscrit les clients en boutique. US-31.4 : inscrits et bons d'inscription du mois.
export default function AbonnesBoutique({ abonnes, langue = "fr" }: { abonnes: NombreAbonnes; langue?: Langue }) {
  const t = textesDe(langue).espace.abonnes, bons = texteBonsInscription(abonnes, langue);
  return <section aria-label={t.titre} className="mb-6 border border-trait p-4 text-center">
    <p className="text-sm">{texteAbonnes(abonnes, langue)}</p>
    {bons && <p className="mt-1 text-xs leading-[1.6] text-gris">{bons}</p>}
    <Link href="/espace/affiche" className="mt-2 inline-flex min-h-11 items-center text-sm underline">{t.affiche}</Link>
  </section>;
}

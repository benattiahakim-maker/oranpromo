import Link from "next/link";
import { texteAbonnes, type NombreAbonnes } from "@/lib/abonnements";

// US-31.3 : nombre de clients qui suivent la boutique (visible seulement par la boutique, jamais public), avec le
// rappel de l'affiche dont le QR code inscrit les clients en boutique.
export default function AbonnesBoutique({ abonnes }: { abonnes: NombreAbonnes }) {
  return <section aria-label="Clients qui suivent la boutique" className="mb-6 border border-trait p-4 text-center">
    <p className="text-sm">{texteAbonnes(abonnes)}</p>
    <Link href="/espace/affiche" className="mt-2 inline-flex min-h-11 items-center text-sm underline">Affiche avec QR code : inscrivez vos clients en caisse</Link>
  </section>;
}

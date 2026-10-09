"use client";
import Link from "next/link";
import { useTextes } from "./FournisseurTextes";

// US-27.3 : encadré « Merci ! » sur le suivi d'une commande récupérée (rien dans les messages WhatsApp).
export default function MerciParrainage({ whatsapp }: { whatsapp: string | null }) {
  const t = useTextes().parrainage;
  return <section aria-labelledby="titre-merci" className="mt-5 bg-fond-photo p-4">
    <h2 id="titre-merci" className="font-titre text-[22px] font-normal">{t.merciTitre}</h2>
    <p className="mt-1 text-sm leading-[1.6]">{t.merciTexte}</p>
    {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="etiquette mt-3 flex min-h-12 items-center justify-center bg-noir text-blanc">{t.partagerMonLien}</a>
      : <Link href="/parrainage" className="etiquette mt-3 flex min-h-12 items-center justify-center bg-noir text-blanc">{t.commentMarche}</Link>}
  </section>;
}

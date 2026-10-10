import Link from "next/link";
import type { BoutiqueSuivie } from "@/lib/abonnements";
import type { Langue } from "@/lib/langue";
import { remplir } from "@/lib/langue";
import type { Textes } from "@/lib/textes";

// US-31.2 : liste des boutiques suivies (/compte/boutiques). Pas de date de création sur les promos :
// on affiche « N promos en cours » plutôt que « nouvelles promos cette semaine » (écart documenté).
export default function MesBoutiques({ boutiques, langue, t }: { boutiques: BoutiqueSuivie[]; langue: Langue; t: Textes["suivre"] }) {
  if (!boutiques.length) return <div className="py-8 text-center">
    <p className="text-sm leading-[1.6]">{t.vide}</p>
    <Link href="/carte" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.voirCarte}</Link>
  </div>;
  return <ul>{boutiques.map(b => <li key={b.id}><Link href={`/b/${b.slug}`} className="flex items-center justify-between gap-3 border-b border-trait py-4">
    <span className="flex min-w-0 flex-col gap-1">
      <span dir="auto" className="break-words text-sm">{b.nom}</span>
      <span className="text-xs text-gris">{b.quartier}{b.ville && ` · ${langue === "ar" ? b.ville.nom_ar : b.ville.nom}`}</span>
    </span>
    <span className={`shrink-0 text-xs ${b.promos ? "etiquette" : "text-gris"}`}>{b.promos === 0 ? t.aucunePromo : b.promos === 1 ? t.unePromo : remplir(t.promos, { n: b.promos })}</span>
  </Link></li>)}</ul>;
}

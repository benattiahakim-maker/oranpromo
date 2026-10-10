"use client";
import Link from "next/link";
import Image from "next/image";
import type { CarteArticle as Article } from "@/lib/catalogue";
import { formaterPrix, prixAffiche, promoActive, pourcentageReduction } from "@/lib/prix";
import { remplir } from "@/lib/langue";
import { useLangue, useTextes } from "./FournisseurTextes";
import type { ResumeAvis } from "@/lib/avis";
import { texteNote } from "./NoteBoutique";

// US-32.3 : « resume » = note de la boutique (catalogue), affichée seulement à partir de 3 avis.
export default function CarteArticle({ article, resume }: { article: Article; resume?: Pick<ResumeAvis, "nombre" | "moyenne"> | null }) {
  const t = useTextes();
  const langue = useLangue();
  const enPromo = promoActive(article.promo);
  return <Link href={`/a/${article.id}`} className="min-w-0 text-center">
    <div className="relative aspect-[4/5] bg-fond-photo">
      {article.photo ? <Image src={article.photo} alt={article.titre} fill sizes="(max-width: 512px) 45vw, 230px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-xs text-gris">{t.carte.aucunePhoto}</span>}
      {enPromo && article.promo && <span className="absolute start-2 top-2 bg-noir px-2 py-1 text-xs text-blanc">{remplir(t.carte.reduction, { n: pourcentageReduction(article.prix, article.promo.prixPromo) })}</span>}
    </div>
    <p className="etiquette mt-3 text-[10px] text-gris">{article.boutique.nom} · {article.boutique.quartier}</p>
    {resume?.moyenne != null && <p className="mt-1 text-[11px]" dir="auto">{texteNote({ resume, t: t.avis })}</p>}
    <h3 className="mt-1 break-words text-sm font-light">{article.titre}</h3>
    <p className="mt-1 text-sm">{enPromo && <del className="me-2 text-gris">{formaterPrix(article.prix, langue)}</del>}{formaterPrix(prixAffiche(article.prix, article.promo), langue)}</p>
  </Link>;
}

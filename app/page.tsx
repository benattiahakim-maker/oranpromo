import Link from "next/link";
import Image from "next/image";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerPromos } from "@/lib/catalogue";
import { CREDIT_GRANDE_PHOTO, GRANDE_PHOTO, TUILES_PIECES_PHARES, TUILES_UNIVERS } from "@/lib/accueil";
import Promos from "@/components/Promos";
import EntetePublic from "@/components/EntetePublic";
import TuilesAccueil from "@/components/TuilesAccueil";
import { getTextes } from "@/lib/langue-serveur";
import { traduire } from "@/lib/textes";
import { UNIVERS } from "@/lib/article";
import { parrainageOuvert } from "@/lib/parrainage";

export const dynamic = "force-dynamic";

export default async function Accueil() {
  const client = await creerClientServeur();
  const [promos, t, parrainage] = await Promise.all([chargerPromos(client), getTextes(), parrainageOuvert(client)]);
  // US-23 : noms des univers et des catégories dans la langue choisie (les liens restent les mêmes).
  const noms: Record<string, string> = { ...t.listes.categories, ...Object.fromEntries(UNIVERS.map(u => [u.nom, t.listes.univers[u.cle]])) };
  const univers = TUILES_UNIVERS.map(tuile => ({ ...tuile, nom: traduire(noms, tuile.nom) }));
  const piecesPhares = TUILES_PIECES_PHARES.map(tuile => ({ ...tuile, nom: traduire(noms, tuile.nom) }));
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic />
    <nav aria-label={t.accueil.univers} className="flex justify-center gap-6 border-b border-trait px-5 py-3">{univers.map(u => <Link key={u.nom} href={u.lien} className="etiquette inline-flex min-h-11 items-center text-[11px]">{u.nom}</Link>)}</nav>
    <section className="relative flex min-h-[440px] flex-col items-center justify-end gap-4 bg-noir px-6 pb-10 text-center text-blanc">
      <Image src={GRANDE_PHOTO.adresse} alt={GRANDE_PHOTO.alt} fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" style={{ objectPosition: GRANDE_PHOTO.position }} priority />
      {/* Voile sombre, plus marqué en bas : le titre et le bouton restent lisibles sur la photo. */}
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-noir/75 via-noir/30 to-noir/10" />
      <h1 className="relative font-titre text-4xl">{t.accueil.titre}</h1>
      <p className="etiquette relative text-[10px] leading-relaxed">{t.accueil.sousTitre}</p>
      <Link href="/catalogue?promo=1" className="etiquette relative inline-flex min-h-12 items-center bg-blanc px-7 text-noir">{t.accueil.voirPromos}</Link>
      <p className="absolute bottom-1.5 end-2 text-[10px] text-blanc/85">{t.accueil.creditPhoto} <a href={CREDIT_GRANDE_PHOTO.lienSource} target="_blank" rel="noopener noreferrer" className="underline">{CREDIT_GRANDE_PHOTO.auteur}</a>, <a href={CREDIT_GRANDE_PHOTO.lienLicence} target="_blank" rel="noopener noreferrer license" className="underline">{CREDIT_GRANDE_PHOTO.licence}</a>, {CREDIT_GRANDE_PHOTO.source}</p>
    </section>
    <TuilesAccueil titre={t.accueil.lesUnivers} tuiles={univers} />
    {/* US-24.3 : lien vers la carte (texte seulement : ni carte ni tuile chargée sur l'accueil). */}
    <section className="px-5 pt-8"><Link href="/carte" className="flex min-h-[72px] items-center justify-between gap-4 border border-noir px-5 py-4">
      <span><span className="block font-titre text-2xl">{t.carteBoutiques.accueilTitre}</span><span className="block text-sm text-gris">{t.carteBoutiques.accueilTexte}</span></span>
      <span className="etiquette shrink-0">{t.carteBoutiques.accueilLien} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span>
    </Link></section>
    {/* US-27.3 : bloc texte du parrainage, seulement quand il est ouvert. */}
    {parrainage && <section className="px-5 pt-4"><Link href="/parrainage" className="flex min-h-[72px] items-center justify-between gap-4 border border-noir px-5 py-4">
      <span><span className="block font-titre text-2xl">{t.parrainage.accueilTitre}</span><span className="block text-sm text-gris">{t.parrainage.accueilTexte}</span></span>
      <span className="etiquette shrink-0">{t.parrainage.accueilLien} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span>
    </Link></section>}
    <TuilesAccueil titre={t.accueil.piecesPhares} tuiles={piecesPhares} />
    <main><div className="flex items-center justify-between px-5 pb-4 pt-8"><h2 className="etiquette">{t.accueil.enCeMoment}</h2><Link href="/catalogue" className="etiquette underline">{t.accueil.toutVoir}</Link></div><Promos initiales={promos} /></main>
    <footer className="border-t border-trait px-6 py-6 text-center"><Link href="/espace/connexion" className="etiquette text-gris">{t.accueil.espaceCommercant}</Link></footer>
  </div>;
}

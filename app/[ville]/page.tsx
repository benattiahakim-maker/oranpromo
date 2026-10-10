import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerPromos } from "@/lib/catalogue";
import { grandePhotoVille, TUILES_PIECES_PHARES, TUILES_UNIVERS } from "@/lib/accueil";
import Promos from "@/components/Promos";
import EntetePublic from "@/components/EntetePublic";
import TuilesAccueil from "@/components/TuilesAccueil";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { traduire } from "@/lib/textes";
import { UNIVERS } from "@/lib/article";
import { parrainageOuvert } from "@/lib/parrainage";
import { getVilleOuverte, getVillesOuvertes } from "@/lib/ville-serveur";
import { cheminVille, deVille, deVilleEnLangue } from "@/lib/ville";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ville: string }> }): Promise<Metadata> {
  const { ville: code } = await params;
  const ville = await getVilleOuverte(code);
  // US-29.3 : titre et description de la ville (description d'Oran : celle d'avant).
  if (!ville) return { alternates: { canonical: cheminVille(code) } };
  return { title: `Promos à ${ville.nom}`, description: `Les promos des boutiques de vêtements ${deVille(ville.nom)}. Réservez sur WhatsApp, payez en boutique.`, alternates: { canonical: cheminVille(ville.code) } };
}

// US-29.2 : accueil d'une ville (/oran). Le layout a vérifié que la ville est ouverte.
export default async function Accueil({ params }: { params: Promise<{ ville: string }> }) {
  const { ville: code } = await params;
  const client = await creerClientServeur();
  const [ville, ouvertes] = await Promise.all([getVilleOuverte(code), getVillesOuvertes()]);
  if (!ville) notFound();
  // US-29.3 : promos des boutiques de la ville, titre et grande photo de la ville.
  const [promos, t, langue, parrainage] = await Promise.all([chargerPromos(client, ville.code), getTextes(), getLangue(), parrainageOuvert(client)]);
  const { photo, credit } = grandePhotoVille(ville.code);
  const titre = remplir(t.accueil.titre, { deVille: deVilleEnLangue(ville, langue) });
  const lien = (suite: string) => cheminVille(ville.code, suite);
  // US-23 : noms des univers et des catégories dans la langue choisie (les liens restent les mêmes).
  const noms: Record<string, string> = { ...t.listes.categories, ...Object.fromEntries(UNIVERS.map(u => [u.nom, t.listes.univers[u.cle]])) };
  const univers = TUILES_UNIVERS.map(tuile => ({ ...tuile, lien: lien(tuile.lien), nom: traduire(noms, tuile.nom) }));
  const piecesPhares = TUILES_PIECES_PHARES.map(tuile => ({ ...tuile, lien: lien(tuile.lien), nom: traduire(noms, tuile.nom) }));
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic ville={ville} choixVille={ouvertes.length > 1} />
    <nav aria-label={t.accueil.univers} className="flex justify-center gap-6 border-b border-trait px-5 py-3">{univers.map(u => <Link key={u.nom} href={u.lien} className="etiquette inline-flex min-h-11 items-center text-[11px]">{u.nom}</Link>)}</nav>
    <section className="relative flex min-h-[440px] flex-col items-center justify-end gap-4 bg-noir px-6 pb-10 text-center text-blanc">
      <Image src={photo.adresse} alt={photo.alt} fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" style={{ objectPosition: photo.position }} priority />
      {/* Voile sombre, plus marqué en bas : le titre et le bouton restent lisibles sur la photo. */}
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-noir/75 via-noir/30 to-noir/10" />
      <h1 className="relative font-titre text-4xl">{titre}</h1>
      <p className="etiquette relative text-[10px] leading-relaxed">{t.accueil.sousTitre}</p>
      <Link href={lien("/catalogue?promo=1")} className="etiquette relative inline-flex min-h-12 items-center bg-blanc px-7 text-noir">{t.accueil.voirPromos}</Link>
      {credit && <p className="absolute bottom-1.5 end-2 text-[10px] text-blanc/85">{t.accueil.creditPhoto} <a href={credit.lienSource} target="_blank" rel="noopener noreferrer" className="underline">{credit.auteur}</a>, <a href={credit.lienLicence} target="_blank" rel="noopener noreferrer license" className="underline">{credit.licence}</a>, {credit.source}</p>}
    </section>
    <TuilesAccueil titre={t.accueil.lesUnivers} tuiles={univers} />
    {/* US-24.3 : lien vers la carte (texte seulement : ni carte ni tuile chargée sur l'accueil). */}
    <section className="px-5 pt-8"><Link href={lien("/carte")} className="flex min-h-[72px] items-center justify-between gap-4 border border-noir px-5 py-4">
      <span><span className="block font-titre text-2xl">{t.carteBoutiques.accueilTitre}</span><span className="block text-sm text-gris">{t.carteBoutiques.accueilTexte}</span></span>
      <span className="etiquette shrink-0">{t.carteBoutiques.accueilLien} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span>
    </Link></section>
    {/* US-27.3 : bloc texte du parrainage, seulement quand il est ouvert. */}
    {parrainage && <section className="px-5 pt-4"><Link href="/parrainage" className="flex min-h-[72px] items-center justify-between gap-4 border border-noir px-5 py-4">
      <span><span className="block font-titre text-2xl">{t.parrainage.accueilTitre}</span><span className="block text-sm text-gris">{t.parrainage.accueilTexte}</span></span>
      <span className="etiquette shrink-0">{t.parrainage.accueilLien} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></span>
    </Link></section>}
    <TuilesAccueil titre={t.accueil.piecesPhares} tuiles={piecesPhares} />
    <main><div className="flex items-center justify-between px-5 pb-4 pt-8"><h2 className="etiquette">{t.accueil.enCeMoment}</h2><Link href={lien("/catalogue")} className="etiquette underline">{t.accueil.toutVoir}</Link></div><Promos initiales={promos} ville={ville.code} /></main>
    <footer className="border-t border-trait px-6 py-6 text-center"><Link href="/espace/connexion" className="etiquette text-gris">{t.accueil.espaceCommercant}</Link></footer>
  </div>;
}

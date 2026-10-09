import Link from "next/link";
import Image from "next/image";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerPromos } from "@/lib/catalogue";
import { CREDIT_GRANDE_PHOTO, GRANDE_PHOTO, TUILES_PIECES_PHARES, TUILES_UNIVERS } from "@/lib/accueil";
import Promos from "@/components/Promos";
import EntetePublic from "@/components/EntetePublic";
import TuilesAccueil from "@/components/TuilesAccueil";

export const dynamic = "force-dynamic";

export default async function Accueil() {
  const client = await creerClientServeur();
  const promos = await chargerPromos(client);
  return <div className="mx-auto w-full max-w-lg">
    <EntetePublic />
    <nav aria-label="Univers" className="flex justify-center gap-6 border-b border-trait px-5 py-3">{TUILES_UNIVERS.map(u => <Link key={u.nom} href={u.lien} className="etiquette inline-flex min-h-11 items-center text-[11px]">{u.nom}</Link>)}</nav>
    <section className="relative flex min-h-[440px] flex-col items-center justify-end gap-4 bg-noir px-6 pb-10 text-center text-blanc">
      <Image src={GRANDE_PHOTO.adresse} alt={GRANDE_PHOTO.alt} fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" style={{ objectPosition: GRANDE_PHOTO.position }} priority />
      {/* Voile sombre, plus marqué en bas : le titre et le bouton restent lisibles sur la photo. */}
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-noir/75 via-noir/30 to-noir/10" />
      <h1 className="relative font-titre text-4xl">Les promos d’Oran</h1>
      <p className="etiquette relative text-[10px] leading-relaxed">Réservez sur WhatsApp · Payez en boutique</p>
      <Link href="/catalogue?promo=1" className="etiquette relative inline-flex min-h-12 items-center bg-blanc px-7 text-noir">Voir les promos</Link>
      <p className="absolute bottom-1.5 end-2 text-[10px] text-blanc/85">Photo : <a href={CREDIT_GRANDE_PHOTO.lienSource} target="_blank" rel="noopener noreferrer" className="underline">{CREDIT_GRANDE_PHOTO.auteur}</a>, <a href={CREDIT_GRANDE_PHOTO.lienLicence} target="_blank" rel="noopener noreferrer license" className="underline">{CREDIT_GRANDE_PHOTO.licence}</a>, {CREDIT_GRANDE_PHOTO.source}</p>
    </section>
    <TuilesAccueil titre="Les univers" tuiles={TUILES_UNIVERS} />
    <TuilesAccueil titre="Pièces phares" tuiles={TUILES_PIECES_PHARES} />
    <main><div className="flex items-center justify-between px-5 pb-4 pt-8"><h2 className="etiquette">En ce moment</h2><Link href="/catalogue" className="etiquette underline">Tout voir</Link></div><Promos initiales={promos} /></main>
    <footer className="border-t border-trait px-6 py-6 text-center"><Link href="/espace/connexion" className="etiquette text-gris">Espace commerçant</Link></footer>
  </div>;
}

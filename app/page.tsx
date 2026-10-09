import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerPromos } from "@/lib/catalogue";
import Promos from "@/components/Promos";

export const dynamic = "force-dynamic";

export default async function Accueil() {
  const promos = await chargerPromos(await creerClientServeur());
  return <div className="mx-auto w-full max-w-lg">
    <header className="flex items-center justify-between border-b border-trait px-5 py-5"><Link href="/" className="font-titre text-xl tracking-[0.2em]">ORANPROMO</Link><Link href="/catalogue" className="etiquette">Rechercher</Link></header>
    <section className="flex min-h-60 flex-col items-center justify-center gap-4 bg-noir px-6 text-center text-blanc"><h1 className="font-titre text-4xl">Les promos d’Oran</h1><p className="etiquette text-[10px] leading-relaxed">Réservez sur WhatsApp · Payez en boutique</p></section>
    <main><div className="flex items-center justify-between px-5 py-6"><h2 className="etiquette">En ce moment</h2><Link href="/catalogue" className="etiquette underline">Tout voir</Link></div><Promos initiales={promos} /></main>
    <footer className="border-t border-trait px-6 py-6 text-center"><Link href="/espace/connexion" className="etiquette text-gris">Espace commerçant</Link></footer>
  </div>;
}

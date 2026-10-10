import type { Metadata } from "next";
import ScannerRetrait from "@/components/ScannerRetrait";
import { getTextes } from "@/lib/langue-serveur";

// US-26.3 : scanner du QR code de retrait (connexion de la boutique : proxy.ts, comme tout /espace).
export async function generateMetadata(): Promise<Metadata> { return { title: (await getTextes()).espace.scanner.titrePage, robots: { index: false, follow: false } }; }

export default async function PageScanner() {
  const e = (await getTextes()).espace;
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">{e.commun.monEspace}</p><h1 className="font-titre text-[28px] font-normal">{e.scanner.titre}</h1></header>
    <ScannerRetrait />
  </main>;
}

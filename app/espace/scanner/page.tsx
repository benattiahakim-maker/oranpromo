import type { Metadata } from "next";
import ScannerRetrait from "@/components/ScannerRetrait";

// US-26.3 : scanner du QR code de retrait (connexion de la boutique : proxy.ts, comme tout /espace).
export const metadata: Metadata = { title: "Scanner un QR code client", robots: { index: false, follow: false } };

export default function PageScanner() {
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon espace</p><h1 className="font-titre text-[28px] font-normal">Scanner le QR code du client</h1></header>
    <ScannerRetrait />
  </main>;
}

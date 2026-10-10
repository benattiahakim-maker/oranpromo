import type { Metadata } from "next";
import { Bodoni_Moda, Jost, Noto_Naskh_Arabic, Tajawal } from "next/font/google";
import FournisseurTextes from "@/components/FournisseurTextes";
import PiedDePage from "@/components/PiedDePage";
import { direction } from "@/lib/langue";
import { getLangue } from "@/lib/langue-serveur";
import { textesDe } from "@/lib/textes";
import "./globals.css";

const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"] });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"] });
// US-23 : polices arabes, en secours des polices latines (téléchargées seulement si une lettre arabe s'affiche).
const tajawal = Tajawal({ variable: "--font-tajawal", subsets: ["arabic"], weight: ["300", "400", "500"], preload: false });
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], weight: ["400", "500"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "BleDeal", template: "%s · BleDeal" },
  // US-30.1 : texte 14 (« ville par ville »).
  description: "Les promos des boutiques près de chez vous, ville par ville. Réservez sur WhatsApp, payez en boutique.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const langue = await getLangue();
  return (
    <html lang={langue} dir={direction(langue)} className={`${bodoni.variable} ${jost.variable} ${tajawal.variable} ${naskh.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><FournisseurTextes langue={langue} textes={textesDe(langue)}>{children}<PiedDePage /></FournisseurTextes></body>
    </html>
  );
}

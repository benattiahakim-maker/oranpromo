import Link from "next/link";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireRetraitBoutique, messageRetraitBoutique, type ResumeRetrait } from "@/lib/retrait";
import RetraitBoutique from "@/components/RetraitBoutique";
import { avecNomBon } from "@/lib/bons-boutique";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { traduireMessage } from "@/lib/textes/messages";

// US-26.3 : page ouverte par le scanner (ou par l'appareil photo du téléphone, le QR code étant ce lien).
// Lecture seule : ouvrir la page ne remet rien ; seule la touche « Remis au client » remet la commande.
// Le jeton est dans l'adresse : pas d'indexation, pas de « Referer ».
export async function generateMetadata(): Promise<Metadata> { return { title: (await getTextes()).espace.retrait.titrePage, robots: { index: false, follow: false }, referrer: "no-referrer" }; }
export const dynamic = "force-dynamic";

export default async function PageRetraitBoutique({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const [langue, textes] = await Promise.all([getLangue(), getTextes()]);
  const t = textes.espace.retrait;
  let resume: ResumeRetrait | null = null, message: string;
  try {
    const client = await creerClientServeur();
    resume = await avecNomBon(client, await lireRetraitBoutique(client, { jeton }));
    message = messageRetraitBoutique(resume, false) ?? "";
  } catch (error) { message = error instanceof Error ? error.message : "Impossible de lire cette commande. Réessayez."; }
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">{textes.espace.commun.monEspace}</p><h1 className="font-titre text-[28px] font-normal">{t.titre}</h1></header>
    {resume?.etat === "ok" && !message
      ? <RetraitBoutique resume={resume} cle={{ jeton }} />
      : <div className="flex flex-col gap-4 px-6 py-6">
        <p role="alert" className="border border-trait p-4 text-[15px]">{traduireMessage(message, langue)}</p>
        <Link href="/espace/scanner" className="etiquette flex min-h-12 items-center justify-center bg-noir text-blanc">{t.scannerAutre}</Link>
        <Link href="/espace/commandes" className="text-center text-sm underline">{t.voirCommandes}</Link>
      </div>}
  </main>;
}

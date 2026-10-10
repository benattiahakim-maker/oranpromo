import Link from "next/link";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { getLangue } from "@/lib/langue-serveur";
import { textesDe } from "@/lib/textes";
import { lireEtatParLien, type EtatLien } from "@/lib/alertes-whatsapp";
import NePlusRecevoir from "@/components/NePlusRecevoir";

// US-31.5 : lien « Ne plus recevoir » du message WhatsApp, sans connexion. Lecture seule au chargement ; l'arrêt se fait
// par le bouton (action serveur). Le jeton est dans l'adresse : pas d'indexation, pas de « Referer » vers d'autres sites.
export const metadata: Metadata = { title: "Alertes WhatsApp", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function PageAlertes({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const t = textesDe(await getLangue()).alertes;
  let etat: EtatLien;
  let erreur = false;
  try { etat = await lireEtatParLien(await creerClientServeur(), jeton); } catch { etat = null; erreur = true; }
  return <main className="mx-auto w-full max-w-lg bg-blanc pb-10 text-noir">
    <header className="flex min-h-12 items-center border-b border-trait px-4"><Link href="/" dir="ltr" className="font-titre text-[22px] leading-none">BleDeal</Link></header>
    <div className="px-6 pt-6">
      <h1 className="font-titre mb-4 text-[24px] font-normal">{t.titre}</h1>
      {erreur ? <p role="alert" className="text-sm">{t.erreur}</p>
        : etat === null ? <p role="status" className="text-sm">{t.lienInvalide}</p>
        : <NePlusRecevoir jeton={jeton} dejaFait={etat === "desactivees"} />}
    </div>
  </main>;
}

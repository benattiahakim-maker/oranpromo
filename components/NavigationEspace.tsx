"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnecter } from "@/app/espace/actions";
import ChoixLangue from "./ChoixLangue";
import { useTextes } from "./FournisseurTextes";
import { remplir } from "@/lib/langue";

// US-32 : lien « Avis » avec le nombre d'avis sans réponse (accessible : « Avis, 2 sans réponse »).
export default function NavigationEspace({ aConfirmer = 0, avisSansReponse = 0 }: { aConfirmer?: number; avisSansReponse?: number }) {
  const chemin = usePathname();
  const t = useTextes().espace.nav;
  if (chemin === "/espace/connexion" || chemin === "/espace/connexion/") return null;
  // US-35 : le sélecteur de langue de l'en-tête public, aussi dans l'espace (même cookie).
  return <nav aria-label={t.titre} className={`mx-auto flex w-full max-w-[390px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-trait px-6 py-4 text-sm print:hidden ${chemin.startsWith("/espace/commandes") ? "lg:max-w-[1120px] lg:px-8" : ""}`}>
    <Link href="/espace" className="inline-flex min-h-11 items-center">{t.mesArticles}</Link>
    <Link href="/espace/commandes" className="inline-flex min-h-11 items-center">{t.commandes}{aConfirmer > 0 ? ` (${aConfirmer})` : ""}</Link>
    <Link href="/espace/avis" aria-label={avisSansReponse > 0 ? remplir(t.avisSansReponse, { n: avisSansReponse }) : undefined} className="inline-flex min-h-11 items-center">{t.avis}{avisSansReponse > 0 ? ` (${avisSansReponse})` : ""}</Link>
    <Link href="/espace/articles/nouveau" className="inline-flex min-h-11 items-center">{t.ajouter}</Link>
    <Link href="/espace/statistiques" className="inline-flex min-h-11 items-center">{t.statistiques}</Link>
    <form action={deconnecter}><button className="min-h-11 cursor-pointer" type="submit">{t.deconnecter}</button></form>
    <ChoixLangue />
  </nav>;
}

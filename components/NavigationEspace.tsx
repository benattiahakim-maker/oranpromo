"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnecter } from "@/app/espace/actions";

export default function NavigationEspace() {
  const chemin = usePathname();
  if (chemin === "/espace/connexion" || chemin === "/espace/connexion/") return null;
  return <nav aria-label="Espace commerçant" className="mx-auto flex w-full max-w-[390px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-trait px-6 py-4 text-sm"><Link href="/espace" className="inline-flex min-h-11 items-center">Mes articles</Link><Link href="/espace/articles/nouveau" className="inline-flex min-h-11 items-center">Ajouter</Link><Link href="/espace/statistiques" className="inline-flex min-h-11 items-center">Statistiques</Link><form action={deconnecter}><button className="min-h-11 cursor-pointer" type="submit">Se déconnecter</button></form></nav>;
}

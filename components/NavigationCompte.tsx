"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnecterClient } from "@/app/compte/actions";

export default function NavigationCompte() {
  const chemin = usePathname();
  if (chemin === "/compte/connexion" || chemin === "/compte/connexion/") return null;
  return <nav aria-label="Mon compte" className="mx-auto flex w-full max-w-lg flex-wrap items-center gap-x-4 gap-y-2 border-b border-trait px-6 py-3 text-sm"><Link href="/compte/commandes" className="inline-flex min-h-11 items-center">Mes commandes</Link><Link href="/compte" className="inline-flex min-h-11 items-center">Mon compte</Link><Link href="/panier" className="inline-flex min-h-11 items-center">Panier</Link><form action={deconnecterClient}><button className="min-h-11 cursor-pointer" type="submit">Se déconnecter</button></form></nav>;
}

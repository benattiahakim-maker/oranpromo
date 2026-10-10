import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { roleAdministration } from "@/lib/boutique";
import type { ReactNode } from "react";
import Link from "next/link";

export default async function Administration({ children }: { children: ReactNode }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error } = await client.from("profils").select("role").eq("id", user.id).maybeSingle();
  if (error) return <main className="mx-auto w-full max-w-[390px] p-6"><p role="alert">Impossible de vérifier votre accès. Réessayez.</p></main>;
  if (!roleAdministration(profil?.role)) return <main className="mx-auto w-full max-w-[390px] p-6"><h1 className="font-titre text-[28px]">Accès réservé</h1></main>;
  return <div className="mx-auto w-full max-w-[390px] bg-blanc font-sans text-noir [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_select:disabled]:opacity-50"><nav aria-label="Administration" className="flex flex-wrap gap-3 border-b border-trait px-6 py-4">{profil.role === "admin" && <Link href="/admin" className="inline-flex min-h-[44px] items-center text-sm">Tableau de bord</Link>}<Link href="/admin/boutiques" className="inline-flex min-h-[44px] items-center text-sm">Boutiques</Link>{profil.role === "admin" && <Link href="/admin/villes" className="inline-flex min-h-[44px] items-center text-sm">Villes</Link>}{profil.role === "admin" && <Link href="/admin/moderation" className="inline-flex min-h-[44px] items-center text-sm">Modération</Link>}{profil.role === "admin" && <Link href="/admin/clients" className="inline-flex min-h-[44px] items-center text-sm">Clients</Link>}{profil.role === "admin" && <Link href="/admin/parrainages" className="inline-flex min-h-[44px] items-center text-sm">Parrainages</Link>}{profil.role === "admin" && <Link href="/admin/remboursements" className="inline-flex min-h-[44px] items-center text-sm">Remboursements</Link>}</nav>{children}</div>;
}

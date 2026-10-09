import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { listerCommandesBoutique, type CommandeRecue, type VueCommandes } from "@/lib/commandes";
import CommandesRecues from "@/components/CommandesRecues";

export const metadata = { title: "Commandes reçues", robots: { index: false, follow: false } };

export default async function PageCommandesRecues({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue: brute } = await searchParams;
  const vue: VueCommandes = brute === "terminees" ? "terminees" : "en_cours";
  const client = await creerClientServeur();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id, boutiques(nom)").eq("id", user.id).maybeSingle();
  const boutique = (profil?.boutiques as unknown as { nom: string } | null)?.nom ?? "votre boutique";
  let commandes: CommandeRecue[] = [], erreur = Boolean(erreurProfil);
  if (profil?.boutique_id) {
    try { commandes = await listerCommandesBoutique(client, profil.boutique_id, vue); } catch { erreur = true; }
  }
  const onglet = (valeur: VueCommandes, texte: string) => <Link href={valeur === "en_cours" ? "/espace/commandes" : "/espace/commandes?vue=terminees"} aria-current={vue === valeur ? "page" : undefined} className={`etiquette flex min-h-11 items-center justify-center ${vue === valeur ? "border-b border-noir" : "text-gris"}`}>{texte}</Link>;
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon espace</p><h1 className="font-titre text-[28px] font-normal">Commandes reçues</h1></header>
    <nav aria-label="Filtrer les commandes" className="grid grid-cols-2 border-b border-trait">{onglet("en_cours", "En cours")}{onglet("terminees", "Terminées")}</nav>
    <div className="px-6">
      {erreur ? <p role="alert" className="py-6">Impossible de charger les commandes. Réessayez.</p>
        : !profil?.boutique_id ? <p className="py-6">Votre compte n&apos;est rattaché à aucune boutique</p>
        : <CommandesRecues commandes={commandes} boutique={boutique} />}
    </div>
  </main>;
}

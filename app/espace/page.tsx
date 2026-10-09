import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import Link from "next/link";
import MesArticles from "@/components/MesArticles";

export default async function Espace({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const supabase = await creerClientServeur();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { erreur } = await searchParams;
  const { data: profil, error: erreurProfil } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  let articles = null;
  let erreurListe = Boolean(erreurProfil);
  if (profil?.boutique_id) {
    const resultat = await supabase.from("articles").select("*, photos(*), tailles(*), promos(*)").eq("boutique_id", profil.boutique_id).order("cree_le", { ascending: false });
    articles = resultat.data;
    erreurListe = Boolean(resultat.error);
  }

  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon espace</p><h1 className="font-titre text-[28px] font-normal">Mes articles</h1></header>
    <div className="px-6">
      {erreurListe ? <p role="alert" className="py-6">Impossible de charger vos articles. Réessayez.</p> : !profil?.boutique_id ? <p className="py-6">Votre compte n&apos;est rattaché à aucune boutique</p> : <MesArticles articles={articles ?? []} />}
      {profil?.boutique_id && <Link href="/espace/articles/nouveau" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir px-4 text-blanc">+ Ajouter un article</Link>}
      {erreur === "deconnexion" && <p role="alert" className="mt-4">Impossible de vous déconnecter. Réessayez.</p>}
      {profil?.boutique_id && <Link href="/espace/statistiques" className="etiquette my-6 flex min-h-[44px] items-center justify-center border border-noir px-4">Mes statistiques</Link>}
    </div>
  </main>;
}

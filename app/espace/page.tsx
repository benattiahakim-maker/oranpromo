import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import Link from "next/link";
import MesArticles from "@/components/MesArticles";
import PartagerBoutique from "@/components/PartagerBoutique";
import PositionEspace, { type ProprietesPositionEspace } from "@/components/PositionEspace";
import { preparerPartageBoutique, type PartageBoutique } from "@/lib/lien-boutique";
import BonsBoutique from "@/components/BonsBoutique";
import { lireRelevesBoutique, type ReleveBoutique } from "@/lib/parrainage-admin";
import { villeLue } from "@/lib/ville";

export default async function Espace({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const supabase = await creerClientServeur();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { erreur } = await searchParams;
  const { data: profil, error: erreurProfil } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  let articles = null;
  let erreurListe = Boolean(erreurProfil);
  let partage: PartageBoutique | null = null;
  let position: ProprietesPositionEspace | null = null;
  let releves: ReleveBoutique[] = [];
  if (profil?.boutique_id) {
    const [resultat, boutique] = await Promise.all([
      supabase.from("articles").select("*, photos(*), tailles(*), promos(*)").eq("boutique_id", profil.boutique_id).order("cree_le", { ascending: false }),
      supabase.from("boutiques").select("nom, slug, statut, latitude, longitude, villes(nom, lat_min, lat_max, lng_min, lng_max, centre_lat, centre_lng)").eq("id", profil.boutique_id).maybeSingle(),
    ]);
    articles = resultat.data;
    erreurListe = Boolean(resultat.error);
    // US-22 : bloc « Partager ma boutique » (sans boutique lisible, pas de bloc, la liste reste affichée).
    if (boutique.data) partage = await preparerPartageBoutique(boutique.data);
    // US-24.2 : bloc « Position sur la carte ».
    // US-29.4 : avec la ville de la boutique (illisible : Oran, comme avant).
    if (boutique.data) position = { statut: boutique.data.statut, latitude: boutique.data.latitude ?? null, longitude: boutique.data.longitude ?? null, zone: villeLue(boutique.data.villes) ?? undefined };
    // US-27.5 : bloc « Bons parrainage à rembourser » (seulement si la boutique a des relevés ; une erreur masque le bloc).
    try { releves = await lireRelevesBoutique(supabase, profil.boutique_id); } catch { releves = []; }
  }

  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon espace</p><h1 className="font-titre text-[28px] font-normal">Mes articles</h1></header>
    <div className="px-6">
      {erreurListe ? <p role="alert" className="py-6">Impossible de charger vos articles. Réessayez.</p> : !profil?.boutique_id ? <div className="py-6"><p>Votre compte n&apos;est rattaché à aucune boutique</p><Link href="/compte/commandes" className="etiquette mt-4 flex min-h-[44px] items-center justify-center border border-noir">Mes commandes</Link></div> : <MesArticles articles={articles ?? []} />}
      {profil?.boutique_id && <Link href="/espace/articles/nouveau" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir px-4 text-blanc">+ Ajouter un article</Link>}
      {erreur === "deconnexion" && <p role="alert" className="mt-4">Impossible de vous déconnecter. Réessayez.</p>}
      {profil?.boutique_id && <Link href="/espace/statistiques" className="etiquette my-6 flex min-h-[44px] items-center justify-center border border-noir px-4">Mes statistiques</Link>}
      <BonsBoutique releves={releves} />
      {position && <PositionEspace {...position} />}
      {partage && <div className="pb-10"><PartagerBoutique partage={partage} /></div>}
    </div>
  </main>;
}

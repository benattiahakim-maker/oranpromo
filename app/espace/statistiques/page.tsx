import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerStatistiques, dureeStatistiques } from "@/lib/statistiques";

export default async function Statistiques({ searchParams }: { searchParams: Promise<{ jours?: string | string[] }> }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  const jours = dureeStatistiques((await searchParams).jours);
  let statistiques = null;
  let erreur = erreurProfil ? "Impossible de charger votre profil. Réessayez." : "";
  if (!erreur && profil?.boutique_id) {
    try { statistiques = await chargerStatistiques(client, profil.boutique_id, jours); }
    catch { erreur = "Impossible de charger vos statistiques. Réessayez."; }
  }
  return <main className="mx-auto w-full max-w-[390px] bg-blanc p-6 text-noir">
    <Link href="/espace" className="etiquette inline-flex min-h-[44px] items-center">← Mes articles</Link>
    <h1 className="my-6 font-titre text-[28px] font-normal">Mes statistiques</h1>
    <nav aria-label="Période des statistiques" className="flex gap-3">{([7, 30] as const).map(duree => <Link key={duree} href={`/espace/statistiques?jours=${duree}`} aria-current={jours === duree ? "page" : undefined} className={`flex min-h-[44px] flex-1 items-center justify-center border border-noir px-3 ${jours === duree ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}>{duree} jours</Link>)}</nav>
    {erreur ? <p role="alert" className="mt-6">{erreur}</p> : !profil?.boutique_id ? <p className="mt-6">Votre compte n&apos;est rattaché à aucune boutique</p> : statistiques && <>
      <p className="my-3 text-sm text-gris">Sur les {jours} derniers jours.</p>
      <dl className="flex flex-col gap-3">{[["Vues de la vitrine", statistiques.vuesBoutique], ["Vues des articles", statistiques.vuesArticles], ["Clics « Réserver »", statistiques.clicsReservation]].map(([libelle, nombre]) => <div key={libelle} className="border-b border-trait py-4"><dt className="etiquette text-gris">{libelle}</dt><dd className="font-titre text-[28px]">{nombre}</dd></div>)}</dl>
      <h2 className="my-6 font-titre text-[28px] font-normal">Les 5 articles les plus vus</h2>
      {statistiques.topArticles.length ? <ol className="flex flex-col gap-3">{statistiques.topArticles.map(article => <li key={article.id} className="border-b border-trait py-4"><p className="break-words">{article.titre}</p><p className="mt-2 text-sm text-gris">{article.vues} vues · {article.clics} clics « Réserver »</p></li>)}</ol> : <p>Aucune vue d’article sur cette période.</p>}
    </>}
  </main>;
}

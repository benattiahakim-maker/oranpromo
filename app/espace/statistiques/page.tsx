import Link from "next/link";
import Isole from "@/components/Isole";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerStatistiques, dureeStatistiques, TITRE_INDISPONIBLE } from "@/lib/statistiques";
import { getLangue } from "@/lib/langue-serveur";
import { textesDe } from "@/lib/textes";
import { remplir } from "@/lib/langue";

export default async function Statistiques({ searchParams }: { searchParams: Promise<{ jours?: string | string[] }> }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  const jours = dureeStatistiques((await searchParams).jours);
  const langue = await getLangue(), e = textesDe(langue).espace, t = e.statistiques;
  let statistiques = null;
  let erreur = erreurProfil ? e.commun.profilImpossible : "";
  if (!erreur && profil?.boutique_id) {
    try { statistiques = await chargerStatistiques(client, profil.boutique_id, jours); }
    catch { erreur = t.impossible; }
  }
  return <main className="mx-auto w-full max-w-[390px] bg-blanc p-6 text-noir">
    <Link href="/espace" className="etiquette inline-flex min-h-[44px] items-center">{e.commun.retourMesArticles}</Link>
    <h1 className="my-6 font-titre text-[28px] font-normal">{t.titre}</h1>
    <nav aria-label={t.periode} className="flex gap-3">{([7, 30] as const).map(duree => <Link key={duree} href={`/espace/statistiques?jours=${duree}`} aria-current={jours === duree ? "page" : undefined} className={`flex min-h-[44px] flex-1 items-center justify-center border border-noir px-3 ${jours === duree ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}>{remplir(t.jours, { n: duree })}</Link>)}</nav>
    {erreur ? <p role="alert" className="mt-6">{erreur}</p> : !profil?.boutique_id ? <p className="mt-6">{e.commun.sansBoutique}</p> : statistiques && <>
      <p className="my-3 text-sm text-gris">{remplir(t.sur, { n: jours })}</p>
      <dl className="flex flex-col gap-3">{[[t.vuesVitrine, statistiques.vuesBoutique], [t.vuesArticles, statistiques.vuesArticles], [t.clics, statistiques.clicsReservation]].map(([libelle, nombre]) => <div key={libelle} className="border-b border-trait py-4"><dt className="etiquette text-gris">{libelle}</dt><dd className="font-titre text-[28px]">{nombre}</dd></div>)}</dl>
      <h2 className="my-6 font-titre text-[28px] font-normal">{t.top}</h2>
      {statistiques.topArticles.length ? <ol className="flex flex-col gap-3">{statistiques.topArticles.map(article => <li key={article.id} className="border-b border-trait py-4"><p className="break-words"><Isole langue={langue}>{article.titre === TITRE_INDISPONIBLE ? t.indisponible : article.titre}</Isole></p><p className="mt-2 text-sm text-gris">{remplir(t.vuesClics, { vues: article.vues, clics: article.clics })}</p></li>)}</ol> : <p>{t.aucune}</p>}
    </>}
  </main>;
}

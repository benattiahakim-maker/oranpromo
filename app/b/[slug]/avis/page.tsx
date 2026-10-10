import type { Metadata } from "next";
import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import NoteBoutique from "@/components/NoteBoutique";
import { ListeAvis } from "@/components/AvisBoutique";
import { creerClientServeur } from "@/lib/supabase/server";
import { AVIS_PAR_PAGE, lireAvisBoutique, lireResumes } from "@/lib/avis";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Avis clients", robots: { index: false, follow: true } };

/** US-32.3 : « Voir tous les avis » d'une boutique, 20 par page, les plus récents d'abord. */
export default async function TousLesAvis({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string | string[] }> }) {
  const [{ slug }, { page: brute }] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Math.min(1000, Math.floor(Number(typeof brute === "string" ? brute : 1)) || 1));
  const supabase = await creerClientServeur();
  const langue = await getLangue();
  const textes = textesDe(langue);
  const t = textes.avis;
  const { data: boutique, error } = await supabase.from("boutiques").select("id, nom").eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (error) throw new Error("Impossible de charger la boutique. Réessayez dans quelques instants.");
  if (!boutique) return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">{textes.vitrine.indisponible}</h1><Link href="/" className="mt-6 inline-block underline">{textes.vitrine.retour}</Link></main></>;
  let resume = null, avis = null;
  try {
    // Un avis de plus que la page : savoir s'il y a une page suivante sans compter.
    [resume, avis] = await Promise.all([lireResumes(supabase, [boutique.id]).then(r => r.get(boutique.id) ?? null), lireAvisBoutique(supabase, boutique.id, AVIS_PAR_PAGE + 1, (page - 1) * AVIS_PAR_PAGE)]);
  } catch { /* message ci-dessous */ }
  const suivante = (avis?.length ?? 0) > AVIS_PAR_PAGE;
  return <div className="mx-auto w-full max-w-lg pb-10">
    <EntetePublic />
    <main className="px-6">
      <header className="border-b border-trait pb-5 pt-6 text-center">
        <h1 dir="auto" className="font-titre text-[26px] font-normal">{remplir(t.tousLesAvis, { boutique: boutique.nom })}</h1>
        {resume && <p className="mt-2"><NoteBoutique resume={resume} t={t} /></p>}
      </header>
      {!avis ? <p role="alert" className="py-6 text-center">{t.chargementImpossible}</p>
        : avis.length ? <ListeAvis avis={avis.slice(0, AVIS_PAR_PAGE)} t={t} langue={langue} /> : <p className="py-6 text-center text-sm text-gris">{t.aucun}</p>}
      <nav aria-label={t.titreSection} className="flex justify-between pt-6">
        {page > 1 && <Link href={`/b/${slug}/avis?page=${page - 1}`} className="border border-noir px-4 py-3 text-sm">{t.precedents}</Link>}
        {suivante && <Link href={`/b/${slug}/avis?page=${page + 1}`} className="ms-auto border border-noir px-4 py-3 text-sm">{t.suivants}</Link>}
      </nav>
      <Link href={`/b/${slug}`} className="etiquette mt-6 flex min-h-11 items-center justify-center border border-noir">{t.retourBoutique}</Link>
    </main>
  </div>;
}

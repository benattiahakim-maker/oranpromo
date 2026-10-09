import Link from "next/link";
import Image from "next/image";
import { creerClientServeur } from "@/lib/supabase/server";
import { formaterPrix, prixAffiche, promoActive } from "@/lib/prix";
import { numeroWhatsApp } from "@/lib/whatsapp";
import { positionBoutique, trierArticlesVitrine } from "@/lib/vitrine";
import PartagerArticle from "@/components/PartagerArticle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await creerClientServeur();
  const { data: boutique } = await supabase.from("boutiques").select("id, nom, quartier, adresse").eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (!boutique) return { title: "Boutique indisponible", robots: { index: false, follow: false } };
  const { data: articles } = await supabase.from("articles").select("photos(adresse, ordre)").eq("boutique_id", boutique.id).eq("statut", "disponible").order("cree_le", { ascending: false }).limit(1);
  const photo = [...(articles?.[0]?.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];
  return { title: boutique.nom, description: `${boutique.nom} · ${boutique.quartier} · Les articles disponibles à Oran.`, openGraph: { title: boutique.nom, description: `${boutique.quartier} · ${boutique.adresse ?? "Oran"}`, url: `/b/${slug}`, type: "website", images: photo ? [{ url: photo.adresse, alt: boutique.nom }] : [] } };
}

export default async function Vitrine({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await creerClientServeur();
  const { data: boutique, error } = await supabase.from("boutiques")
    .select("id, nom, quartier, adresse, horaires, whatsapp, latitude, longitude")
    .eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (error) throw new Error("Impossible de charger la boutique. Réessayez dans quelques instants.");
  if (!boutique) return <main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">Boutique indisponible</h1><Link href="/" className="mt-6 inline-block underline">Retour à l’accueil</Link></main>;

  const { data: articles, error: erreurArticles } = await supabase.from("articles")
    .select("id, titre, prix, cree_le, promos(prix_promo, date_fin), photos(adresse, adresse_vignette, ordre)")
    .eq("boutique_id", boutique.id).eq("statut", "disponible");
  if (erreurArticles) throw new Error("Impossible de charger les articles de la boutique.");
  const maintenant = new Date();
  const liste = trierArticlesVitrine((articles ?? []).map(article => {
    const promotion = Array.isArray(article.promos) ? article.promos[0] : article.promos;
    return { ...article, promo: promotion ? { prixPromo: promotion.prix_promo, dateFin: promotion.date_fin } : null };
  }), maintenant);
  const position = positionBoutique(boutique.latitude, boutique.longitude, boutique.adresse, boutique.quartier);
  const itineraire = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(position)}`;

  return <div className="mx-auto w-full max-w-lg pb-10">
    <header className="relative flex items-center gap-4 border-b border-trait px-4 py-3"><Link href="/" aria-label="Retour à l’accueil" className="flex h-11 w-11 items-center justify-center">←</Link><span className="font-titre text-xl tracking-[0.2em]">ORANPROMO</span><PartagerArticle titre={boutique.nom} libelle="Partager la boutique" /></header>
    <section className="flex flex-col gap-3 px-6 py-8 text-center">
      <p className="etiquette text-gris">{boutique.quartier}</p>
      <h1 className="font-titre break-words text-3xl">{boutique.nom}</h1>
      <p className="text-sm font-light">{boutique.adresse ?? "Adresse non renseignée"}</p>
      <p className="whitespace-pre-line text-sm text-gris">{boutique.horaires ?? "Horaires non renseignés"}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <a href={`https://wa.me/${numeroWhatsApp(boutique.whatsapp)}`} className="etiquette flex min-h-12 items-center justify-center bg-noir px-2 text-blanc">WhatsApp</a>
        <a href={itineraire} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-12 items-center justify-center border border-noir px-2">Itinéraire</a>
      </div>
    </section>
    <section aria-label="Localisation de la boutique" className="px-6 pb-6">
      <iframe title={`Carte : ${boutique.nom}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(position)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" className="h-52 w-full border-0" />
      <a href={itineraire} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-sm underline">Itinéraire vers {boutique.nom}</a>
    </section>
    <main>
      <h2 className="etiquette border-y border-trait py-4 text-center">Articles disponibles · promos en premier</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-5">{liste.map(article => {
        const photo = [...(article.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];
        const enPromo = promoActive(article.promo, maintenant);
        return <Link key={article.id} href={`/a/${article.id}`} className="min-w-0 text-center">
          <div className="relative aspect-[4/5] bg-fond-photo">{photo ? <Image src={photo.adresse_vignette ?? photo.adresse} alt={article.titre} fill sizes="(max-width: 512px) 45vw, 230px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-xs text-gris">Aucune photo</span>}</div>
          <h3 className="mt-3 break-words text-sm font-light">{article.titre}</h3>
          <p className="mt-1 text-sm">{enPromo && <del className="mr-2 text-gris">{formaterPrix(article.prix)}</del>}{formaterPrix(prixAffiche(article.prix, article.promo, maintenant))}</p>
        </Link>;
      })}</div>
      {!liste.length && <p className="px-6 py-8 text-center text-sm text-gris">Aucun article disponible pour le moment.</p>}
    </main>
  </div>;
}

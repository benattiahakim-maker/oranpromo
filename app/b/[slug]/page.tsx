import type { Metadata } from "next";
import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import Image from "next/image";
import { creerClientServeur } from "@/lib/supabase/server";
import { formaterPrix, prixAffiche, promoActive } from "@/lib/prix";
import { numeroWhatsApp } from "@/lib/whatsapp";
import { positionBoutique, trierArticlesVitrine } from "@/lib/vitrine";
import { lienItineraire } from "@/lib/carte";
import { villeLue } from "@/lib/ville";
import PartagerArticle from "@/components/PartagerArticle";
import EnregistrerVue from "@/components/EnregistrerVue";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import BoutonSuivre from "@/components/BoutonSuivre";
import { cookies } from "next/headers";
import { COOKIE_SUIVRE, estSuivie } from "@/lib/abonnements";
import { COOKIE_INSCRIPTION } from "@/lib/inscription-boutique";
import BienvenueBoutique from "@/components/BienvenueBoutique";
import AvisBoutique from "@/components/AvisBoutique";
import NoteBoutique from "@/components/NoteBoutique";
import { DERNIERS_AVIS, lireAvisBoutique, lireResumes } from "@/lib/avis";
import { chargerApercuBoutique, METADONNEES_BOUTIQUE_INDISPONIBLE, metadonneesBoutique } from "@/lib/lien-boutique";

export const dynamic = "force-dynamic";

// US-03, US-22 : aperçu du lien dans WhatsApp, Facebook, Instagram, X (boutique validée seulement).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const apercu = await chargerApercuBoutique(await creerClientServeur(), slug);
  return apercu ? metadonneesBoutique(apercu) : METADONNEES_BOUTIQUE_INDISPONIBLE;
}

export default async function Vitrine({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await creerClientServeur();
  const langue = await getLangue();
  const t = textesDe(langue).vitrine;
  const { data: boutique, error } = await supabase.from("boutiques")
    .select("id, nom, quartier, adresse, horaires, whatsapp, latitude, longitude, villes(nom, nom_ar)")
    .eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (error) throw new Error("Impossible de charger la boutique. Réessayez dans quelques instants.");
  if (!boutique) return <><EntetePublic /><main className="mx-auto w-full max-w-lg px-6 py-16 text-center"><h1 className="font-titre text-3xl">{t.indisponible}</h1><Link href="/" className="mt-6 inline-block underline">{t.retour}</Link></main></>;

  const { data: articles, error: erreurArticles } = await supabase.from("articles")
    .select("id, titre, prix, cree_le, promos(prix_promo, date_fin), photos(adresse, adresse_vignette, ordre)")
    .eq("boutique_id", boutique.id).eq("statut", "disponible");
  if (erreurArticles) throw new Error("Impossible de charger les articles de la boutique.");
  // US-31.2 : bouton « Suivre » pour les visiteurs et les clients (pas pour les comptes commerçant ou admin).
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profil } = user ? await supabase.from("profils").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const afficherSuivre = !user || profil?.role === "client";
  const suivie = user && afficherSuivre ? await estSuivie(supabase, boutique.id) : false;
  // US-31.3 : QR code de l'affiche (cookie posé par /i/<slug>) → bandeau d'accueil, puis suivi et rattachement une fois connecté.
  const magasin = await cookies();
  const inscription = magasin.get(COOKIE_INSCRIPTION)?.value === slug;
  const apresConnexion = !user ? null : inscription ? "inscription" : magasin.get(COOKIE_SUIVRE)?.value === slug ? "suivre" : null;
  // US-32.3 : note, critères et derniers avis (lecture publique par les fonctions de la base ; sans eux, la vitrine s'affiche).
  const tAvis = textesDe(langue).avis;
  const [resume, derniersAvis] = await Promise.all([
    lireResumes(supabase, [boutique.id]).then(r => r.get(boutique.id) ?? null).catch(() => null),
    lireAvisBoutique(supabase, boutique.id, DERNIERS_AVIS).catch(() => null),
  ]);
  const maintenant = new Date();
  const liste = trierArticlesVitrine((articles ?? []).map(article => {
    const promotion = Array.isArray(article.promos) ? article.promos[0] : article.promos;
    return { ...article, promo: promotion ? { prixPromo: promotion.prix_promo, dateFin: promotion.date_fin } : null };
  }), maintenant);
  // US-29.3 : ville de la boutique (null si elle est fermée : le lien reste ouvert, sans nom de ville).
  const villeBoutique = villeLue(boutique.villes);
  const ville = villeBoutique?.nom ?? null;
  const position = positionBoutique(boutique.latitude, boutique.longitude, boutique.adresse, boutique.quartier, ville);
  const itineraire = lienItineraire({ ...boutique, ville }); // US-24.3 : même lien que la mini-fiche de /carte

  return <div className="mx-auto w-full max-w-lg pb-10">
    <EnregistrerVue boutiqueId={boutique.id} />
    <EntetePublic /><div className="relative h-11"><PartagerArticle titre={boutique.nom} boutiqueId={boutique.id} libelle={t.partager} /></div>
    {inscription && !user && <BienvenueBoutique nom={boutique.nom} slug={slug} t={textesDe(langue).suivre} />}
    <section className="flex flex-col gap-3 px-6 py-8 text-center">
      <p className="etiquette text-gris">{boutique.quartier}{villeBoutique && ` · ${langue === "ar" ? villeBoutique.nom_ar : villeBoutique.nom}`}</p>
      <h1 dir="auto" className="font-titre break-words text-3xl">{boutique.nom}</h1>
      {resume && <a href="#avis" className="text-sm underline-offset-2 hover:underline"><NoteBoutique resume={resume} t={tAvis} /></a>}
      {afficherSuivre && <BoutonSuivre boutiqueId={boutique.id} slug={slug} nom={boutique.nom} connecte={Boolean(user)} suivieAuDepart={suivie} apresConnexion={apresConnexion} />}
      <p dir="auto" className="text-sm font-light">{boutique.adresse ?? t.adresseInconnue}</p>
      <p dir="auto" className="whitespace-pre-line text-sm text-gris">{boutique.horaires ?? t.horairesInconnus}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <a href={`https://wa.me/${numeroWhatsApp(boutique.whatsapp)}`} className="etiquette flex min-h-12 items-center justify-center bg-noir px-2 text-blanc">{t.whatsapp}</a>
        <a href={itineraire} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-12 items-center justify-center border border-noir px-2">{t.itineraire}</a>
      </div>
    </section>
    <section aria-label={t.localisation} className="px-6 pb-6">
      <iframe title={remplir(t.carte, { nom: boutique.nom })} src={`https://maps.google.com/maps?q=${encodeURIComponent(position)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" className="h-52 w-full border-0" />
      <a href={itineraire} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-sm underline">{remplir(t.itineraireVers, { nom: boutique.nom })}</a>
    </section>
    <main>
      <h2 className="etiquette border-y border-trait py-4 text-center">{t.articles}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-5">{liste.map(article => {
        const photo = [...(article.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];
        const enPromo = promoActive(article.promo, maintenant);
        return <Link key={article.id} href={`/a/${article.id}`} className="min-w-0 text-center">
          <div className="relative aspect-[4/5] bg-fond-photo">{photo ? <Image src={photo.adresse_vignette ?? photo.adresse} alt={article.titre} fill sizes="(max-width: 512px) 45vw, 230px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-xs text-gris">{textesDe(langue).carte.aucunePhoto}</span>}</div>
          <h3 dir="auto" className="mt-3 break-words text-sm font-light">{article.titre}</h3>
          <p className="mt-1 text-sm">{enPromo && <del className="me-2 text-gris">{formaterPrix(article.prix, langue)}</del>}{formaterPrix(prixAffiche(article.prix, article.promo, maintenant), langue)}</p>
        </Link>;
      })}</div>
      {!liste.length && <p className="px-6 py-8 text-center text-sm text-gris">{t.aucun}</p>}
    </main>
    {resume && derniersAvis && <AvisBoutique resume={resume} avis={derniersAvis} slug={slug} t={tAvis} langue={langue} />}
  </div>;
}

import { notFound } from "next/navigation";
import Prix from "@/components/Prix";
import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import GalerieArticle from "@/components/GalerieArticle";
import PartagerArticle from "@/components/PartagerArticle";
import CommandeArticle from "@/components/CommandeArticle";
import SignalerArticle from "@/components/SignalerArticle";
import EnregistrerVue from "@/components/EnregistrerVue";
import { creerClientServeur } from "@/lib/supabase/server";
import { getLangue } from "@/lib/langue-serveur";
import { estCategorieBeaute } from "@/lib/article";
import { remplir, type Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import { lireResumes } from "@/lib/avis";
import { texteNote } from "@/components/NoteBoutique";
import { 
  formaterPrix, 
  prixAffiche, 
  promoActive,
  pourcentageReduction,
  Promo 
} from "@/lib/prix";

// Define the props type for the page component
interface ArticlePageProps {
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

// Date de fin de promo : « 18 OCTOBRE 2026 » ; en arabe (US-23) « 18 أكتوبر 2026 », chiffres 0-9.
function formatDate(dateString: string, langue: Langue = "fr"): string {
  const date = new Date(dateString);
  const texte = date.toLocaleDateString(langue === "ar" ? "ar-DZ-u-nu-latn" : "fr-DZ", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return langue === "ar" ? texte : texte.toUpperCase();
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { id } = await params;
  const supabase = await creerClientServeur();
  
  const { data: article, error } = await supabase
    .from("articles")
    .select(`
      id,
      titre,
      prix,
      description,
      boutique_id,
      statut,
      boutiques (nom),
      promos (prix_promo, date_fin),
      photos(adresse, ordre)
    `)
    .eq("id", id)
    .single();

  if (error || !article) {
    return { title: "Article non trouvé" };
  }

  const promo = Array.isArray(article.promos) ? article.promos[0] : article.promos;
  const prixAfficheValue = prixAffiche(article.prix, promo ? { 
    prixPromo: promo.prix_promo, 
    dateFin: promo.date_fin 
  } : null);

  const boutiques = Array.isArray(article.boutiques) ? article.boutiques[0] : article.boutiques;

  return {
    title: `${article.titre} · ${boutiques?.nom || ''}`,
    description: article.description || `Découvrez ${article.titre} à ${formaterPrix(prixAfficheValue)} chez ${boutiques?.nom || ''}`,
    openGraph: {
      title: `${article.titre} · ${formaterPrix(prixAfficheValue)}`,
      description: `${formaterPrix(prixAfficheValue)} · ${article.description || boutiques?.nom || "BleDeal"}`,
      images: [...(article.photos ?? [])].sort((a, b) => a.ordre - b.ordre).slice(0, 1).map(photo => ({ url: photo.adresse, alt: article.titre })),
      url: `/a/${id}`,
      type: "website",
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const supabase = await creerClientServeur();
  const langue = await getLangue();
  const t = textesDe(langue);

  // Fetch article with related data
  const { data: article, error } = await supabase
    .from("articles")
    .select(`
      id,
      titre,
      prix,
      description,
      boutique_id,
      statut,
      categorie,
      couleur,
      genre,
      description_ar,
      cree_le,
      derniere_confirmation,
      boutiques (nom, quartier, slug, whatsapp),
      promos (prix_promo, date_fin, badge),
      photos(adresse, adresse_vignette, ordre),
      tailles(libelle, disponible, quantite)
    `)
    .eq("id", id)
    .single();

  if (error || !article) {
    notFound();
  }

  const boutiques = Array.isArray(article.boutiques) ? article.boutiques[0] : article.boutiques;
  const promos = Array.isArray(article.promos) ? article.promos[0] : article.promos;
  const photos = article.photos?.sort((a, b) => a.ordre - b.ordre) || [];
  const tailles = article.tailles || [];
  // US-32.3 : note de la boutique (une lecture ; sans elle, la fiche s'affiche sans note).
  const resumeBoutique = await lireResumes(supabase, [article.boutique_id]).then(r => r.get(article.boutique_id)).catch(() => undefined);
  const noteBoutique = texteNote({ resume: resumeBoutique, t: t.avis, forme: "fiche" });

  const promo = promos;

  // Check if article is sold
  if (article.statut === "vendu") {
    // Fetch other articles from the same boutique
    const { data: autresArticles } = await supabase
      .from("articles")
      .select(`
        id,
        titre,
        prix,
        boutiques (nom),
        promos (prix_promo, date_fin)
      `)
      .eq("boutique_id", article.boutique_id)
      .eq("statut", "disponible")
      .limit(4);

    return (
      <div className="min-h-screen bg-blanc">
        <EntetePublic />
        <div className="relative h-96 bg-fond-photo flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-noir mb-4">{t.fiche.plusDisponible}</div>
            <p className="text-gris">{t.fiche.vendu}</p>
          </div>
        </div>

        <main className="px-6 py-8">
          <div className="mb-8">
            <h1 dir="auto" className="font-titre text-2xl text-center mb-2">{article.titre}</h1>
            <p className="text-center etiquette text-gris uppercase">
              {boutiques?.nom} · {boutiques?.quartier}
            </p>
          </div>

          <div className="mb-8">
            <h2 className="etiquette text-gris mb-4 text-center">{t.fiche.autresArticles}</h2>
            <div className="space-y-4">
              {autresArticles && autresArticles.length > 0 ? (
                autresArticles.map((autreArticle) => {
                  const autrePromos = Array.isArray(autreArticle.promos) ? autreArticle.promos[0] : autreArticle.promos;
                  const autrePrixAffiche = prixAffiche(
                    autreArticle.prix,
                    autrePromos ? { 
                      prixPromo: autrePromos.prix_promo, 
                      dateFin: autrePromos.date_fin 
                    } : null
                  );

                  return (
                    <Link href={`/a/${autreArticle.id}`}
                      key={autreArticle.id} 
                      className="block border border-trait p-4 hover:bg-fond-photo transition-colors"
                    >
                      <h3 className="font-medium">{autreArticle.titre}</h3>
                      <p className="text-sm text-gris mt-1">
                        <Prix montant={autrePrixAffiche} langue={langue} />
                      </p>
                    </Link>
                  );
                })
              ) : (
                <p className="text-center text-gris">{t.fiche.aucunAutre}</p>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Regular article display
  const promoData: Promo | null = promo ? { 
    prixPromo: promo.prix_promo, 
    dateFin: promo.date_fin 
  } : null;

  const prixAfficheValue = prixAffiche(article.prix, promoData);
  const isPromoActive = promoActive(promoData);

  return (
    <div className="mx-auto w-full max-w-lg min-h-screen bg-blanc">
      <EntetePublic />
      <EnregistrerVue boutiqueId={article.boutique_id} articleId={article.id} />
      {/* Photo carousel */}
      <div className="relative bg-fond-photo">
        {photos.length > 0 ? (
          <GalerieArticle photos={photos.slice(0, 5)} titre={article.titre} />
        ) : (
          <div className="flex h-96 items-center justify-center text-center">
            <div className="w-32 h-32 bg-gris/10 flex items-center justify-center mx-auto mb-4">
              <span className="etiquette text-gris text-sm">{t.fiche.aucunePhoto}</span>
            </div>
          </div>
        )}
        
        <Link 
          href="/"
          aria-label={t.fiche.retour}
          className="absolute top-3 start-2 w-11 h-11 flex items-center justify-center bg-blanc/80 backdrop-blur-sm"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.2">
            {/* US-23 : en arabe, la flèche retour pointe vers la droite. */}
            <path d={langue === "ar" ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}></path>
          </svg>
        </Link>
        
        <PartagerArticle titre={article.titre} boutiqueId={article.boutique_id} articleId={article.id} />
      </div>

      <main className="px-6 pt-6 pb-0 flex flex-col gap-6 text-center">
        {/* Boutique info and title */}
        <div className="flex flex-col gap-3">
          <a 
            href={`/b/${boutiques?.slug}`} 
            className="etiquette text-gris hover:underline"
          >
            {boutiques?.nom} · {boutiques?.quartier}
          </a>
          {/* US-32.3 : « Boutique Nour · ★ 4,6 (18 avis) », lien vers les avis de la vitrine (rien sous le seuil de 3 avis). */}
          {noteBoutique && <a href={`/b/${boutiques?.slug}#avis`} className="text-sm hover:underline">{boutiques?.nom} · {noteBoutique}</a>}
          <h1 dir="auto" className="font-titre text-2xl leading-tight">{article.titre}</h1>
          
          {/* Price display */}
          <div className="text-lg">
            {isPromoActive && (
              <>
                <span className="text-gris line-through me-2"><Prix montant={article.prix} langue={langue} /></span>
                <Prix montant={prixAfficheValue} langue={langue} />
              </>
            )}
            {!isPromoActive && <Prix montant={prixAfficheValue} langue={langue} />}
          </div>
          
          {isPromoActive && promo?.date_fin && (
            <div className="etiquette text-gris tracking-wider">
              {promo?.badge || remplir(t.carte.reduction, { n: pourcentageReduction(article.prix, promo.prix_promo) })}
              {" "}{remplir(t.fiche.jusquAu, { date: formatDate(promo.date_fin, langue) })}
            </div>
          )}
        </div>


        {/* Description */}
        {/* US-23 : en arabe, la description arabe du commerçant (US-15) passe en premier ; la française reste en dessous. */}
        {langue === "ar" && article.description_ar && <p dir="rtl" lang="ar" className="whitespace-pre-line break-words text-base font-light leading-relaxed text-noir">{article.description_ar}</p>}
        {article.description && (
          <p dir="auto" lang="fr" className="text-base font-light leading-relaxed text-noir/80">
            {article.description}
          </p>
        )}
        {langue !== "ar" && article.description_ar && <p dir="rtl" lang="ar" className="whitespace-pre-line break-words text-base font-light leading-relaxed text-noir">{article.description_ar}</p>}
      </main>

      {boutiques?.whatsapp && <CommandeArticle articleId={article.id} boutique={{ id: article.boutique_id, nom: boutiques.nom, whatsapp: boutiques.whatsapp }} titre={article.titre} prix={prixAfficheValue} photo={photos[0]?.adresse_vignette ?? photos[0]?.adresse ?? null} tailles={tailles} beaute={estCategorieBeaute(article.categorie)} />}
      <SignalerArticle articleId={article.id} />
    </div>
  );
}

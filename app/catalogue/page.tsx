import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import { creerClientServeur } from "@/lib/supabase/server";
import { ARTICLES_PAR_PAGE, catalogueBeaute, chargerCatalogue, chargerOptionsCatalogue, type FiltresCatalogue } from "@/lib/catalogue";
import CarteArticle from "@/components/CarteArticle";
import { GENRES_ARTICLE, UNIVERS, afficherTaille, estCategorieBeaute } from "@/lib/article";
import { getLangue, getTextes } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { traduire } from "@/lib/textes";

export const dynamic = "force-dynamic";

export default async function Catalogue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const valeur = (nom: string) => typeof params[nom] === "string" ? params[nom] as string : "";
  const nombre = (nom: string) => valeur(nom) && Number.isFinite(Number(valeur(nom))) && Number(valeur(nom)) >= 0 ? Number(valeur(nom)) : undefined;
  const filtres: FiltresCatalogue = { q: valeur("q"), univers: valeur("univers"), categorie: valeur("categorie"), taille: valeur("taille"), genre: valeur("genre"), min: nombre("min"), max: nombre("max"), quartier: valeur("quartier"), promo: valeur("promo") === "1" };
  const client = await creerClientServeur();
  const [t, langue] = await Promise.all([getTextes(), getLangue()]);
  const tc = t.catalogue;
  const [resultats, { categories, tailles, contenances, quartiers }] = await Promise.all([chargerCatalogue(client, filtres), chargerOptionsCatalogue(client)]);
  const page = Math.max(1, Math.floor(nombre("page") ?? 1));
  const lienPage = (numero: number) => {
    const query = new URLSearchParams();
    for (const nom of ["q", "univers", "categorie", "taille", "genre", "min", "max", "quartier", "promo"]) if (valeur(nom)) query.set(nom, valeur(nom));
    query.set("page", String(numero)); return `/catalogue?${query}`;
  };
  // US-23 : la valeur envoyée reste en français (filtre), seul le libellé affiché est traduit.
  const select = (nom: string, libelle: string, options: string[], noms: Record<string, string> = {}) => <label className="flex flex-col gap-2 text-sm">{libelle}<select name={nom} defaultValue={valeur(nom)} className="min-h-11 min-w-0 border border-trait bg-blanc px-2"><option value="">{tc.tous}</option>{options.map(option => <option key={option} value={option}>{traduire(noms, option)}</option>)}</select></label>;
  const univers = UNIVERS.find(u => u.cle === valeur("univers"));
  // US-25.2 : univers Beauté (ou catégorie beauté) → « Contenance » triée par volume, « Pour elle / Pour lui / Mixte ».
  const beaute = catalogueBeaute(filtres);
  const selectTaille = beaute
    ? select("taille", tc.contenance, contenances, Object.fromEntries(contenances.map(c => [c, c === "Unique" ? t.listes.tailleUnique : afficherTaille(c, langue)])))
    : select("taille", tc.taille, tailles, { Unique: t.listes.tailleUnique });
  const selectGenre = beaute ? select("genre", tc.pour, Object.keys(t.listes.genresBeaute), t.listes.genresBeaute) : select("genre", tc.genre, [...GENRES_ARTICLE], t.listes.genres);
  const categoriesBeaute = categories.filter(estCategorieBeaute);
  const raccourci = (libelle: string, categorie: string) => <li key={categorie || "tout"}><Link href={categorie ? `/catalogue?univers=beaute&categorie=${encodeURIComponent(categorie)}` : "/catalogue?univers=beaute"} aria-current={valeur("categorie") === categorie ? "page" : undefined} className={`etiquette flex min-h-11 items-center whitespace-nowrap border px-3 ${valeur("categorie") === categorie ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{libelle}</Link></li>;
  const seulementUnivers = Object.keys(params).every(nom => ["univers", "page"].includes(nom));
  const groupe = (nom: string, liste: string[]) => liste.length ? <optgroup label={nom}>{liste.map(option => <option key={option} value={option}>{traduire(t.listes.categories, option)}</option>)}</optgroup> : null;
  const selectCategorie = <label className="flex flex-col gap-2 text-sm">{tc.categorie}<select name="categorie" defaultValue={valeur("categorie")} className="min-h-11 min-w-0 border border-trait bg-blanc px-2"><option value="">{tc.toutes}</option>{groupe(t.listes.groupesCategories.mode, categories.filter(c => !estCategorieBeaute(c)))}{groupe(t.listes.groupesCategories.beaute, categories.filter(estCategorieBeaute))}</select></label>;
  const selectUnivers = <label className="flex flex-col gap-2 text-sm">{tc.univers}<select name="univers" defaultValue={valeur("univers")} className="min-h-11 min-w-0 border border-trait bg-blanc px-2"><option value="">{tc.tous}</option>{UNIVERS.map(u => <option key={u.cle} value={u.cle}>{t.listes.univers[u.cle]}</option>)}</select></label>;
  return <div className="mx-auto w-full max-w-lg pb-10">
    <EntetePublic />
    <main>
      <h1 className="font-titre px-5 pt-6 text-3xl">{univers ? t.listes.univers[univers.cle] : tc.titre}</h1>
      {univers?.cle === "beaute" && categoriesBeaute.length > 0 && <nav aria-label={tc.categoriesBeaute} className="overflow-x-auto px-5 pt-4"><ul className="flex gap-2">{raccourci(tc.tout, "")}{categoriesBeaute.map(c => raccourci(traduire(t.listes.raccourcisBeaute, c), c))}</ul></nav>}
      <form key={JSON.stringify(params)} action="/catalogue" method="get" className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-2 text-sm">{tc.rechercherArticle}<input type="search" name="q" defaultValue={valeur("q")} placeholder={tc.exemple} className="min-h-12 border border-trait px-3" /></label>
        <details open={Object.keys(params).some(nom => !["q", "page"].includes(nom))} className="border-y border-trait py-3"><summary className="etiquette cursor-pointer py-2">{tc.filtres}</summary><div className="mt-4 grid grid-cols-2 gap-4">
          {selectUnivers}{selectCategorie}{selectTaille}{selectGenre}{select("quartier", tc.quartier, quartiers)}
          <label className="flex flex-col gap-2 text-sm">{tc.prixMin}<input type="number" name="min" min="0" step="1" defaultValue={valeur("min")} className="min-h-11 w-full border border-trait px-2" /></label>
          <label className="flex flex-col gap-2 text-sm">{tc.prixMax}<input type="number" name="max" min="0" step="1" defaultValue={valeur("max")} className="min-h-11 w-full border border-trait px-2" /></label>
          <label className="col-span-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="promo" value="1" defaultChecked={valeur("promo") === "1"} />{tc.enPromo}</label>
        </div></details>
        <button className="etiquette min-h-12 bg-noir text-blanc">{tc.rechercher}</button><Link href="/catalogue" className="text-center text-sm underline">{tc.effacer}</Link>
      </form>
      <p role="status" className="px-5 pb-5 text-sm text-gris">{remplir(resultats.length > 1 ? tc.resultats : tc.unResultat, { n: resultats.length })}</p>
      {resultats.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-5">{resultats.slice((page - 1) * ARTICLES_PAR_PAGE, page * ARTICLES_PAR_PAGE).map(article => <CarteArticle key={article.id} article={article} />)}</div> : <p className="px-5 py-8 text-center">{univers?.cle === "beaute" && seulementUnivers ? tc.aucunBeaute : tc.aucun}</p>}
      <nav aria-label={tc.pagination} className="flex justify-between px-5 pt-8">{page > 1 && <Link href={lienPage(page - 1)} className="border border-noir px-4 py-3">{tc.precedent}</Link>}{page * ARTICLES_PAR_PAGE < resultats.length && <Link href={lienPage(page + 1)} className="ms-auto border border-noir px-4 py-3">{tc.suivant}</Link>}</nav>
    </main>
  </div>;
}

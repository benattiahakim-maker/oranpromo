import Link from "next/link";
import EntetePublic from "@/components/EntetePublic";
import { creerClientServeur } from "@/lib/supabase/server";
import { chargerCatalogue, filtrerCatalogue } from "@/lib/catalogue";
import CarteArticle from "@/components/CarteArticle";

export const dynamic = "force-dynamic";

export default async function Catalogue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const valeur = (nom: string) => typeof params[nom] === "string" ? params[nom] as string : "";
  const nombre = (nom: string) => valeur(nom) && Number.isFinite(Number(valeur(nom))) && Number(valeur(nom)) >= 0 ? Number(valeur(nom)) : undefined;
  const articles = await chargerCatalogue(await creerClientServeur());
  const resultats = filtrerCatalogue(articles, { q: valeur("q"), categorie: valeur("categorie"), taille: valeur("taille"), genre: valeur("genre"), min: nombre("min"), max: nombre("max"), quartier: valeur("quartier"), promo: valeur("promo") === "1" });
  const categories = [...new Set(articles.map(a => a.categorie))].sort();
  const tailles = [...new Set(articles.flatMap(a => a.tailles))].sort();
  const quartiers = [...new Set(articles.map(a => a.boutique.quartier))].sort();
  const page = Math.max(1, Math.floor(nombre("page") ?? 1));
  const lienPage = (numero: number) => {
    const query = new URLSearchParams();
    for (const nom of ["q", "categorie", "taille", "genre", "min", "max", "quartier", "promo"]) if (valeur(nom)) query.set(nom, valeur(nom));
    query.set("page", String(numero)); return `/catalogue?${query}`;
  };
  const select = (nom: string, libelle: string, options: string[]) => <label className="flex flex-col gap-2 text-sm">{libelle}<select name={nom} defaultValue={valeur(nom)} className="min-h-11 min-w-0 border border-trait bg-blanc px-2"><option value="">Tous</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
  return <div className="mx-auto w-full max-w-lg pb-10">
    <EntetePublic />
    <main>
      <h1 className="font-titre px-5 pt-6 text-3xl">Le catalogue</h1>
      <form key={JSON.stringify(params)} action="/catalogue" method="get" className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-2 text-sm">Rechercher un article<input type="search" name="q" defaultValue={valeur("q")} placeholder="Polo, jean, robe…" className="min-h-12 border border-trait px-3" /></label>
        <details open={Object.keys(params).some(nom => !["q", "page"].includes(nom))} className="border-y border-trait py-3"><summary className="etiquette cursor-pointer py-2">Filtres</summary><div className="mt-4 grid grid-cols-2 gap-4">
          {select("categorie", "Catégorie", categories)}{select("taille", "Taille", tailles)}{select("genre", "Genre", ["homme", "femme", "enfant", "mixte"])}{select("quartier", "Quartier", quartiers)}
          <label className="flex flex-col gap-2 text-sm">Prix minimum (DA)<input type="number" name="min" min="0" step="1" defaultValue={valeur("min")} className="min-h-11 w-full border border-trait px-2" /></label>
          <label className="flex flex-col gap-2 text-sm">Prix maximum (DA)<input type="number" name="max" min="0" step="1" defaultValue={valeur("max")} className="min-h-11 w-full border border-trait px-2" /></label>
          <label className="col-span-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="promo" value="1" defaultChecked={valeur("promo") === "1"} />En promo seulement</label>
        </div></details>
        <button className="etiquette min-h-12 bg-noir text-blanc">Rechercher</button><Link href="/catalogue" className="text-center text-sm underline">Effacer les filtres</Link>
      </form>
      <p role="status" className="px-5 pb-5 text-sm text-gris">{resultats.length} résultat{resultats.length > 1 ? "s" : ""}</p>
      {resultats.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-5">{resultats.slice((page - 1) * 20, page * 20).map(article => <CarteArticle key={article.id} article={article} />)}</div> : <p className="px-5 py-8 text-center">Aucun article ne correspond à votre recherche. Essayez d’autres critères ou effacez les filtres.</p>}
      <nav aria-label="Pagination du catalogue" className="flex justify-between px-5 pt-8">{page > 1 && <Link href={lienPage(page - 1)} className="border border-noir px-4 py-3">Précédent</Link>}{page * 20 < resultats.length && <Link href={lienPage(page + 1)} className="ml-auto border border-noir px-4 py-3">Suivant</Link>}</nav>
    </main>
  </div>;
}

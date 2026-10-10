import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Catalogue from "./page";

const { chargerCatalogue, chargerOptionsCatalogue, langue, lireResumes } = vi.hoisted(() => ({ chargerCatalogue: vi.fn(), chargerOptionsCatalogue: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" }, lireResumes: vi.fn() }));
vi.mock("@/lib/avis", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/avis")>()), lireResumes }));
vi.mock("@/lib/catalogue", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/catalogue")>()), chargerCatalogue, chargerOptionsCatalogue }));
vi.mock("@/lib/ville-serveur", async () => { const { VILLE_ORAN } = await import("@/lib/ville"); const TLEMCEN = { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167 }; return { getVilleOuverte: async (code: string) => ({ oran: VILLE_ORAN, tlemcen: TLEMCEN } as Record<string, typeof VILLE_ORAN>)[code] ?? null, getVillesOuvertes: async () => [VILLE_ORAN] }; });
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => langue.valeur, getTextes: async () => textesDe(langue.valeur) }; });
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("@/components/CarteArticle", () => ({ default: ({ article, resume }: { article: { titre: string }; resume?: { moyenne: number | null } }) => <p>{article.titre}{resume?.moyenne != null ? ` [${resume.moyenne}]` : ""}</p> }));

const options = { categories: ["Robes", "Parfums", "Maquillage"], tailles: ["S", "M", "Unique"], contenances: ["10 ml", "50 ml", "100 ml", "Unique"], quartiers: ["Gambetta"] };
const page = async (params: Record<string, string>) => renderToStaticMarkup(await Catalogue({ params: Promise.resolve({ ville: "oran" }), searchParams: Promise.resolve(params) }));
const optionsDe = (html: string, nom: string) => [...(html.match(new RegExp(`<select name="${nom}"[^>]*>(.*?)</select>`))?.[1] ?? "").matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m => [m[1], m[2]]);
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; chargerCatalogue.mockResolvedValue([]); chargerOptionsCatalogue.mockResolvedValue(options); lireResumes.mockResolvedValue(new Map()); });

describe("US-25.2 : /catalogue?univers=beaute", () => {
  it("filtre « Contenance » trié par volume (sans S/M/L) et « Pour elle / Pour lui / Mixte » (sans Enfant)", async () => {
    const html = await page({ univers: "beaute" });
    expect(html).toContain("Contenance<select");
    expect(optionsDe(html, "taille")).toEqual([["", "Tous"], ["10 ml", "10 ml"], ["50 ml", "50 ml"], ["100 ml", "100 ml"], ["Unique", "Unique"]]);
    expect(html).toContain("Pour<select");
    expect(optionsDe(html, "genre")).toEqual([["", "Tous"], ["femme", "Pour elle"], ["homme", "Pour lui"], ["mixte", "Mixte"]]);
  });
  it("raccourcis : Tout + seulement les catégories beauté qui ont des articles, catégorie choisie marquée", async () => {
    const html = await page({ univers: "beaute", categorie: "Parfums" });
    const nav = html.match(/<nav aria-label="Catégories beauté".*?<\/nav>/)?.[0] ?? "";
    expect([...nav.matchAll(/href="([^"]+)"[^>]*>([^<]+)</g)].map(m => [m[1].replace(/&amp;/g, "&"), m[2]])).toEqual([["/oran/catalogue?univers=beaute", "Tout"], ["/oran/catalogue?univers=beaute&categorie=Parfums", "Parfums"], ["/oran/catalogue?univers=beaute&categorie=Maquillage", "Maquillage"]]);
    expect(nav).toMatch(/aria-current="page"[^>]*>Parfums</);
    expect(nav).not.toContain("Robes"); expect(nav).not.toContain("Cheveux");
  });
  it("Beauté vide : « Aucun produit de beauté pour le moment. » ; avec un filtre : message habituel", async () => {
    expect(await page({ univers: "beaute" })).toContain("Aucun produit de beauté pour le moment.");
    expect(await page({ univers: "beaute", genre: "femme" })).toContain("Aucun article ne correspond");
  });
  it("arabe : « الحجم », « 100 مل », « ليها · ليه · للجوج », raccourcis « كامل · عطور »", async () => {
    langue.valeur = "ar";
    const html = await page({ univers: "beaute" });
    expect(html).toContain("الحجم<select");
    expect(optionsDe(html, "taille")).toContainEqual(["100 ml", "100\u00a0مل"]);
    expect(optionsDe(html, "genre")).toEqual([["", "الكل"], ["femme", "ليها"], ["homme", "ليه"], ["mixte", "للجوج"]]);
    expect(html).toContain(">كامل<"); expect(html).toContain(">عطور<");
  });
});

describe("US-25.2 : hors Beauté, rien ne change", () => {
  it("?univers=femme : « Taille » (sans ml) et genre habituel, pas de raccourcis", async () => {
    const html = await page({ univers: "femme" });
    expect(html).toContain("Taille<select");
    expect(optionsDe(html, "taille").map(o => o[0])).toEqual(["", "S", "M", "Unique"]);
    expect(optionsDe(html, "genre").map(o => o[1])).toEqual(["Tous", "Homme", "Femme", "Enfant", "Mixte"]);
    expect(html).not.toContain("Catégories beauté");
  });
  it("une catégorie beauté sans univers passe aussi en « Contenance »", async () => {
    expect(await page({ categorie: "Parfums" })).toContain("Contenance<select");
  });
});

describe("US-29.3 : catalogue d'une ville", () => {
  it("articles et options de la ville ; vide sans filtre : « Pas encore d’articles à Tlemcen. »", async () => {
    const html = renderToStaticMarkup(await Catalogue({ params: Promise.resolve({ ville: "tlemcen" }), searchParams: Promise.resolve({}) }));
    expect(chargerCatalogue).toHaveBeenCalledWith(expect.anything(), "tlemcen", expect.anything());
    expect(chargerOptionsCatalogue).toHaveBeenCalledWith(expect.anything(), "tlemcen");
    expect(html).toContain("Pas encore d’articles à Tlemcen.");
    expect(html).toContain('action="/tlemcen/catalogue"');
  });
  it("vide avec un filtre : message habituel ; en arabe sans filtre : « مازال ما كاش سلعة في وهران. »", async () => {
    expect(await page({ q: "robe" })).toContain("Aucun article ne correspond");
    langue.valeur = "ar";
    expect(await page({})).toContain("مازال ما كاش سلعة في وهران.");
  });
});

describe("US-32.3 : tri « Mieux notées » (texte n° 13)", () => {
  const article = (id: string, boutique: string) => ({ id, titre: `Article ${id}`, description: null, categorie: "Robes", genre: "femme", prix: 3000, cree_le: "2026-10-08", boutique: { id: boutique, nom: boutique, quartier: "Gambetta" }, photo: null, tailles: [], promo: null });
  const r = (moyenne: number | null, nombre: number) => ({ moyenne, nombre, criteres: { accueil: 0, article_conforme: 0, rapidite: 0 } });
  beforeEach(() => {
    chargerCatalogue.mockResolvedValue([article("1", "kids"), article("2", "dar"), article("3", "nour")]);
    lireResumes.mockResolvedValue(new Map([["nour", r(4.6, 18)], ["dar", r(4.2, 7)], ["kids", r(null, 1)]]));
  });
  it("choix « Plus récents » / « Mieux notées » ; une seule lecture des notes pour toutes les boutiques", async () => {
    const html = await page({});
    expect(optionsDe(html, "tri")).toEqual([["", "Plus récents"], ["notes", "Mieux notées"]]);
    expect(lireResumes).toHaveBeenCalledTimes(1);
    expect(lireResumes).toHaveBeenCalledWith(expect.anything(), ["kids", "dar", "nour"]);
    expect(html.indexOf("Article 1")).toBeLessThan(html.indexOf("Article 3"));
    expect(html).toContain("Article 3 [4.6]");
  });
  it("tri=notes : mieux notées d'abord, boutiques sous le seuil à la fin ; le tri reste dans la pagination", async () => {
    const html = await page({ tri: "notes" });
    expect(html.indexOf("Article 3")).toBeLessThan(html.indexOf("Article 2"));
    expect(html.indexOf("Article 2")).toBeLessThan(html.indexOf("Article 1"));
    expect(html).toMatch(/<option value="notes" selected="">Mieux notées<\/option>/);
  });
  it("notes illisibles : le catalogue s'affiche quand même, dans l'ordre", async () => {
    lireResumes.mockRejectedValue(new Error("x"));
    const html = await page({ tri: "notes" });
    expect(html.indexOf("Article 1")).toBeLessThan(html.indexOf("Article 3"));
  });
  it("en arabe : « الأحسن في النقاط »", async () => {
    langue.valeur = "ar";
    expect(optionsDe(await page({}), "tri")).toContainEqual(["notes", "الأحسن في النقاط"]);
  });
});

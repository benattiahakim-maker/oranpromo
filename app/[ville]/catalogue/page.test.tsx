import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Catalogue from "./page";

const { chargerCatalogue, chargerOptionsCatalogue, langue } = vi.hoisted(() => ({ chargerCatalogue: vi.fn(), chargerOptionsCatalogue: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/catalogue", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/catalogue")>()), chargerCatalogue, chargerOptionsCatalogue }));
vi.mock("@/lib/ville-serveur", async () => { const { VILLE_ORAN } = await import("@/lib/ville"); return { getVilleOuverte: async (code: string) => (code === "oran" ? VILLE_ORAN : null), getVillesOuvertes: async () => [VILLE_ORAN] }; });
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => langue.valeur, getTextes: async () => textesDe(langue.valeur) }; });
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("@/components/CarteArticle", () => ({ default: ({ article }: { article: { titre: string } }) => <p>{article.titre}</p> }));

const options = { categories: ["Robes", "Parfums", "Maquillage"], tailles: ["S", "M", "Unique"], contenances: ["10 ml", "50 ml", "100 ml", "Unique"], quartiers: ["Gambetta"] };
const page = async (params: Record<string, string>) => renderToStaticMarkup(await Catalogue({ params: Promise.resolve({ ville: "oran" }), searchParams: Promise.resolve(params) }));
const optionsDe = (html: string, nom: string) => [...(html.match(new RegExp(`<select name="${nom}"[^>]*>(.*?)</select>`))?.[1] ?? "").matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m => [m[1], m[2]]);
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; chargerCatalogue.mockResolvedValue([]); chargerOptionsCatalogue.mockResolvedValue(options); });

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

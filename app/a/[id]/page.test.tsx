import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ArticlePage from "./page";
const { single, langue } = vi.hoisted(() => ({ single: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ from: () => ({ select: () => ({ eq: () => ({ single, eq: () => ({ limit: async () => ({ data: [] }) }) }) }) }) }) }));
vi.mock("@/components/GalerieArticle", () => ({ default: () => null }));
vi.mock("@/components/PartagerArticle", () => ({ default: () => null }));
vi.mock("@/components/CommandeArticle", () => ({ default: () => null }));
vi.mock("@/components/SignalerArticle", () => ({ default: () => null }));
vi.mock("@/components/EnregistrerVue", () => ({ default: () => null }));
describe("US-15 : affichage public", () => {
  it.each(["قميص أزرق\nأكمام قصيرة.", null])("affiche le texte arabe uniquement s’il existe", async description_ar => {
    single.mockResolvedValue({ data: { id: "a", titre: "Polo bleu", prix: 3500, description: "Description française", description_ar, statut: "disponible", boutique_id: "b", boutiques: { nom: "Boutique", quartier: "Centre", slug: "boutique" }, photos: [], tailles: [], promos: null }, error: null });
    const html = renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }));
    expect(html.includes('dir="rtl" lang="ar"')).toBe(Boolean(description_ar));
    if (description_ar) { expect(html).toContain(description_ar); expect(html.indexOf("Description française")).toBeLessThan(html.indexOf(description_ar)); }
  });
});

describe("US-23 : fiche en arabe", () => {
  const article = { id: "a", titre: "Polo bleu", prix: 4500, description: "Description française", description_ar: "قميص أزرق", statut: "disponible", boutique_id: "b", boutiques: { nom: "Boutique", quartier: "Centre", slug: "boutique" }, photos: [], tailles: [], promos: { prix_promo: 3500, date_fin: "2099-10-18T10:00:00Z", badge: null } };
  it("description arabe en premier, prix en دج, réduction et date en arabe", async () => {
    langue.valeur = "ar";
    single.mockResolvedValue({ data: article, error: null });
    const html = renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }));
    langue.valeur = "fr";
    expect(html.indexOf("قميص أزرق")).toBeLessThan(html.indexOf("Description française"));
    expect(html).toContain("\u20663\u00a0500\u2069\u00a0دج");
    expect(html).toContain("\u2066−22%\u2069"); expect(html).toContain("حتى 18 أكتوبر 2099");
    expect(html).toContain('aria-label="رجوع"'); expect(html).toContain('d="M9 18l6-6-6-6"');
  });
  it("article vendu : « هاد السلعة ما بقاتش » (texte validé)", async () => {
    langue.valeur = "ar";
    single.mockResolvedValue({ data: { ...article, statut: "vendu" }, error: null });
    const html = renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }));
    langue.valeur = "fr";
    expect(html).toContain("هاد السلعة ما بقاتش");
    expect(html).toContain("ما كانش سلع أخرى دابا");
  });
});

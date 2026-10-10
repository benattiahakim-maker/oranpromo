import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ArticlePage from "./page";
const { single, langue, commande } = vi.hoisted(() => ({ single: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" }, commande: vi.fn((props: { beaute?: boolean }) => { void props; return null; }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ data: [], error: null })) }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ single, eq: () => ({ limit: async () => ({ data: [] }) }) }) }) }) }) }));
vi.mock("@/components/GalerieArticle", () => ({ default: () => null }));
vi.mock("@/components/PartagerArticle", () => ({ default: () => null }));
vi.mock("@/components/CommandeArticle", () => ({ default: commande }));
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

describe("US-25.1 : la fiche dit à la commande si l’article est un produit de beauté", () => {
  it.each([["Parfums", true], ["Maquillage", true], ["T-shirts et polos", false]])("%s → beaute = %s", async (categorie, beaute) => {
    commande.mockClear();
    single.mockResolvedValue({ data: { id: "a", titre: "Article", prix: 3500, description: null, description_ar: null, statut: "disponible", categorie, boutique_id: "b", boutiques: { nom: "Boutique", quartier: "Centre", slug: "boutique", whatsapp: "+213555123456" }, photos: [], tailles: [{ libelle: "50 ml", disponible: true, quantite: 2 }], promos: null }, error: null });
    renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }));
    expect(commande).toHaveBeenCalled();
    expect(commande.mock.calls[0][0].beaute).toBe(beaute);
  });
});

describe("US-32.3 : note de la boutique sur la fiche", () => {
  const B = "44444444-4444-4444-4444-444444444444";
  const article = { id: "a", titre: "Abaya brodée", prix: 9000, description: null, description_ar: null, statut: "disponible", boutique_id: B, boutiques: { nom: "Boutique Nour", quartier: "Centre", slug: "boutique-nour" }, photos: [], tailles: [], promos: null };
  it("« Boutique Nour · ★ 4,6 (18 avis) », lien vers les avis de la vitrine", async () => {
    single.mockResolvedValue({ data: article, error: null });
    rpc.mockResolvedValueOnce({ data: [{ boutique_id: B, nombre: 18, moyenne: 4.6, criteres: {} }], error: null } as never);
    const html = renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }));
    expect(rpc).toHaveBeenCalledWith("resume_avis", { boutiques: [B] });
    expect(html).toContain('href="/b/boutique-nour#avis"'); expect(html).toContain("Boutique Nour · ★ 4,6 (18 avis)");
  });
  it("sous le seuil ou lecture impossible : pas de note", async () => {
    single.mockResolvedValue({ data: article, error: null });
    rpc.mockResolvedValueOnce({ data: [{ boutique_id: B, nombre: 2, moyenne: null, criteres: {} }], error: null } as never);
    expect(renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }))).not.toContain("#avis");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } } as never);
    expect(renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ id: "a" }) }))).not.toContain("#avis");
  });
});

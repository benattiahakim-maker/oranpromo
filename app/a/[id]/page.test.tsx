import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ArticlePage from "./page";
const { single } = vi.hoisted(() => ({ single: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }) }) }));
vi.mock("@/components/GalerieArticle", () => ({ default: () => null }));
vi.mock("@/components/PartagerArticle", () => ({ default: () => null }));
vi.mock("@/components/ReservationArticle", () => ({ default: () => null }));
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

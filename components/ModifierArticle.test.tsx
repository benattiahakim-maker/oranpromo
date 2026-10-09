import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModifierArticle from "./ModifierArticle";
import type { ArticleGere } from "@/lib/gestion-articles";
const { modifier } = vi.hoisted(() => ({ modifier: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/gestion-articles", async original => ({ ...await original<typeof import("@/lib/gestion-articles")>(), modifierArticle: modifier }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => ({}) }));
vi.mock("@/lib/envoi-article", () => ({ modifierArticleNavigateur: (...args: unknown[]) => modifier({}, ...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, replace() {} }) }));
vi.mock("./PromoArticle", () => ({ default: () => null }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
describe("US-15 : formulaire de modification", () => {
  it("charge le texte arabe existant et sauvegarde sa correction", async () => {
    const article: ArticleGere = { id: "a", boutique_id: "b", titre: "Polo bleu", categorie: "T-shirts et polos", genre: "homme", prix: 3500, couleur: null, description: "Manches courtes.", description_ar: "قميص أزرق\nأكمام قصيرة.", cree_le: "2026-10-09T10:00:00Z", derniere_confirmation: "2026-10-09T10:00:00Z", propose_par_ia: false, masque_par_moderation: false, statut: "disponible", tailles: [{ id: "t", article_id: "a", libelle: "M", disponible: true, quantite: 1 }], photos: [], promos: null };
    render(<ModifierArticle article={article} />);
    const zone = screen.getByRole("textbox", { name: "Texte arabe (facultatif)" });
    expect((zone as HTMLTextAreaElement).value).toBe(article.description_ar);
    expect(zone.getAttribute("dir")).toBe("rtl");
    fireEvent.change(zone, { target: { value: "وصف معدل" } }); fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(modifier).toHaveBeenCalledWith({}, "a", expect.objectContaining({ descriptionAr: "وصف معدل" }), expect.any(Array)));
  });
});

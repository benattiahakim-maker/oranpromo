// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import MesArticles from "./MesArticles";
import ModifierArticle from "./ModifierArticle";
import type { ArticleGere } from "@/lib/gestion-articles";
const { changerStatut, modifierArticle, supprimerArticle, refresh, replace } = vi.hoisted(() => ({ changerStatut: vi.fn(), modifierArticle: vi.fn(), supprimerArticle: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/gestion-articles", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/gestion-articles")>(), changerStatut, modifierArticle, supprimerArticle }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => "client" }));
vi.mock("@/lib/envoi-article", () => ({ modifierArticleNavigateur: (...args: unknown[]) => modifierArticle("client", ...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));
const article: ArticleGere = { id: "article", boutique_id: "boutique", titre: "Polo", categorie: "T-shirts et polos", genre: "homme", couleur: null, description: null, description_ar: null, cree_le: "2026-10-09T00:00:00Z", derniere_confirmation: "2026-10-09T00:00:00Z", propose_par_ia: false, masque_par_moderation: false, prix: 3500, statut: "disponible", photos: [], promos: null, tailles: [{ id: "s", article_id: "article", libelle: "S", disponible: true }, { id: "m", article_id: "article", libelle: "M", disponible: true }] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); changerStatut.mockResolvedValue(undefined); modifierArticle.mockResolvedValue(undefined); supprimerArticle.mockResolvedValue(undefined); });
afterEach(cleanup);
describe("US-11 : liste et modification", () => {
  it("affiche la miniature dans la liste, ou la grande photo si l’article n’a pas de miniature", () => {
    const photo = (id: string, ordre: number, vignette: string | null) => ({ id, article_id: "article", adresse: `https://exemple.fr/${id}.jpg`, adresse_vignette: vignette, ordre });
    render(<MesArticles articles={[{ ...article, photos: [photo("b", 1, null), photo("a", 0, "https://exemple.fr/a-vignette.jpg")] }, { ...article, id: "ancien", titre: "Ancien", photos: [photo("c", 0, null)] }]} />);
    expect(screen.getByRole("img", { name: "Polo" }).getAttribute("src")).toBe("https://exemple.fr/a-vignette.jpg");
    expect(screen.getByRole("img", { name: "Ancien" }).getAttribute("src")).toBe("https://exemple.fr/c.jpg");
  });
  it("change le statut directement dans la liste", async () => {
    render(<MesArticles articles={[article]} />); fireEvent.change(screen.getByRole("combobox", { name: "Statut de Polo" }), { target: { value: "vendu" } });
    await waitFor(() => expect(changerStatut).toHaveBeenCalledWith("client", "article", "vendu")); await waitFor(() => expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("vendu"));
  });
  it("bloque le statut d’un article masqué par la modération et l’explique", () => {
    render(<MesArticles articles={[{ ...article, statut: "masque", masque_par_moderation: true }]} />);
    expect(screen.getByRole("combobox", { name: "Statut de Polo" })).toBeDisabled(); expect(screen.getByText(/masqué par la modération/)).toBeInTheDocument();
  });
  it("garde l’ancien statut quand l’enregistrement échoue", async () => {
    changerStatut.mockRejectedValue(new Error("Impossible de changer le statut.")); render(<MesArticles articles={[article]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "vendu" } }); await screen.findByRole("alert"); expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("disponible");
  });
  it("retire une taille vendue sans la supprimer", async () => {
    render(<ModifierArticle article={article} />); fireEvent.click(screen.getByRole("button", { name: "S" })); fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(modifierArticle).toHaveBeenCalledWith("client", "article", expect.any(Object), [{ libelle: "M", disponible: true }])); expect(await screen.findByRole("status")).toHaveTextContent("Article enregistré");
  });
  it("affiche la validation sous le champ et ne sauvegarde rien", async () => {
    render(<ModifierArticle article={article} />); fireEvent.change(screen.getByRole("textbox", { name: "Titre" }), { target: { value: "" } }); fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("entre 2 et 120"); expect(modifierArticle).not.toHaveBeenCalled();
  });
  it("demande confirmation dans la page et permet d’annuler", async () => {
    render(<ModifierArticle article={article} />); fireEvent.click(screen.getByRole("button", { name: "Supprimer l’article" })); expect(supprimerArticle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" })); expect(screen.queryByRole("button", { name: "Oui, supprimer l’article" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l’article" })); fireEvent.click(screen.getByRole("button", { name: "Oui, supprimer l’article" })); await waitFor(() => expect(supprimerArticle).toHaveBeenCalledWith("client", "article")); expect(replace).toHaveBeenCalledWith("/espace");
  });
});

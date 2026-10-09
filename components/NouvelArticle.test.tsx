import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NouvelArticle from "./NouvelArticle";

const { publierArticle } = vi.hoisted(() => ({ publierArticle: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => ({}) }));
vi.mock("@/lib/publication-article", () => ({ publierArticle, ErreurPublicationArticle: class extends Error {} }));
beforeEach(() => {
  publierArticle.mockReset();
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:photo"; } static revokeObjectURL() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("US-10 : formulaire mobile", () => {
  it("affiche les erreurs sous les champs et n’envoie pas un formulaire incomplet", () => {
    render(<NouvelArticle boutiqueId="boutique" />);
    fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    expect(screen.getAllByRole("alert")).toHaveLength(5);
    expect(publierArticle).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Prendre une photo").getAttribute("capture")).toBe("environment");
    expect(screen.getByLabelText("Choisir dans la galerie").getAttribute("multiple")).not.toBeNull();
  });
  it("publie un formulaire complet et permet de copier puis de recommencer", async () => {
    publierArticle.mockResolvedValue("article-test");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<NouvelArticle boutiqueId="boutique" />);
    fireEvent.change(screen.getByLabelText("Choisir dans la galerie"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByRole("textbox", { name: "TITRE *" }), { target: { value: "Polo bleu" } });
    fireEvent.change(screen.getByRole("combobox", { name: "CATÉGORIE *" }), { target: { value: "Polos" } });
    fireEvent.change(screen.getByRole("textbox", { name: "PRIX EN DA *" }), { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Article en ligne" })).toBeDefined());
    expect(screen.getByRole("link").getAttribute("href")).toBe("/a/article-test");
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/a/article-test")));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un autre article" }));
    expect((screen.getByRole("textbox", { name: "TITRE *" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("img")).toBeNull();
  });
});

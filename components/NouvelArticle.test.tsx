import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NouvelArticle from "./NouvelArticle";

const { publierArticle, compression } = vi.hoisted(() => ({ publierArticle: vi.fn(), compression: vi.fn() }));
vi.mock("@/lib/compression-photo", () => ({ compresserPhoto: compression }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => ({}) }));
vi.mock("@/lib/envoi-article", () => ({ publierArticleNavigateur: (...args: unknown[]) => publierArticle({}, args[0], args[1], args[2], undefined, args[3]) }));
beforeEach(() => {
  localStorage.clear();
  publierArticle.mockReset();
  compression.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "L’IA est indisponible, remplissez la fiche à la main" }) }));
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:photo"; } static revokeObjectURL() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const proposition = { titre: "Polo bleu", description: "Polo bleu à manches courtes.", categorie: "T-shirts et polos", genre: "homme", couleur: "bleu" };
const choisirPhoto = () => fireEvent.change(screen.getByLabelText("Choisir dans la galerie"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
describe("US-14 : assistance IA facultative", () => {
  it("compresse uniquement la première photo et propose des champs modifiables, sans prix ni taille ni publication", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ fiche: proposition }) } as Response);
    render(<NouvelArticle boutiqueId="boutique" />); choisirPhoto();
    expect(screen.getByText("L’IA prépare la fiche…")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("textbox", { name: /^TITRE/ }) as HTMLInputElement).value).toBe("Polo bleu"));
    expect(screen.getAllByText("Proposé par l’IA")).toHaveLength(5);
    expect((screen.getByRole("textbox", { name: "PRIX EN DA *" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe("false");
    expect(publierArticle).not.toHaveBeenCalled();
    const formulaire = vi.mocked(fetch).mock.calls[0][1]!.body as FormData;
    expect((formulaire.get("photo") as File).type).toBe("image/jpeg");
    choisirPhoto(); expect(compression).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox", { name: /^TITRE/ }), { target: { value: "Polo corrigé" } });
    fireEvent.change(screen.getByRole("textbox", { name: "PRIX EN DA *" }), { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("button", { name: "M" })); publierArticle.mockResolvedValue("article-ia");
    fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    await waitFor(() => expect(publierArticle).toHaveBeenCalledWith({}, "boutique", expect.objectContaining({ titre: "Polo corrigé", prix: "3500", tailles: ["M"] }), expect.any(Array), undefined, true));
  });
  it("n’écrase aucune saisie faite avant ou pendant l’analyse", async () => {
    let terminer!: (valeur: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { terminer = resolve; }));
    render(<NouvelArticle boutiqueId="boutique" />);
    fireEvent.change(screen.getByRole("textbox", { name: "TITRE *" }), { target: { value: "Mon titre" } }); choisirPhoto();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "DESCRIPTION (FACULTATIVE)" }), { target: { value: "Ma description" } });
    fireEvent.change(screen.getByRole("combobox", { name: "GENRE" }), { target: { value: "femme" } });
    await act(async () => terminer({ ok: true, json: async () => ({ fiche: proposition }) } as Response));
    expect((screen.getByRole("textbox", { name: "TITRE *" }) as HTMLInputElement).value).toBe("Mon titre");
    expect((screen.getByRole("textbox", { name: "DESCRIPTION (FACULTATIVE)" }) as HTMLInputElement).value).toBe("Ma description");
    expect((screen.getByRole("combobox", { name: "GENRE" }) as HTMLSelectElement).value).toBe("femme");
    expect(screen.getAllByText("Proposé par l’IA")).toHaveLength(2);
  });
  it("ignore une réponse tardive après le retrait de la première photo", async () => {
    let terminer!: (valeur: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { terminer = resolve; }));
    render(<NouvelArticle boutiqueId="boutique" />); choisirPhoto(); await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Retirer la photo 1" }));
    await act(async () => terminer({ ok: true, json: async () => ({ fiche: proposition }) } as Response));
    expect((screen.getByRole("textbox", { name: "TITRE *" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Proposé par l’IA")).toBeNull();
  });
  it("sans clé : affiche le message discret et permet une publication manuelle sans origine IA", async () => {
    publierArticle.mockResolvedValue("article-manuel"); render(<NouvelArticle boutiqueId="boutique" />); choisirPhoto();
    await waitFor(() => expect(screen.getByText("L’IA est indisponible, remplissez la fiche à la main")).toBeTruthy());
    fireEvent.change(screen.getByRole("textbox", { name: "TITRE *" }), { target: { value: "Polo manuel" } });
    fireEvent.change(screen.getByRole("combobox", { name: "CATÉGORIE *" }), { target: { value: "T-shirts et polos" } });
    fireEvent.change(screen.getByRole("combobox", { name: "GENRE" }), { target: { value: "mixte" } });
    fireEvent.change(screen.getByRole("textbox", { name: "PRIX EN DA *" }), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "S" })); fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    await waitFor(() => expect(publierArticle).toHaveBeenCalledWith({}, "boutique", expect.objectContaining({ titre: "Polo manuel" }), expect.any(Array), undefined, false));
  });
});

describe("US-10 : formulaire mobile", () => {
  it("US-15 : saisit le texte arabe à la main et le transmet à la publication", async () => {
    publierArticle.mockResolvedValue("article-arabe"); render(<NouvelArticle boutiqueId="boutique" />); choisirPhoto();
    fireEvent.change(screen.getByRole("textbox", { name: "TITRE *" }), { target: { value: "Polo bleu" } });
    fireEvent.change(screen.getByRole("combobox", { name: "CATÉGORIE *" }), { target: { value: "T-shirts et polos" } });
    fireEvent.change(screen.getByRole("combobox", { name: "GENRE" }), { target: { value: "mixte" } });
    fireEvent.change(screen.getByRole("textbox", { name: "PRIX EN DA *" }), { target: { value: "3500" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Texte arabe (facultatif)" }), { target: { value: "قميص أزرق" } });
    fireEvent.click(screen.getByRole("button", { name: "M" })); fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    await waitFor(() => expect(publierArticle).toHaveBeenCalledWith({}, "boutique", expect.objectContaining({ descriptionAr: "قميص أزرق" }), expect.any(Array), undefined, false));
  });
  it("affiche les erreurs sous les champs et n’envoie pas un formulaire incomplet", () => {
    render(<NouvelArticle boutiqueId="boutique" />);
    fireEvent.click(screen.getByRole("button", { name: "PUBLIER L’ARTICLE" }));
    expect(screen.getAllByRole("alert")).toHaveLength(6);
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
    fireEvent.change(screen.getByRole("combobox", { name: "CATÉGORIE *" }), { target: { value: "T-shirts et polos" } });
    fireEvent.change(screen.getByRole("combobox", { name: "GENRE" }), { target: { value: "mixte" } });
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

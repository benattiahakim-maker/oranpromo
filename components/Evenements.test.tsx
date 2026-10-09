// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EnregistrerVue from "./EnregistrerVue";
import PartagerArticle from "./PartagerArticle";
const { enregistrerEvenement } = vi.hoisted(() => ({ enregistrerEvenement: vi.fn() }));
vi.mock("@/lib/evenements", () => ({ enregistrerEvenement }));
beforeEach(() => { vi.clearAllMocks(); enregistrerEvenement.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("US-13 : vues et partages", () => {
  it("enregistre une seule vue malgré StrictMode et les nouveaux rendus", () => {
    const vue = render(<StrictMode><EnregistrerVue boutiqueId="boutique" articleId="a" /></StrictMode>);
    vue.rerender(<StrictMode><EnregistrerVue boutiqueId="boutique" articleId="a" /></StrictMode>); expect(enregistrerEvenement).toHaveBeenCalledTimes(1); expect(enregistrerEvenement).toHaveBeenCalledWith("vue_article", "boutique", "a");
    vue.rerender(<StrictMode><EnregistrerVue boutiqueId="boutique" articleId="b" /></StrictMode>); expect(enregistrerEvenement).toHaveBeenCalledTimes(2);
  });
  it("enregistre une nouvelle vue lors d’un nouveau chargement", () => {
    const vue = render(<EnregistrerVue boutiqueId="boutique" />); vue.unmount(); render(<EnregistrerVue boutiqueId="boutique" />); expect(enregistrerEvenement).toHaveBeenCalledTimes(2); expect(enregistrerEvenement).toHaveBeenCalledWith("vue_boutique", "boutique", undefined);
  });
  it("enregistre le clic Partager sans attendre le suivi", async () => {
    enregistrerEvenement.mockReturnValue(new Promise(() => {})); const share = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<PartagerArticle titre="Polo" boutiqueId="boutique" articleId="article" />); fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    await waitFor(() => expect(share).toHaveBeenCalled()); expect(enregistrerEvenement).toHaveBeenCalledWith("partage", "boutique", "article");
  });
});

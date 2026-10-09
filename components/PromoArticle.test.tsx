// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PromoArticle from "./PromoArticle";
import MesArticles from "./MesArticles";
import type { ArticleGere } from "@/lib/gestion-articles";
const { enregistrerPromo, arreterPromo, refresh } = vi.hoisted(() => ({ enregistrerPromo: vi.fn(), arreterPromo: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/promo", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/promo")>(), enregistrerPromo, arreterPromo }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => "client" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const props = { articleId: "article", prixNormal: 4500, promo: null, occupe: false, onOccupation: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); enregistrerPromo.mockResolvedValue(undefined); arreterPromo.mockResolvedValue(undefined); });
afterEach(cleanup);
describe("US-12 : formulaire promo", () => {
  it("calcule les deux champs en direct et le badge par défaut", () => {
    render(<PromoArticle {...props} />); fireEvent.change(screen.getByRole("textbox", { name: "Réduction en pourcentage" }), { target: { value: "20" } }); expect(screen.getByRole("textbox", { name: "Prix promo en DA" })).toHaveValue("3600");
    fireEvent.change(screen.getByRole("textbox", { name: "Prix promo en DA" }), { target: { value: "3500" } }); expect(screen.getByRole("textbox", { name: "Réduction en pourcentage" })).toHaveValue("22"); expect(screen.getByRole("option", { name: "−22 % (par défaut)" })).toBeInTheDocument();
  });
  it("affiche les erreurs sous les champs sans enregistrement", () => {
    render(<PromoArticle {...props} />); fireEvent.change(screen.getByRole("textbox", { name: "Prix promo en DA" }), { target: { value: "4500" } }); fireEvent.click(screen.getByRole("button", { name: "Enregistrer la promo" }));
    expect(screen.getByText("Le prix promo doit être inférieur au prix normal.")).toBeInTheDocument(); expect(screen.getByText("Choisissez une date de fin.")).toBeInTheDocument(); expect(enregistrerPromo).not.toHaveBeenCalled();
  });
  it("enregistre une promo et permet de l’arrêter", async () => {
    render(<PromoArticle {...props} />); fireEvent.change(screen.getByRole("textbox", { name: "Prix promo en DA" }), { target: { value: "3500" } }); fireEvent.change(screen.getByLabelText("Date de fin"), { target: { value: "2099-10-10T12:30" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Badge" }), { target: { value: "flash" } }); fireEvent.click(screen.getByRole("button", { name: "Enregistrer la promo" }));
    await waitFor(() => expect(enregistrerPromo).toHaveBeenCalledWith("client", "article", { prixPromo: "3500", dateFin: "2099-10-10T12:30", badge: "flash" }));
    fireEvent.click(await screen.findByRole("button", { name: "Arrêter la promo" })); await waitFor(() => expect(arreterPromo).toHaveBeenCalledWith("client", "article")); await waitFor(() => expect(screen.queryByRole("button", { name: "Arrêter la promo" })).toBeNull()); expect(screen.getByRole("status")).toHaveTextContent("Promo arrêtée");
  });
  it("n’annonce pas un succès après une erreur Supabase", async () => {
    enregistrerPromo.mockRejectedValue(new Error("Impossible d’enregistrer la promo.")); render(<PromoArticle {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Prix promo en DA" }), { target: { value: "3500" } }); fireEvent.change(screen.getByLabelText("Date de fin"), { target: { value: "2099-10-10T12:30" } }); fireEvent.click(screen.getByRole("button", { name: "Enregistrer la promo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible d’enregistrer"); expect(screen.queryByRole("status")).toBeNull();
  });
  it("affiche PROMO uniquement pour une promo active dans la liste", () => {
    const base = { id: "article", titre: "Polo", prix: 4500, statut: "disponible", photos: [], tailles: [], promos: { article_id: "article", prix_promo: 3500, badge: null, date_fin: "2099-10-10T12:00:00Z" } } as unknown as ArticleGere;
    const vue = render(<MesArticles articles={[base]} />); expect(screen.getByText("PROMO")).toBeInTheDocument();
    vue.rerender(<MesArticles articles={[{ ...base, promos: { ...base.promos!, date_fin: "2020-01-01T12:00:00Z" } }]} />); expect(screen.queryByText("PROMO")).toBeNull();
  });
});

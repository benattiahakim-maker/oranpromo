import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignalementsModeration from "./SignalementsModeration";
import { regrouperSignalements, type SignalementModeration } from "@/lib/moderation";

const { traiter, refresh } = vi.hoisted(() => ({ traiter: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/moderation/actions", () => ({ traiterSignalements: traiter }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); traiter.mockResolvedValue({ succes: true, message: "Signalements traités." }); });
const rapport: SignalementModeration = { id: "s1", article_id: "a1", motif: "autre", commentaire: "Photo trompeuse", statut: "ouvert", cree_le: "2026-10-09T10:00:00Z", articles: { id: "a1", titre: "Polo bleu", boutique_id: "b1", photos: [], boutiques: { id: "b1", nom: "Boutique test", whatsapp: "+213555123456", statut: "validee" } } };
const afficher = () => render(<SignalementsModeration groupes={regrouperSignalements([rapport])} />);
describe("file de modération", () => {
  it.each([["Masquer l’article", "Confirmer le masquage", "masquer"], ["Suspendre la boutique", "Confirmer la suspension", "suspendre"]])("confirme dans la page avant %s", async (bouton, confirmation, action) => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: bouton }));
    expect(traiter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(traiter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: bouton }));
    fireEvent.click(screen.getByRole("button", { name: confirmation }));
    await waitFor(() => expect(traiter).toHaveBeenCalledWith("a1", ["s1"], action));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Signalements traités."));
  });
  it("affiche les informations du signalement et classe sans suite", async () => {
    afficher();
    expect(screen.getByText("Photo trompeuse")).toBeTruthy();
    expect(screen.getByText("Boutique test")).toBeTruthy();
    expect(screen.getByText("1 signalement")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Classer sans suite" }));
    await waitFor(() => expect(traiter).toHaveBeenCalledWith("a1", ["s1"], "classer"));
  });
  it("ouvre un message WhatsApp prérempli et enregistre l’avertissement", async () => {
    afficher();
    const lien = screen.getByRole("link", { name: "Avertir la boutique" });
    expect(new URL(lien.getAttribute("href")!).searchParams.get("text")).toContain("Polo bleu");
    expect(lien.getAttribute("target")).toBe("_blank");
    fireEvent.click(lien);
    await waitFor(() => expect(traiter).toHaveBeenCalledWith("a1", ["s1"], "avertir"));
  });
  it("affiche une erreur serveur et conserve les actions disponibles", async () => {
    traiter.mockResolvedValue({ succes: false, message: "Accès réservé" });
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Classer sans suite" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Accès réservé"));
    expect(screen.getByRole("button", { name: "Classer sans suite" })).toBeTruthy();
  });
});

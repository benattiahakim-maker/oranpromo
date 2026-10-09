import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignalerArticle from "./SignalerArticle";

const { envoyerSignalement } = vi.hoisted(() => ({ envoyerSignalement: vi.fn() }));
vi.mock("@/app/visiteurs/actions", () => ({ envoyerSignalement }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("signalement (US-17)", () => {
  it("envoie le motif et le commentaire puis confirme sans permettre un deuxième envoi", async () => {
    envoyerSignalement.mockResolvedValue({ succes: true, message: "Merci, nous allons vérifier." });
    render(<SignalerArticle articleId="1234" />);
    fireEvent.click(screen.getByText("Signaler cet article"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "arnaque" } });
    fireEvent.change(screen.getByLabelText("Commentaire (facultatif)"), { target: { value: " À vérifier " } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Merci, nous allons vérifier."));
    expect(envoyerSignalement).toHaveBeenCalledWith("1234", "arnaque", "À vérifier");
    expect(screen.queryByText("Envoyer le signalement")).toBeNull();
  });
  it("permet de réessayer après un échec", async () => {
    envoyerSignalement.mockResolvedValue({ succes: false, message: "Le signalement n’a pas pu être envoyé. Réessayez." });
    render(<SignalerArticle articleId="1234" />);
    fireEvent.click(screen.getByText("Signaler cet article"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "arnaque" } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Réessayez"));
    expect((screen.getByText("Envoyer le signalement") as HTMLButtonElement).disabled).toBe(false);
  });
  it("affiche le refus de la limite par visiteur (déjà signalé)", async () => {
    envoyerSignalement.mockResolvedValue({ succes: false, message: "Vous avez déjà signalé cet article, merci. Il sera examiné rapidement." });
    render(<SignalerArticle articleId="1234" />);
    fireEvent.click(screen.getByText("Signaler cet article"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "autre" } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Vous avez déjà signalé cet article, merci. Il sera examiné rapidement."));
    expect(screen.getByText("Envoyer le signalement")).toBeTruthy();
  });
});

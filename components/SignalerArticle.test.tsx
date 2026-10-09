import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignalerArticle from "./SignalerArticle";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => ({ from: () => ({ insert }) }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("signalement (US-17)", () => {
  it("envoie le motif et le commentaire puis confirme sans permettre un deuxième envoi", async () => {
    insert.mockResolvedValue({ error: null });
    render(<SignalerArticle articleId="1234" />);
    fireEvent.click(screen.getByText("Signaler cet article"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "arnaque" } });
    fireEvent.change(screen.getByLabelText("Commentaire (facultatif)"), { target: { value: " À vérifier " } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Merci, nous allons vérifier."));
    expect(insert).toHaveBeenCalledWith({ article_id: "1234", motif: "arnaque", commentaire: "À vérifier", statut: "ouvert" });
    expect(screen.queryByText("Envoyer le signalement")).toBeNull();
  });
  it("permet de réessayer après un échec", async () => {
    insert.mockResolvedValue({ error: { message: "Erreur réseau" } });
    render(<SignalerArticle articleId="1234" />);
    fireEvent.click(screen.getByText("Signaler cet article"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "arnaque" } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Réessayez"));
    expect((screen.getByText("Envoyer le signalement") as HTMLButtonElement).disabled).toBe(false);
  });
});

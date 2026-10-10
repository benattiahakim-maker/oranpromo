import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReponseAvis from "./ReponseAvis";

const { publierReponse, refresh } = vi.hoisted(() => ({ publierReponse: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/avis/actions", () => ({ publierReponse }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("US-32.4 : réponse publique de la boutique", () => {
  it("publie une seule fois puis remplace le formulaire par la confirmation", async () => {
    publierReponse.mockResolvedValue({ succes: true, message: "Réponse publiée." });
    render(<ReponseAvis avisId="v1" />);
    fireEvent.change(screen.getByLabelText("Votre réponse publique (une seule fois)"), { target: { value: "Désolés pour l’attente, merci Sara." } });
    expect(screen.getByText("35/300")).toBeTruthy();
    fireEvent.click(screen.getByText("Publier la réponse"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Réponse publiée."));
    expect(publierReponse).toHaveBeenCalledWith("v1", "Désolés pour l’attente, merci Sara.");
    expect(screen.queryByText("Publier la réponse")).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });
  it("réponse vide : message, rien n'est envoyé", async () => {
    render(<ReponseAvis avisId="v1" />);
    fireEvent.click(screen.getByText("Publier la réponse"));
    expect((await screen.findByRole("alert")).textContent).toBe("Écrivez votre réponse.");
    expect(publierReponse).not.toHaveBeenCalled();
  });
  it("refus du filtre : message de la base, le texte est gardé", async () => {
    publierReponse.mockResolvedValue({ succes: false, message: "Votre réponse ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier." });
    render(<ReponseAvis avisId="v1" />);
    fireEvent.change(screen.getByLabelText("Votre réponse publique (une seule fois)"), { target: { value: "Appelez le 0555 12 34 56" } });
    fireEvent.click(screen.getByText("Publier la réponse"));
    expect((await screen.findByRole("alert")).textContent).toContain("ne peut pas contenir de lien");
    expect((screen.getByLabelText("Votre réponse publique (une seule fois)") as HTMLTextAreaElement).value).toBe("Appelez le 0555 12 34 56");
  });
});

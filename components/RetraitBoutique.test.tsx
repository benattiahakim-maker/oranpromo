import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import RetraitBoutique from "./RetraitBoutique";

const { remettreCommandeRetrait } = vi.hoisted(() => ({ remettreCommandeRetrait: vi.fn() }));
vi.mock("@/app/espace/retrait/actions", () => ({ remettreCommandeRetrait }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok" as const, commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T17:30:00Z", terminee_le: null, mode_remise: null, lignes: [] };
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("US-26.3 : résumé et « Remis au client »", () => {
  it("remet par le QR code, une seule fois même avec deux touches rapides", async () => {
    let finir!: (v: unknown) => void;
    remettreCommandeRetrait.mockReturnValue(new Promise(r => { finir = r; }));
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    const bouton = screen.getByRole("button", { name: "Remis au client" });
    fireEvent.click(bouton); fireEvent.click(bouton);
    expect(remettreCommandeRetrait).toHaveBeenCalledTimes(1);
    expect(remettreCommandeRetrait).toHaveBeenCalledWith({ jeton: JETON });
    finir({ succes: true, message: "Commande remise", resume: { ...resume, etat: "remise" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Commande remise");
    expect(screen.getByText(/N° 128 · 6\s300\sDA · Elle passe en « Récupérée »/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scanner une autre commande" })).toHaveAttribute("href", "/espace/scanner");
  });
  it("remise refusée (déjà remise par un autre scan) : message, pas d’écran de succès", async () => {
    remettreCommandeRetrait.mockResolvedValue({ succes: false, message: "Déjà remise le 10/10 à 17 h 05." });
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    fireEvent.click(screen.getByRole("button", { name: "Remis au client" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Déjà remise le 10/10 à 17 h 05.");
    expect(screen.queryByText("Commande remise")).toBeNull();
  });
});

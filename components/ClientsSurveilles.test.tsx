import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ClientsSurveilles from "./ClientsSurveilles";

const { debloquerCompteClient, annulerNoShowClient, refresh } = vi.hoisted(() => ({ debloquerCompteClient: vi.fn(), annulerNoShowClient: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/clients/actions", () => ({ debloquerCompteClient, annulerNoShowClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); debloquerCompteClient.mockResolvedValue({ succes: true, message: "Client débloqué : son compteur repart de 0." }); });

describe("clients bloqués (US-20.4)", () => {
  it("liste les bloqués avec Débloquer et les no-shows avec les essais restants", async () => {
    render(<ClientsSurveilles bloques={[{ id: "k1", nom: "Yacine M.", telephone: "+213550112233", no_shows: 5, bloque: true, bloque_le: "2026-10-08T10:00:00Z" }]} avecNoShows={[{ id: "k2", nom: "Samia B.", telephone: "+213555123456", no_shows: 1, bloque: false, bloque_le: null }]} />);
    expect(screen.getByText("Bloqués (1)")).toBeInTheDocument();
    expect(screen.getByText("0550 11 22 33 · 5 no-shows")).toBeInTheDocument();
    expect(screen.getByText("4 essais restants")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Débloquer" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Débloquer" }));
    await waitFor(() => expect(debloquerCompteClient).toHaveBeenCalledWith("k1"));
    expect(await screen.findByRole("status")).toHaveTextContent("débloqué");
    expect(refresh).toHaveBeenCalled();
  });
  it("affiche des listes vides", () => {
    render(<ClientsSurveilles bloques={[]} avecNoShows={[]} />);
    expect(screen.getByText("Aucun client bloqué.")).toBeInTheDocument();
    expect(screen.getByText("Aucun no-show.")).toBeInTheDocument();
  });
  it("relecture point 11 : l’admin annule un no-show déclaré par une boutique", async () => {
    annulerNoShowClient.mockResolvedValue({ succes: true, message: "No-show annulé." });
    render(<ClientsSurveilles bloques={[]} avecNoShows={[{ id: "k2", nom: "Samia B.", telephone: "+213555123456", no_shows: 1, bloque: false, bloque_le: null }]}
      noShows={[{ id: "c7", numero: 7, client_id: "autre-compte", client_telephone: "+213555123456", no_show_le: "2026-10-09T10:00:00Z", boutiques: { nom: "Boutique Amine" } }]} />);
    expect(screen.getByText(/Commande n° 7 · Boutique Amine/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler le no-show de la commande n° 7" }));
    await waitFor(() => expect(annulerNoShowClient).toHaveBeenCalledWith("c7"));
    expect(await screen.findByRole("status")).toHaveTextContent("No-show annulé.");
    expect(refresh).toHaveBeenCalled();
  });
});

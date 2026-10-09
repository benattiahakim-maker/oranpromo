import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ClientsSurveilles from "./ClientsSurveilles";

const { debloquerCompteClient, annulerNoShowClient, bloquerCompteClient, refresh } = vi.hoisted(() => ({ debloquerCompteClient: vi.fn(), annulerNoShowClient: vi.fn(), bloquerCompteClient: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/clients/actions", () => ({ debloquerCompteClient, annulerNoShowClient, bloquerCompteClient }));
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
      noShows={[{ id: "c7", numero: 7, client_id: "k2", client_telephone: "+213555123456", no_show_le: "2026-10-09T10:00:00Z", boutiques: { nom: "Boutique Amine" } }]} />);
    expect(screen.getByText(/Commande n° 7 · Boutique Amine/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler le no-show de la commande n° 7" }));
    await waitFor(() => expect(annulerNoShowClient).toHaveBeenCalledWith("c7"));
    expect(await screen.findByRole("status")).toHaveTextContent("No-show annulé.");
    expect(refresh).toHaveBeenCalled();
  });
  it("relecture n°2 : n’affiche pas sous un compte les no-shows d’un autre compte avec le même numéro", () => {
    render(<ClientsSurveilles bloques={[]} avecNoShows={[{ id: "k2", nom: "Samia B.", telephone: "+213555123456", no_shows: 1, bloque: false, bloque_le: null }]}
      noShows={[{ id: "c8", numero: 8, client_id: "autre-compte", client_telephone: "+213555123456", no_show_le: "2026-10-09T10:00:00Z", boutiques: null }]} />);
    expect(screen.queryByText(/Commande n° 8/)).not.toBeInTheDocument();
  });
  it("relecture n°2 : signale le numéro partagé par plusieurs comptes et laisse l’admin décider", async () => {
    bloquerCompteClient.mockResolvedValue({ succes: true, message: "Client bloqué : il ne peut plus commander." });
    render(<ClientsSurveilles bloques={[]} avecNoShows={[]} numerosPartages={[{ telephone: "+213555123456", noShowsNumero: 5, comptes: [
      { id: "k1", nom: "Fraudeur", telephoneActuel: "+213555123456", noShows: 5, bloque: true },
      { id: "k2", nom: "Victime", telephoneActuel: "+213555123456", noShows: 0, bloque: false },
    ] }]} />);
    expect(screen.getByText("Numéro partagé par plusieurs comptes (1)")).toBeInTheDocument();
    expect(screen.getByText("0555 12 34 56 · 5 no-shows sur ce numéro")).toBeInTheDocument();
    expect(screen.getByText(/0 no-show sur ce compte/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bloquer Victime" }));
    await waitFor(() => expect(bloquerCompteClient).toHaveBeenCalledWith("k2"));
    expect(await screen.findByRole("status")).toHaveTextContent("Client bloqué");
    expect(refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Débloquer Fraudeur" }));
    await waitFor(() => expect(debloquerCompteClient).toHaveBeenCalledWith("k1"));
  });
  it("relecture n°2 : pas de section quand aucun numéro n’est partagé", () => {
    render(<ClientsSurveilles bloques={[]} avecNoShows={[]} />);
    expect(screen.queryByText(/Numéro partagé/)).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MesNoShows from "./MesNoShows";

const { contesterMonNoShow, refresh } = vi.hoisted(() => ({ contesterMonNoShow: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/compte/actions", () => ({ contesterMonNoShow }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); contesterMonNoShow.mockResolvedValue({ succes: true, message: "Contestation envoyée : OranPromo va l’examiner." }); });

const base = { id: "c1", numero: 12, no_show_le: "2026-10-09T10:00:00Z", contestee_le: null, contestation_validee_le: null, boutiques: { nom: "Boutique Nour" }, contestations: null };
const maintenant = Date.parse("2026-10-10T10:00:00Z");

describe("contester un no-show depuis /compte", () => {
  it("ouvre le formulaire, refuse un motif trop court sans appeler le serveur, puis envoie", async () => {
    render(<MesNoShows noShows={[base]} maintenant={maintenant} />);
    expect(screen.getByText("Commandes non récupérées (1)")).toBeInTheDocument();
    expect(screen.getByText(/Commande n° 12 · Boutique Nour/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Contester" }));
    const champ = screen.getByLabelText("Pourquoi contestez-vous ?");
    expect(champ).toHaveAttribute("maxLength", "300");
    fireEvent.change(champ, { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la contestation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("5 à 300 caractères");
    expect(contesterMonNoShow).not.toHaveBeenCalled();
    fireEvent.change(champ, { target: { value: "La boutique était fermée samedi" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la contestation" }));
    await waitFor(() => expect(contesterMonNoShow).toHaveBeenCalledWith("c1", "La boutique était fermée samedi"));
    expect(await screen.findByRole("status")).toHaveTextContent("Contestation envoyée");
    expect(refresh).toHaveBeenCalled();
  });
  it("affiche le refus du serveur", async () => {
    contesterMonNoShow.mockResolvedValue({ succes: false, message: "Vous avez déjà contesté ce no-show." });
    render(<MesNoShows noShows={[base]} maintenant={maintenant} />);
    fireEvent.click(screen.getByRole("button", { name: "Contester" }));
    fireEvent.change(screen.getByLabelText("Pourquoi contestez-vous ?"), { target: { value: "Je suis venue samedi" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la contestation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("déjà contesté");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("une seule contestation : en attente ou refusée, plus de bouton Contester", () => {
    render(<MesNoShows noShows={[
      { ...base, id: "c2", numero: 13, contestee_le: "2026-10-09T12:00:00Z", contestations: { motif: "J’étais malade" } },
      { ...base, id: "c3", numero: 14, contestee_le: "2026-10-09T12:00:00Z", contestations: { motif: "Erreur" }, contestation_validee_le: "2026-10-10T09:00:00Z" },
    ]} maintenant={maintenant} />);
    expect(screen.getByText("Contestation en cours d’examen")).toBeInTheDocument();
    expect(screen.getByText("Contestation refusée : la commande compte")).toBeInTheDocument();
    expect(screen.getByText("Votre motif : J’étais malade")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contester" })).not.toBeInTheDocument();
  });
  it("règle des 7 jours : plus de bouton Contester après le délai", () => {
    render(<MesNoShows noShows={[{ ...base, no_show_le: "2026-10-02T09:00:00Z" }]} maintenant={maintenant} />);
    expect(screen.getByText("Délai de contestation dépassé (7 jours).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contester" })).not.toBeInTheDocument();
  });
  it("une seule contestation en attente à la fois : les autres no-shows attendent la réponse", () => {
    render(<MesNoShows noShows={[{ ...base, id: "c2", contestee_le: "2026-10-09T12:00:00Z", contestations: { motif: "J’étais malade" } }, { ...base, id: "c4", numero: 20 }]} maintenant={maintenant} />);
    expect(screen.getByText(/quand OranPromo aura répondu à votre contestation en cours/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contester" })).not.toBeInTheDocument();
  });
});

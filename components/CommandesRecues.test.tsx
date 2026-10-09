import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CommandesRecues from "./CommandesRecues";
import type { CommandeRecue } from "@/lib/commandes";

const { changerStatutCommandeBoutique, refresh } = vi.hoisted(() => ({ changerStatutCommandeBoutique: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); changerStatutCommandeBoutique.mockResolvedValue({ succes: true, message: "Commande mise à jour." }); });

const commande = (statut: CommandeRecue["statut"], extra: Partial<CommandeRecue> = {}): CommandeRecue => ({ id: `c-${statut}`, numero: 15, client_id: "k", boutique_id: "b1", statut, client_nom: "Samia B.", client_telephone: "+213555123456", note: "Samedi", motif_annulation: null, total: 8700, cree_le: "2026-10-09T12:05:00Z", confirmee_le: null, prete_le: null, expire_le: statut === "prete" ? "2026-10-10T14:20:00Z" : null, terminee_le: null, lignes_commande: [{ id: "l1", commande_id: `c-${statut}`, article_id: "a", titre: "Polo", taille: "M", quantite: 1, prix_unitaire: 3500 }, { id: "l2", commande_id: `c-${statut}`, article_id: "b", titre: "Chemise", taille: "L", quantite: 1, prix_unitaire: 5200 }], ...extra });

describe("commandes reçues (US-20.3)", () => {
  it("affiche le client, son WhatsApp, les lignes, le total et la note", () => {
    render(<CommandesRecues commandes={[commande("demandee")]} boutique="Boutique Amine" />);
    expect(screen.getByText("N° 15 · Samia B.")).toBeInTheDocument();
    const lien = screen.getByRole("link", { name: "0555 12 34 56 · WhatsApp" }).getAttribute("href")!;
    expect(lien).toContain("https://wa.me/213555123456?");
    expect(screen.getByText(/Polo · M × 1/)).toBeInTheDocument();
    expect(screen.getByText(/Total 8\s700 DA · 2 pièces/)).toBeInTheDocument();
    expect(screen.getByText("Note du client : « Samedi »")).toBeInTheDocument();
  });
  it.each([["demandee", "Confirmer", "confirmee"], ["confirmee", "Prête", "prete"], ["prete", "Récupérée", "recuperee"]] as const)("statut %s : le bouton %s passe à %s", async (statut, bouton, suivant) => {
    render(<CommandesRecues commandes={[commande(statut)]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: bouton }));
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith(`c-${statut}`, suivant, null, ""));
    expect(refresh).toHaveBeenCalled();
  });
  it("annule avec un motif obligatoire et propose de corriger le stock", async () => {
    render(<CommandesRecues commandes={[commande("confirmee")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler la commande" }));
    expect(screen.getByRole("status")).toHaveTextContent("Choisissez le motif");
    expect(changerStatutCommandeBoutique).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Plus en stock" }));
    fireEvent.change(screen.getByLabelText("Message au client (facultatif)"), { target: { value: "Désolé" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler la commande" }));
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith("c-confirmee", "annulee", "plus_en_stock", "Désolé"));
    expect(await screen.findByRole("link", { name: "Corriger le stock dans Mes articles" })).toHaveAttribute("href", "/espace");
  });
  it("n’affiche aucun bouton pour une commande terminée et montre le motif", () => {
    render(<CommandesRecues commandes={[commande("annulee", { motif_annulation: "client_a_annule" })]} boutique="Boutique Amine" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Motif : Annulée par le client")).toBeInTheDocument();
  });
  it("affiche le refus de la base", async () => {
    changerStatutCommandeBoutique.mockResolvedValue({ succes: false, message: "Changement de statut impossible : la commande est déjà « annulée »." });
    render(<CommandesRecues commandes={[commande("demandee")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("déjà « annulée »");
  });
});

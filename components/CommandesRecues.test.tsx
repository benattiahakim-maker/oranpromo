import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CommandesRecues from "./CommandesRecues";
import type { CommandeRecue } from "@/lib/commandes";

const { changerStatutCommandeBoutique, declarerClientPasVenu, refresh } = vi.hoisted(() => ({ changerStatutCommandeBoutique: vi.fn(), declarerClientPasVenu: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique, declarerClientPasVenu }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); changerStatutCommandeBoutique.mockResolvedValue({ succes: true, message: "Commande mise à jour." }); });

const commande = (statut: CommandeRecue["statut"], extra: Partial<CommandeRecue> = {}): CommandeRecue => ({ id: `c-${statut}`, numero: 15, client_id: "k", boutique_id: "b1", statut, client_nom: "Samia B.", client_telephone: "+213555123456", note: "Samedi", motif_annulation: null, total: 8700, cree_le: "2026-10-09T12:05:00Z", confirmee_le: null, prete_le: null, expire_le: statut === "prete" ? "2999-10-10T14:20:00Z" : null, terminee_le: null, no_show_le: null, no_show_annule_le: null, contestee_le: null, contestation_validee_le: null, telephone_verifie: false, langue: "fr", mode_remise: null, bon_id: null, remise_bon: 0, lignes_commande: [{ id: "l1", commande_id: `c-${statut}`, article_id: "a", titre: "Polo", taille: "M", quantite: 1, prix_unitaire: 3500 }, { id: "l2", commande_id: `c-${statut}`, article_id: "b", titre: "Chemise", taille: "L", quantite: 1, prix_unitaire: 5200 }], ...extra });

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
  it.each([["demandee", "Confirmer", "confirmee"], ["confirmee", "Prête", "prete"]] as const)("statut %s : le bouton %s passe à %s", async (statut, bouton, suivant) => {
    render(<CommandesRecues commandes={[commande(statut)]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: bouton }));
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith(`c-${statut}`, suivant, null, ""));
    expect(refresh).toHaveBeenCalled();
  });
  it("US-26.3 : commande prête, guide vers le scan, sans bouton « Récupérée » direct", () => {
    render(<CommandesRecues commandes={[commande("prete")]} boutique="Boutique Amine" />);
    expect(screen.getByText(/Remise : scannez le QR code du client/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scanner" })).toHaveAttribute("href", "/espace/scanner");
    expect(screen.queryByRole("button", { name: "Récupérée" })).toBeNull();
  });
  it("correctif US-26 : commande prête, l’étiquette reste « Prête » et l’échéance passe sur sa propre ligne (le nom n’est plus écrasé)", () => {
    render(<CommandesRecues commandes={[commande("prete", { client_nom: "Samia Benkhaled-Bouziane B." })]} boutique="Boutique Amine" />);
    const etiquette = screen.getByText("Prête", { selector: "span" });
    expect(etiquette.textContent).toBe("Prête");
    expect(etiquette.className).toContain("shrink-0");
    const nom = screen.getByText(/N° 15 · Samia Benkhaled-Bouziane B\./);
    expect(nom.className).toContain("min-w-0");
    expect(screen.getByText(/^À récupérer jusqu’au /).tagName).toBe("P");
  });
  it("correctif US-26 : pas de ligne d’échéance pour une commande non prête", () => {
    render(<CommandesRecues commandes={[commande("confirmee")]} boutique="Boutique Amine" />);
    expect(screen.queryByText(/À récupérer jusqu’au/)).toBeNull();
  });
  it("US-26.3 : « Remis sans QR code » demande une confirmation avant de remettre", async () => {
    render(<CommandesRecues commandes={[commande("prete")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Remis sans QR code" }));
    expect(changerStatutCommandeBoutique).not.toHaveBeenCalled();
    expect(screen.getByText("Le client n’a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.queryByText(/ni QR code ni code/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remis sans QR code" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la remise" }));
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith("c-prete", "recuperee", null, ""));
    expect(refresh).toHaveBeenCalled();
  });
  it("US-26.3 : pas de lien de scan ni de remise manuelle hors « prête »", () => {
    render(<CommandesRecues commandes={[commande("confirmee")]} boutique="Boutique Amine" />);
    expect(screen.queryByText(/scannez le QR code/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Remis sans QR code" })).toBeNull();
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
  it("relecture point 1 : confirmation refusée faute de stock → message et lien pour corriger le stock", async () => {
    changerStatutCommandeBoutique.mockResolvedValue({ succes: false, message: "Stock insuffisant pour « Polo » en taille M : il reste 0 pièce(s), la commande en demande 1." });
    render(<CommandesRecues commandes={[commande("demandee")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Stock insuffisant pour « Polo » en taille M");
    expect(screen.getByRole("link", { name: "Corriger le stock dans Mes articles" })).toHaveAttribute("href", "/espace");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("relecture point 11 : « Client pas venu » sur une commande expirée, avec confirmation", async () => {
    declarerClientPasVenu.mockResolvedValue({ succes: true, message: "C’est noté : le client est averti." });
    render(<CommandesRecues commandes={[commande("expiree")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Client pas venu" }));
    expect(declarerClientPasVenu).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer : pas venu" }));
    await waitFor(() => expect(declarerClientPasVenu).toHaveBeenCalledWith("c-expiree"));
    expect(await screen.findByRole("status")).toHaveTextContent("le client est averti");
    expect(refresh).toHaveBeenCalled();
  });
  it("relecture point 11 : pas de bouton avant 24 h ni deux fois ; prête depuis plus de 24 h → bouton", () => {
    const { unmount } = render(<CommandesRecues commandes={[commande("prete"), commande("expiree", { id: "c-signalee", no_show_le: "2026-10-09T10:00:00Z" })]} boutique="Boutique Amine" />);
    expect(screen.queryByRole("button", { name: "Client pas venu" })).toBeNull();
    expect(screen.getByText(/Client pas venu · signalé le/)).toBeInTheDocument();
    unmount();
    render(<CommandesRecues commandes={[commande("prete", { expire_le: "2020-01-01T00:00:00Z" })]} boutique="Boutique Amine" />);
    expect(screen.getByRole("button", { name: "Client pas venu" })).toBeInTheDocument();
  });
});

describe("US-27.4 : bon parrainage dans la liste de la boutique", () => {
  it("sous le total : « Bon parrainage −300 DA · à encaisser 8 400 DA »", () => {
    render(<CommandesRecues commandes={[commande("confirmee", { bon_id: "b1", remise_bon: 300 })]} boutique="Boutique Amine" />);
    expect(screen.getByText(/Bon parrainage −300\sDA · à encaisser 8\s400\sDA/)).toBeInTheDocument();
  });
  it("sans bon : pas de ligne", () => {
    render(<CommandesRecues commandes={[commande("confirmee")]} boutique="Boutique Amine" />);
    expect(screen.queryByText(/Bon parrainage/)).toBeNull();
  });
  it("« Remis sans QR code » avec un bon : la confirmation dit d'encaisser le total, le bon reste au client", () => {
    render(<CommandesRecues commandes={[commande("prete", { bon_id: "b1", remise_bon: 300 })]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Remis sans QR code" }));
    expect(screen.getByText(/Sans QR code ni code, le bon ne s’applique pas : encaissez 8\s700\sDA\. Le bon reste au client\./)).toBeInTheDocument();
    expect(changerStatutCommandeBoutique).not.toHaveBeenCalled();
  });
  it("« Remis sans QR code » sans bon : pas de phrase sur le bon", () => {
    render(<CommandesRecues commandes={[commande("prete")]} boutique="Boutique Amine" />);
    fireEvent.click(screen.getByRole("button", { name: "Remis sans QR code" }));
    expect(screen.queryByText(/le bon ne s’applique pas/)).toBeNull();
  });
});

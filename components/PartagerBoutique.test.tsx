import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PartagerBoutique from "./PartagerBoutique";
import type { PartageBoutique } from "@/lib/lien-boutique";

const partage: PartageBoutique = { nom: "Boutique Nour", slug: "boutique-nour", statut: "validee", lien: "https://oranpromo.com/b/boutique-nour", lienWhatsApp: "https://wa.me/?text=Bonjour", qrCode: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E", fichierQrCode: "oranpromo-boutique-nour-qr.svg" };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("US-22 : Partager ma boutique", () => {
  it("copie le lien et le confirme", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<PartagerBoutique partage={partage} />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Lien copié"));
    expect(writeText).toHaveBeenCalledWith("https://oranpromo.com/b/boutique-nour");
  });
  it("explique quoi faire si la copie échoue", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("refusé")) }, configurable: true });
    render(<PartagerBoutique partage={partage} />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sélectionnez le lien"));
  });
  it("propose WhatsApp, le QR code à télécharger et l’affiche", () => {
    render(<PartagerBoutique partage={partage} />);
    expect(screen.getByRole("link", { name: "Partager sur WhatsApp" })).toHaveAttribute("href", "https://wa.me/?text=Bonjour");
    expect(screen.getByRole("img", { name: "QR code du lien de Boutique Nour" })).toHaveAttribute("src", partage.qrCode);
    expect(screen.getByRole("link", { name: "Télécharger le QR code" })).toHaveAttribute("download", "oranpromo-boutique-nour-qr.svg");
    expect(screen.getByRole("link", { name: "Imprimer l’affiche" })).toHaveAttribute("href", "/espace/affiche");
  });
  it.each([["en_attente", "validée par OranPromo"], ["suspendue", "Boutique indisponible"]] as const)("boutique %s : message seulement", (statut, texte) => {
    render(<PartagerBoutique partage={{ ...partage, statut, lienWhatsApp: null, qrCode: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent(texte);
    expect(screen.queryByRole("button", { name: "Copier le lien" })).toBeNull(); expect(screen.queryByRole("img")).toBeNull();
  });
});

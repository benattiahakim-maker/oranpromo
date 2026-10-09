import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReservationArticle from "./ReservationArticle";

afterEach(cleanup);
const { insert } = vi.hoisted(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("@/lib/supabase/client", () => ({ creerClientNavigateur: () => ({ from: () => ({ insert }) }) }));
const article = { articleId: "1234", boutiqueId: "boutique", titre: "Polo bleu", prix: 3500, telephone: "+213 555 12 34 56" };
describe("réservation WhatsApp (US-07)", () => {
  it("demande une taille et prépare le message avec le prix et le lien", () => {
    render(<ReservationArticle {...article} tailles={[{ libelle: "S", disponible: false }, { libelle: "M", disponible: true }]} />);
    expect((screen.getByRole("button", { name: "Réserver sur WhatsApp" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Taille S, épuisée") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Taille M"));
    const lien = screen.getByRole("link", { name: "Réserver sur WhatsApp" }).getAttribute("href")!;
    expect(lien).toContain("https://wa.me/213555123456?");
    const message = new URL(lien).searchParams.get("text")!;
    expect(message).toContain("Polo bleu, taille M");
    expect(message).toContain("/a/1234 (vu sur OranPromo)");
    expect(message.replace(/\s/g, " ")).toContain("3 500 DA");
  });
  it("autorise directement la réservation en taille unique", () => {
    render(<ReservationArticle {...article} tailles={[{ libelle: "Unique", disponible: true }]} />);
    expect(screen.getByRole("link", { name: "Réserver sur WhatsApp" }).getAttribute("href")).toContain("wa.me");
  });
  it("enregistre le clic avec l’article et la taille, sans données personnelles", () => {
    render(<ReservationArticle {...article} tailles={[{ libelle: "M", disponible: true }]} />);
    fireEvent.click(screen.getByLabelText("Taille M"));
    fireEvent.click(screen.getByRole("link", { name: "Réserver sur WhatsApp" }));
    expect(insert).toHaveBeenCalledWith({ type: "clic_reserver", article_id: "1234", boutique_id: "boutique", taille: "M" });
  });
});

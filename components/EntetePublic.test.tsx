import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/app/langue/actions", () => ({ choisirLangue: vi.fn() }));
import EntetePublic from "./EntetePublic";
import FournisseurTextes from "./FournisseurTextes";
import { textesDe } from "@/lib/textes";
afterEach(cleanup);

describe("US-23 : sélecteur de langue dans l'en-tête", () => {
  it("en français : bouton « عربي » visible, qui envoie langue=ar", () => {
    render(<FournisseurTextes langue="fr" textes={textesDe("fr")}><EntetePublic /></FournisseurTextes>);
    const bouton = screen.getByRole("button", { name: "العربية" });
    expect(bouton.textContent).toBe("عربي");
    expect(bouton.getAttribute("name")).toBe("langue");
    expect(bouton.getAttribute("value")).toBe("ar");
    expect(bouton.getAttribute("lang")).toBe("ar");
    expect(bouton.className).toContain("min-h-11");
    expect(screen.getByRole("link", { name: "Rechercher" }).getAttribute("href")).toBe("/catalogue");
    expect(screen.getByRole("link", { name: "Panier" })).toBeTruthy();
  });
  it("en arabe : bouton « FR » pour revenir au français, en-tête en arabe", () => {
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><EntetePublic /></FournisseurTextes>);
    const bouton = screen.getByRole("button", { name: "Français" });
    expect(bouton.textContent).toBe("FR");
    expect(bouton.getAttribute("value")).toBe("fr");
    expect(screen.getByRole("link", { name: "ابحث" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "السلة" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "تصفح الموقع" })).toBeTruthy();
  });
  it("sans fournisseur (par défaut) : français", () => {
    render(<EntetePublic />);
    expect(screen.getByRole("button", { name: "العربية" })).toBeTruthy();
  });
  it("US-24.3 : lien « Carte » vers /carte, et le panier en icône avec un nom lisible", () => {
    render(<FournisseurTextes langue="fr" textes={textesDe("fr")}><EntetePublic /></FournisseurTextes>);
    expect(screen.getByRole("link", { name: "Carte" }).getAttribute("href")).toBe("/carte");
    const panier = screen.getByRole("link", { name: "Panier" });
    expect(panier.getAttribute("href")).toBe("/panier");
    expect(panier.querySelector("svg")).toBeTruthy();
    expect(panier.textContent).toBe("");
  });
  it("US-24.3 : en arabe, « الخريطة »", () => {
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><EntetePublic /></FournisseurTextes>);
    expect(screen.getByRole("link", { name: "الخريطة" }).getAttribute("href")).toBe("/carte");
  });
});

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

describe("US-29.2 : en-tête sur une page de ville", () => {
  const oran = { code: "oran", nom: "Oran", nom_ar: "وهران" };
  it("logo, recherche et carte restent dans la ville ; pas de bouton ville avec une seule ville ouverte", () => {
    render(<FournisseurTextes langue="fr" textes={textesDe("fr")}><EntetePublic ville={oran} /></FournisseurTextes>);
    expect(screen.getByRole("link", { name: "ORANPROMO" }).getAttribute("href")).toBe("/oran");
    expect(screen.getByRole("link", { name: "Rechercher" }).getAttribute("href")).toBe("/oran/catalogue");
    expect(screen.getByRole("link", { name: "Carte" }).getAttribute("href")).toBe("/oran/carte");
    expect(screen.queryByRole("link", { name: /Changer de ville/ })).toBeNull();
  });
  it("à partir de 2 villes ouvertes : « Oran ▾ » vers /villes, nom lu « Changer de ville, ville actuelle : Oran »", () => {
    render(<FournisseurTextes langue="fr" textes={textesDe("fr")}><EntetePublic ville={oran} choixVille /></FournisseurTextes>);
    const bouton = screen.getByRole("link", { name: "Changer de ville, ville actuelle : Oran" });
    expect(bouton.textContent).toBe("Oran ▾");
    expect(bouton.getAttribute("href")).toMatch(/^\/villes\?retour=/);
  });
  it("en arabe : « وهران ▾ »", () => {
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><EntetePublic ville={oran} choixVille /></FournisseurTextes>);
    expect(screen.getByRole("link", { name: "بدّل المدينة، المدينة دروك: وهران" }).textContent).toBe("وهران ▾");
  });
});

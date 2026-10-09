// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LienPanier from "./LienPanier";
import FournisseurTextes from "./FournisseurTextes";
import { textesDe } from "@/lib/textes";
import { CLE_PANIER } from "@/lib/panier";

afterEach(() => { cleanup(); localStorage.clear(); });
const ligne = (quantite: number) => ({ articleId: "a", titre: "Robe", taille: "M", quantite, prix: 3500, photo: null });

describe("US-24.3 : panier en icône de sac avec le nombre", () => {
  it("vide : « Panier », sans pastille", () => {
    render(<LienPanier />);
    expect(screen.getByRole("link", { name: "Panier" }).textContent).toBe("");
  });
  it.each([[1, "Panier, 1 article"], [2, "Panier, 2 articles"]])("%i article(s) : pastille et nom « %s »", (n, nom) => {
    localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "b", boutiqueNom: "Boutique Nour", lignes: [ligne(n)] }));
    render(<LienPanier />);
    const lien = screen.getByRole("link", { name: nom });
    expect(lien.textContent).toBe(String(n));
  });
  it("en arabe : « السلة (2) »", () => {
    localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "b", boutiqueNom: "Boutique Nour", lignes: [ligne(2)] }));
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><LienPanier /></FournisseurTextes>);
    expect(screen.getByRole("link", { name: "السلة (2)" })).toBeTruthy();
  });
});

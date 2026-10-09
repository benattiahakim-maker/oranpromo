import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import VuePreparation from "./VuePreparation";
import { grouperPreparation } from "@/lib/tableau-commandes";
afterEach(cleanup);

const M = Date.parse("2026-10-09T13:05:00Z");
const prep = grouperPreparation([
  { id: "a", numero: 118, client_nom: "Nadia K.", total: 11600, remise_bon: 0, lignes_commande: [{ article_id: "polo", titre: "Polo piqué", taille: "M", quantite: 2, articles: { categorie: "Polos" } }] },
  { id: "b", numero: 121, client_nom: "Yacine", total: 3900, remise_bon: 300, lignes_commande: [{ article_id: "parf", titre: "Eau de parfum", taille: "50 ml", quantite: 1, articles: { categorie: "Parfums" } }] },
], ["Polos", "Parfums"]);

describe("US-28.3 : page de préparation", () => {
  it("en-tête, articles regroupés avec cases, liste par commande, bouton Imprimer", () => {
    render(<VuePreparation boutique="Parfumerie Démo" maintenant={M} preparation={prep} erreur={null} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Liste de préparation");
    expect(screen.getByText("Parfumerie Démo · vendredi 09/10 à 14 h 05 · 2 commandes confirmées · 3 pièces")).toBeInTheDocument();
    const polo = screen.getByRole("region", { name: "Polo piqué" });
    expect(within(polo).getByText("2 pièces")).toBeInTheDocument();
    expect(within(polo).getByText("N° 118 Nadia ×2")).toBeInTheDocument();
    expect(screen.getByText(/N° 121 · Yacine · 1 pièce · 3\s600 DA/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Commandes" })).toHaveAttribute("href", "/espace/commandes?etape=a_preparer");
    expect(screen.queryByRole("img")).toBeNull(); // pas de photo (décision 6)
  });
  it("rien à préparer", () => {
    render(<VuePreparation boutique="X" maintenant={M} preparation={grouperPreparation([], [])} erreur={null} />);
    expect(screen.getByText("Rien à préparer pour le moment.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imprimer" })).toBeNull();
  });
  it("erreur de lecture", () => {
    render(<VuePreparation boutique="X" maintenant={M} preparation={null} erreur="Impossible de charger les commandes. Réessayez." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les commandes.");
  });
});

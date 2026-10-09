import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import TuilesAccueil from "./TuilesAccueil";
import CarteArticle from "./CarteArticle";

vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => <span data-src={props.src} data-alt={props.alt} /> }));
afterEach(cleanup);

describe("page d’accueil : tuiles et badge promo", () => {
  it("affiche l’image de marque avec son texte alternatif et lie au catalogue filtré", () => {
    render(<TuilesAccueil titre="Les univers" tuiles={[{ nom: "Femme", lien: "/catalogue?univers=femme", image: { adresse: "/images/accueil/univers-femme.webp", alt: "Robe terracotta" } }, { nom: "Enfant", lien: "/catalogue?univers=enfant", image: { adresse: "/images/accueil/univers-enfant.webp", alt: "Salopette" } }]} />);
    const section = screen.getByRole("region", { name: "Les univers" });
    expect(within(section).getByRole("link", { name: /Femme/ }).getAttribute("href")).toBe("/catalogue?univers=femme");
    const images = section.querySelectorAll("[data-src]");
    expect([...images].map(i => [i.getAttribute("data-src"), i.getAttribute("data-alt")])).toEqual([["/images/accueil/univers-femme.webp", "Robe terracotta"], ["/images/accueil/univers-enfant.webp", "Salopette"]]);
    expect(within(section).getByText("Enfant")).toBeTruthy();
  });
  it("affiche le badge −XX % en plus du prix barré sur une carte en promo", () => {
    render(<CarteArticle article={{ id: "1", titre: "Polo", description: null, categorie: "T-shirts et polos", genre: "homme", prix: 4500, cree_le: "2026-10-09", boutique: { nom: "Amine", quartier: "Centre" }, photo: "https://exemple.fr/v.jpg", tailles: ["M"], promo: { prixPromo: 3500, dateFin: "2999-01-01" } }} />);
    expect(screen.getByText("−22 %")).toBeTruthy();
    expect(screen.getByText("4 500 DA").tagName).toBe("DEL");
  });
});

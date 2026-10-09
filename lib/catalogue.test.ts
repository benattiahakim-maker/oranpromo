import { describe, expect, it } from "vitest";
import { filtrerCatalogue, type CarteArticle } from "./catalogue";

const article: CarteArticle = { id: "1", titre: "PÔLO bleu", description: "Coton léger", categorie: "Hauts", genre: "homme", prix: 3500, cree_le: "2026-10-08", boutique: { nom: "Test", quartier: "Centre" }, photo: null, tailles: ["M"], promo: { prixPromo: 2000, dateFin: "2026-11-01" } };
const maintenant = new Date("2026-10-08");
describe("catalogue (US-05, US-06)", () => {
  it("recherche sans accents ni distinction de casse dans les trois champs", () => {
    for (const q of ["polo", "LEGER", "hauts"]) expect(filtrerCatalogue([article], { q }, maintenant)).toHaveLength(1);
    expect(filtrerCatalogue([article], { q: "jean" }, maintenant)).toHaveLength(0);
  });
  it("combine tous les filtres et utilise le prix promo actif", () => {
    expect(filtrerCatalogue([article], { categorie: "Hauts", taille: "M", genre: "homme", min: 1500, max: 2500, quartier: "Centre", promo: true }, maintenant)).toHaveLength(1);
    expect(filtrerCatalogue([article], { taille: "S" }, maintenant)).toHaveLength(0);
    expect(filtrerCatalogue([article], { max: 2500, promo: true }, new Date("2026-12-01"))).toHaveLength(0);
  });
});

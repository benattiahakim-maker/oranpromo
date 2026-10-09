import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CREDIT_GRANDE_PHOTO, GRANDE_PHOTO, lienCategorie, PIECES_PHARES, TUILES_PIECES_PHARES, TUILES_UNIVERS } from "./accueil";
import { CATEGORIES_ARTICLE } from "./article";

const fichier = (adresse: string) => path.join(process.cwd(), "public", adresse);

describe("images de la page d’accueil", () => {
  it("tuiles univers : une image de marque par univers, liée au catalogue filtré", () => {
    expect(TUILES_UNIVERS.map(u => [u.nom, u.lien, u.image.adresse])).toEqual([
      ["Femme", "/catalogue?univers=femme", "/images/accueil/univers-femme.webp"],
      ["Homme", "/catalogue?univers=homme", "/images/accueil/univers-homme.webp"],
      ["Enfant", "/catalogue?univers=enfant", "/images/accueil/univers-enfant.webp"],
      ["Beauté", "/catalogue?univers=beaute", "/images/accueil/univers-beaute.webp"],
    ]);
  });
  it("pièces phares : catégories de la liste officielle, chacune avec son image", () => {
    expect(PIECES_PHARES.every(c => CATEGORIES_ARTICLE.some(x => x === c))).toBe(true);
    expect(TUILES_PIECES_PHARES.map(t => t.nom)).toEqual([...PIECES_PHARES]);
    expect(TUILES_PIECES_PHARES[1]).toEqual({ nom: "Abayas, djellabas, kamis", lien: "/catalogue?categorie=Abayas%2C+djellabas%2C+kamis", image: { adresse: "/images/accueil/cat-abayas-djellabas-kamis.webp", alt: expect.any(String) } });
    expect(lienCategorie("Abayas, djellabas, kamis")).toBe("/catalogue?categorie=Abayas%2C+djellabas%2C+kamis");
  });
  it("chaque tuile a un texte alternatif en français et un fichier WebP léger (60 Ko au plus)", () => {
    for (const tuile of [...TUILES_UNIVERS, ...TUILES_PIECES_PHARES]) {
      expect(tuile.image.alt.length).toBeGreaterThan(10);
      expect(tuile.image.adresse).toMatch(/^\/images\/accueil\/[a-z-]+\.webp$/);
      expect(existsSync(fichier(tuile.image.adresse))).toBe(true);
      expect(statSync(fichier(tuile.image.adresse)).size).toBeLessThanOrEqual(60 * 1024);
    }
  });
  it("grande photo : fichier local de 120 Ko au plus, décorative, avec un crédit complet", () => {
    expect(GRANDE_PHOTO.alt).toBe("");
    expect(existsSync(fichier(GRANDE_PHOTO.adresse))).toBe(true);
    expect(statSync(fichier(GRANDE_PHOTO.adresse)).size).toBeLessThanOrEqual(120 * 1024);
    expect(CREDIT_GRANDE_PHOTO).toEqual({ auteur: "Bachounda", licence: "CC BY-SA 4.0", lienLicence: expect.stringMatching(/^https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\//), source: "Wikimedia Commons", lienSource: "https://commons.wikimedia.org/wiki/File:Santa_cruz_Oran.jpg" });
  });
});

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODES_RESERVES, VILLE_ORAN, cheminApresChoix, cheminVille, codeVilleValide, deVille, nomVille, villeDeLaPosition, villeParDefaut } from "./ville";

const villes = ["oran", "mostaganem", "tlemcen"];
const tlemcen = { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75 };

describe("US-29.2 : codes de ville", () => {
  it("chaque dossier fixe de app/ et de public/ est un code réservé (une ville ne prend jamais une page)", () => {
    const dossiers = [...readdirSync("app", { withFileTypes: true }), ...readdirSync("public", { withFileTypes: true })]
      .filter(e => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("(") && !e.name.startsWith("_")).map(e => e.name);
    expect(dossiers.length).toBeGreaterThan(10);
    for (const dossier of dossiers) expect(CODES_RESERVES, dossier).toContain(dossier);
    expect(CODES_RESERVES).toContain("favicon");
  });
  it("forme : minuscules et tirets, 2 à 30 caractères ; mots réservés refusés", () => {
    expect(codeVilleValide("oran")).toBe(true); expect(codeVilleValide("tizi-ouzou")).toBe(true);
    for (const code of ["Oran", "a", "o", "oran1", "-oran", "catalogue", "villes", "espace", "x".repeat(31), "", null, undefined]) expect(codeVilleValide(code), String(code)).toBe(false);
  });
});

describe("US-29.2 : ville par défaut (/, /catalogue, /carte)", () => {
  it("cookie d'une ville ouverte ; sinon la seule ville ouverte (Oran aujourd'hui) ; sinon page de choix", () => {
    expect(villeParDefaut(null, [{ code: "oran" }])).toBe("oran");
    expect(villeParDefaut("tlemcen", [{ code: "oran" }])).toBe("oran");
    expect(villeParDefaut("tlemcen", [{ code: "oran" }, { code: "tlemcen" }])).toBe("tlemcen");
    expect(villeParDefaut(null, [{ code: "oran" }, { code: "tlemcen" }])).toBeNull();
    expect(villeParDefaut("alger", [{ code: "oran" }, { code: "tlemcen" }])).toBeNull();
    expect(villeParDefaut(null, [])).toBeNull();
  });
});

describe("US-29.2 : page après le choix d'une ville", () => {
  it("même page dans la nouvelle ville, paramètres gardés", () => {
    expect(cheminApresChoix("tlemcen", "/oran/catalogue?q=robe&promo=1", villes)).toBe("/tlemcen/catalogue?q=robe&promo=1");
    expect(cheminApresChoix("tlemcen", "/oran/carte", villes)).toBe("/tlemcen/carte");
    expect(cheminApresChoix("tlemcen", "/oran", villes)).toBe("/tlemcen");
    expect(cheminApresChoix("tlemcen", "/catalogue?promo=1", villes)).toBe("/tlemcen/catalogue?promo=1");
    expect(cheminApresChoix("tlemcen", "/carte?univers=homme", villes)).toBe("/tlemcen/carte?univers=homme");
    expect(cheminApresChoix("tlemcen", "/", villes)).toBe("/tlemcen");
    expect(cheminApresChoix("tlemcen", "/?promo=1", villes)).toBe("/tlemcen?promo=1");
  });
  it("page globale gardée ; rien, /villes ou adresse extérieure → accueil de la ville", () => {
    expect(cheminApresChoix("oran", "/panier", villes)).toBe("/panier");
    expect(cheminApresChoix("oran", "/b/boutique-nour", villes)).toBe("/b/boutique-nour");
    for (const retour of ["", null, undefined, "//evil.example", "/\\evil.example", "https://evil.example", "/villes?inconnue=x"]) expect(cheminApresChoix("oran", retour, villes), String(retour)).toBe("/oran");
  });
  it("cheminVille", () => {
    expect(cheminVille("oran")).toBe("/oran"); expect(cheminVille("oran", "/")).toBe("/oran"); expect(cheminVille("oran", "/catalogue?promo=1")).toBe("/oran/catalogue?promo=1");
  });
});

describe("US-29.2 : noms et position", () => {
  it("« d'Oran », « d'Alger », « de Tlemcen » (comme la base)", () => {
    expect(deVille("Oran")).toBe("d’Oran"); expect(deVille("Alger")).toBe("d’Alger"); expect(deVille("Annaba")).toBe("d’Annaba");
    expect(deVille("Tlemcen")).toBe("de Tlemcen"); expect(deVille("Béjaïa")).toBe("de Béjaïa"); expect(deVille("Tizi Ouzou")).toBe("de Tizi Ouzou");
  });
  it("nom selon la langue", () => {
    expect(nomVille(VILLE_ORAN, "fr")).toBe("Oran"); expect(nomVille(VILLE_ORAN, "ar")).toBe("وهران");
  });
  it("« Me localiser » : ville dont les bornes contiennent la position, bornes comprises ; hors de toutes : aucune", () => {
    expect(villeDeLaPosition([VILLE_ORAN, tlemcen], 35.7303, -0.5784)?.code).toBe("oran");
    expect(villeDeLaPosition([VILLE_ORAN, tlemcen], 34.8818, -1.3167)?.code).toBe("tlemcen");
    expect(villeDeLaPosition([VILLE_ORAN], 35.33, -1.15)?.code).toBe("oran");
    expect(villeDeLaPosition([VILLE_ORAN, tlemcen], 36.7729, 3.0588)).toBeNull();
  });
  it("Oran de secours : mêmes bornes et centre que la base", () => {
    expect(VILLE_ORAN).toMatchObject({ code: "oran", lat_min: 35.33, lat_max: 35.92, lng_min: -1.15, lng_max: -0.10, centre_lat: 35.6971, centre_lng: -0.6337, zoom: 12 });
  });
});

describe("US-29.3 : ville lue avec une boutique", () => {
  it("objet, tableau ou rien", async () => {
    const { villeLue } = await import("./ville");
    expect(villeLue({ nom: "Oran" })).toEqual({ nom: "Oran" });
    expect(villeLue([{ nom: "Oran" }])).toEqual({ nom: "Oran" });
    expect(villeLue([])).toBeNull(); expect(villeLue(null)).toBeNull();
  });
});

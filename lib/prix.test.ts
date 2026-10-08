import { describe, expect, it } from "vitest";
import { formaterPrix, pourcentageReduction, prixAffiche, promoActive } from "./prix";

const maintenant = new Date("2026-10-10T12:00:00Z");

describe("promoActive", () => {
  it("est vraie avant la date de fin", () => {
    expect(promoActive({ prixPromo: 3500, dateFin: "2026-10-18T23:59:59Z" }, maintenant)).toBe(true);
  });
  it("est fausse après la date de fin", () => {
    expect(promoActive({ prixPromo: 3500, dateFin: "2026-10-01T00:00:00Z" }, maintenant)).toBe(false);
  });
  it("est fausse sans promo", () => {
    expect(promoActive(null, maintenant)).toBe(false);
  });
});

describe("prixAffiche", () => {
  it("renvoie le prix promo si la promo est active", () => {
    expect(prixAffiche(4500, { prixPromo: 3500, dateFin: "2026-10-18T23:59:59Z" }, maintenant)).toBe(3500);
  });
  it("renvoie le prix normal si la promo est expirée", () => {
    expect(prixAffiche(4500, { prixPromo: 3500, dateFin: "2026-10-01T00:00:00Z" }, maintenant)).toBe(4500);
  });
});

describe("pourcentageReduction", () => {
  it("arrondit à l'entier", () => {
    expect(pourcentageReduction(4500, 3500)).toBe(22);
  });
});

describe("formaterPrix", () => {
  it("formate en dinars à la française", () => {
    expect(formaterPrix(3500)).toBe("3 500 DA");
    expect(formaterPrix(0)).toBe("0 DA");
  });
});

import { describe, expect, it } from "vitest";
import { aEncaisser, bonApplicable, moisAlger, premierDuMoisSuivant, resultatBon } from "./bons";

describe("bons de parrainage (US-27)", () => {
  it("montant à encaisser = total − bon", () => {
    expect(aEncaisser(3500, 300)).toBe(3200);
    expect(aEncaisser(3500, 0)).toBe(3500);
    expect(aEncaisser(3500, null)).toBe(3500);
    expect(aEncaisser(200, 300)).toBe(0);
  });

  it("bon utilisable dès 1 000 DA, seulement s'il y en a un", () => {
    expect(bonApplicable(1000, true)).toBe(true);
    expect(bonApplicable(999, true)).toBe(false);
    expect(bonApplicable(5000, false)).toBe(false);
  });

  it("réponses de la base reconnues, le reste rejeté", () => {
    expect(resultatBon("applique")).toBe("applique");
    expect(resultatBon("minimum")).toBe("minimum");
    expect(resultatBon("autre")).toBeNull();
    expect(resultatBon(null)).toBeNull();
  });

  it("mois et 1er du mois suivant à l'heure d'Alger", () => {
    // 31 octobre 23 h 30 UTC = 1er novembre 0 h 30 à Alger (UTC+1).
    expect(moisAlger(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(moisAlger(new Date("2026-10-31T22:30:00Z"))).toBe("2026-10-01");
    expect(premierDuMoisSuivant(new Date("2026-10-15T12:00:00Z"))).toBe("2026-11-01");
    expect(premierDuMoisSuivant(new Date("2026-12-15T12:00:00Z"))).toBe("2027-01-01");
  });
});

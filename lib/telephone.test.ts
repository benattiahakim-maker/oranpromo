import { describe, expect, it } from "vitest";
import { CANAL_CODE, modeConnexionClient, nettoyerCode, normaliserTelephoneClient, telephoneClientValide } from "./telephone";

describe("normaliserTelephoneClient (US-21)", () => {
  it.each([
    ["0555 12 34 56", "+213555123456"],
    ["0555123456", "+213555123456"],
    ["555123456", "+213555123456"],
    ["+213 555 12 34 56", "+213555123456"],
    ["+213555123456", "+213555123456"],
    ["00213555123456", "+213555123456"],
    ["0213555123456", "+213555123456"],
    ["213555123456", "+213555123456"],
    ["+213 0555 12 34 56", "+213555123456"],
    ["06.12.34.56.78", "+213612345678"],
    ["07-98-76-54-32", "+213798765432"],
    ["(0)7 98 76 54 32", "+213798765432"],
    ["\u00a00661 23 45 67 ", "+213661234567"],
  ])("accepte %s", (saisie, attendu) => {
    expect(normaliserTelephoneClient(saisie)).toBe(attendu);
  });

  it.each([
    ["0412345678", "fixe (04)"],
    ["021 23 45 67", "fixe d’Alger"],
    ["0855123456", "préfixe 08"],
    ["055512345", "trop court"],
    ["05551234567", "trop long"],
    ["+33612345678", "France"],
    ["+212612345678", "Maroc"],
    ["0033612345678", "étranger avec 00"],
    ["05551234a6", "lettre"],
    ["", "vide"],
    ["++213555123456", "double +"],
    ["0".repeat(41), "beaucoup trop long"],
  ])("refuse %s (%s)", saisie => {
    expect(normaliserTelephoneClient(saisie)).toBeNull();
  });

  it("refuse ce qui n’est pas du texte", () => {
    expect(normaliserTelephoneClient(null)).toBeNull();
    expect(normaliserTelephoneClient(undefined)).toBeNull();
    expect(normaliserTelephoneClient(555123456 as unknown as string)).toBeNull();
  });
});

describe("telephoneClientValide", () => {
  it("n’accepte que le format +213 5/6/7 et 8 chiffres", () => {
    expect(telephoneClientValide("+213555123456")).toBe(true);
    expect(telephoneClientValide("+213455123456")).toBe(false);
    expect(telephoneClientValide("213555123456")).toBe(false);
    expect(telephoneClientValide(null)).toBe(false);
  });
});

describe("modeConnexionClient", () => {
  it("e-mail par défaut, téléphone seulement si demandé", () => {
    expect(modeConnexionClient(undefined)).toBe("email");
    expect(modeConnexionClient("")).toBe("email");
    expect(modeConnexionClient("email")).toBe("email");
    expect(modeConnexionClient("sms")).toBe("email");
    expect(modeConnexionClient("telephone")).toBe("telephone");
    expect(modeConnexionClient(" Telephone ")).toBe("telephone");
  });
});

describe("canal et nettoyerCode", () => {
  it("WhatsApp uniquement, jamais de SMS", () => {
    expect(CANAL_CODE).toBe("whatsapp");
  });
  it("code à 6 chiffres", () => {
    expect(nettoyerCode("123456")).toBe("123456");
    expect(nettoyerCode(" 123 456 ")).toBe("123456");
    expect(nettoyerCode("12345")).toBeNull();
    expect(nettoyerCode("1234567")).toBeNull();
    expect(nettoyerCode("12345a")).toBeNull();
    expect(nettoyerCode(null)).toBeNull();
  });
});

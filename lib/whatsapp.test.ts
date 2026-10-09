import { describe, expect, it } from "vitest";
import { lienRelanceBoutique, lienAvertissementBoutique, lienReservation, messageReservation, numeroWhatsApp } from "./whatsapp";

const demande = {
  telephoneBoutique: "+213 555 12 34 56",
  titre: "Polo piqué bleu marine",
  taille: "M",
  prix: 3500,
  lien: "https://oranpromo.com/a/1234",
};

it("prépare le message exact de relance de boutique", () => {
  const lien = new URL(lienRelanceBoutique("+213 555 12 34 56"));
  expect(lien.pathname).toBe("/213555123456");
  expect(lien.searchParams.get("text")).toBe("Bonjour, pensez à mettre à jour vos articles sur OranPromo");
});

it("prépare l’avertissement WhatsApp avec le titre et le lien de l’article", () => {
  const url = new URL(lienAvertissementBoutique("+213 555 12 34 56", "Polo bleu", "https://oranpromo.com/a/123"));
  expect(url.pathname).toBe("/213555123456");
  expect(url.searchParams.get("text")).toContain("Polo bleu");
  expect(url.searchParams.get("text")).toContain("signalements sur OranPromo");
  expect(url.searchParams.get("text")).toContain("https://oranpromo.com/a/123");
});

describe("numeroWhatsApp", () => {
  it("ne garde que les chiffres", () => {
    expect(numeroWhatsApp("+213 555 12 34 56")).toBe("213555123456");
  });
});

describe("messageReservation (US-07)", () => {
  it("contient le titre, la taille, le prix, le lien et la mention OranPromo", () => {
    const m = messageReservation(demande);
    expect(m).toContain("Polo piqué bleu marine");
    expect(m).toContain("taille M");
    expect(m).toContain("3 500 DA");
    expect(m).toContain("https://oranpromo.com/a/1234");
    expect(m).toContain("vu sur OranPromo");
  });
  it("omet la taille pour un article en taille unique", () => {
    expect(messageReservation({ ...demande, taille: null })).not.toContain("taille");
  });
});

describe("lienReservation", () => {
  it("ouvre wa.me vers la boutique avec le message encodé", () => {
    const lien = lienReservation(demande);
    expect(lien.startsWith("https://wa.me/213555123456?text=")).toBe(true);
    expect(decodeURIComponent(lien.split("?text=")[1])).toBe(messageReservation(demande));
  });
});

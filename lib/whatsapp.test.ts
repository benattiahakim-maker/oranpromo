import { describe, expect, it } from "vitest";
import { lienReservation, messageReservation, numeroWhatsApp } from "./whatsapp";

const demande = {
  telephoneBoutique: "+213 555 12 34 56",
  titre: "Polo piqué bleu marine",
  taille: "M",
  prix: 3500,
  lien: "https://oranpromo.com/a/1234",
};

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

import { describe, expect, it } from "vitest";
import { lienContactClient, lienQuestionArticle, lienRelanceBoutique, lienAvertissementBoutique, lienReservation, messageReservation, numeroWhatsApp } from "./whatsapp";

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
  expect(lien.searchParams.get("text")).toBe("Bonjour, pensez à mettre à jour vos articles sur BleDeal");
});

it("prépare l’avertissement WhatsApp avec le titre et le lien de l’article", () => {
  const url = new URL(lienAvertissementBoutique("+213 555 12 34 56", "Polo bleu", "https://oranpromo.com/a/123"));
  expect(url.pathname).toBe("/213555123456");
  expect(url.searchParams.get("text")).toContain("Polo bleu");
  expect(url.searchParams.get("text")).toContain("signalements sur BleDeal");
  expect(url.searchParams.get("text")).toContain("https://oranpromo.com/a/123");
});

describe("numeroWhatsApp", () => {
  it("ne garde que les chiffres", () => {
    expect(numeroWhatsApp("+213 555 12 34 56")).toBe("213555123456");
  });
});

describe("messageReservation (US-07)", () => {
  it("contient le titre, la taille, le prix, le lien et la mention BleDeal", () => {
    const m = messageReservation(demande);
    expect(m).toContain("Polo piqué bleu marine");
    expect(m).toContain("taille M");
    expect(m).toContain("3 500 DA");
    expect(m).toContain("https://oranpromo.com/a/1234");
    expect(m).toContain("vu sur BleDeal");
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

describe("liens WhatsApp des commandes (US-20)", () => {
  it("prépare une question sur un article sans réservation", () => {
    const lien = lienQuestionArticle("+213 555 12 34 56", "Polo", "https://oranpromo.com/a/1");
    expect(lien.startsWith("https://wa.me/213555123456?text=")).toBe(true);
    expect(new URL(lien).searchParams.get("text")).toBe("Bonjour, j’ai une question sur « Polo » : https://oranpromo.com/a/1 (vu sur BleDeal)");
  });
  it("contacte un client au sujet de sa commande", () => {
    expect(new URL(lienContactClient("+213555111222", 14, "Boutique Amine")).searchParams.get("text")).toBe("Bonjour, ici Boutique Amine au sujet de votre commande n° 14 sur BleDeal.");
  });
});

describe("US-25.1 : message de réservation d’un produit de beauté", () => {
  it("écrit la contenance sans le mot « taille »", () => {
    const m = messageReservation({ ...demande, titre: "Eau de parfum oud boisé", taille: "100 ml", contenance: true, prix: 4900 });
    expect(m).toContain("Eau de parfum oud boisé, 100 ml, 4");
    expect(m).not.toContain("taille");
    expect(messageReservation(demande)).toContain("taille M");
  });
});

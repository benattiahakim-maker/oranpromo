import { beforeEach, describe, expect, it, vi } from "vitest";
import { envoyerCodeConnexion, verifierCodeConnexion } from "./actions";

const { envoyer, verifier, ErreurCode } = vi.hoisted(() => ({ envoyer: vi.fn(), verifier: vi.fn(), ErreurCode: class ErreurCode extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/codes-telephone", () => ({ envoyerCodeConnexionClient: envoyer, verifierCodeConnexionClient: verifier, ErreurCode }));
beforeEach(() => { vi.clearAllMocks(); });

describe("connexion par numéro (actions serveur, US-21.2)", () => {
  it("envoie le code et rend le numéro normalisé", async () => {
    envoyer.mockResolvedValue({ numero: "+213555123456", canal: "whatsapp" });
    expect(await envoyerCodeConnexion("0555123456", "whatsapp", "jeton")).toEqual({ succes: true, message: expect.stringContaining("WhatsApp"), numero: "+213555123456" });
    expect(envoyer).toHaveBeenCalledWith({}, "0555123456", "whatsapp", "jeton");
    envoyer.mockResolvedValue({ numero: "+213555123456", canal: "sms" });
    expect((await envoyerCodeConnexion("0555123456", "sms", null)).message).toBe("Code envoyé par SMS.");
  });
  it("relaie les refus prévus, cache les erreurs inattendues", async () => {
    envoyer.mockRejectedValue(new ErreurCode("Attendez une minute avant de demander un nouveau code."));
    expect(await envoyerCodeConnexion("0555123456", "whatsapp", "j")).toEqual({ succes: false, message: "Attendez une minute avant de demander un nouveau code." });
    envoyer.mockRejectedValue(new Error("secret interne"));
    expect((await envoyerCodeConnexion("0555123456", "whatsapp", "j")).message).not.toContain("secret");
  });
  it("après le bon code, renvoie une destination sûre", async () => {
    verifier.mockResolvedValue(undefined);
    expect(await verifierCodeConnexion("0555123456", "123456", "/panier")).toEqual({ succes: true, message: "Vous êtes connecté.", suite: "/panier" });
    expect((await verifierCodeConnexion("0555123456", "123456", "https://pirate.example")).suite).toBe("/compte/commandes");
    expect((await verifierCodeConnexion("0555123456", "123456", null)).suite).toBe("/compte/commandes");
  });
  it("code refusé", async () => {
    verifier.mockRejectedValue(new ErreurCode("Code incorrect ou expiré."));
    expect(await verifierCodeConnexion("0555123456", "000000", "/panier")).toEqual({ succes: false, message: "Code incorrect ou expiré." });
    verifier.mockRejectedValue(new Error("boom"));
    expect((await verifierCodeConnexion("0555123456", "000000", "/panier")).message).toContain("Impossible de vérifier");
  });
});

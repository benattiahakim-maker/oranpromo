import { beforeEach, describe, expect, it, vi } from "vitest";
import { contesterMonNoShow, enregistrerNom, envoyerCodeVerification, verifierCodeVerification } from "./actions";
const { contester, nomClient, envoyerVerif, verifierVerif, ErreurCode } = vi.hoisted(() => ({ contester: vi.fn(), nomClient: vi.fn(), envoyerVerif: vi.fn(), verifierVerif: vi.fn(), ErreurCode: class ErreurCode extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/clients", () => ({ contesterNoShow: contester, enregistrerNomClient: nomClient, enregistrerProfilClient: vi.fn(), ErreurValidationProfil: class extends Error {} }));
vi.mock("@/lib/codes-telephone", () => ({ envoyerCodeVerificationClient: envoyerVerif, verifierCodeVerificationClient: verifierVerif, ErreurCode }));
vi.mock("@/lib/commandes", () => ({ annulerCommandeClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
describe("contester un no-show (action serveur)", () => {
  it("transmet la contestation", async () => {
    contester.mockResolvedValue(undefined);
    const resultat = await contesterMonNoShow("c1", "La boutique était fermée");
    expect(resultat.succes).toBe(true);
    expect(resultat.message).toContain("Contestation envoyée");
    expect(contester).toHaveBeenCalledWith({}, "c1", "La boutique était fermée");
  });
  it("relaie le refus et rejette une saisie invalide", async () => {
    contester.mockRejectedValue(new Error("Vous avez déjà contesté ce no-show."));
    expect(await contesterMonNoShow("c1", "Encore une fois")).toEqual({ succes: false, message: "Vous avez déjà contesté ce no-show." });
    contester.mockClear();
    expect((await contesterMonNoShow("c1", 42 as unknown as string)).succes).toBe(false);
    expect(contester).not.toHaveBeenCalled();
  });
});

describe("vérifier son numéro depuis /compte ou /panier (US-21.2)", () => {
  it("envoie le code au nouveau numéro", async () => {
    envoyerVerif.mockResolvedValue({ numero: "+213555123456", canal: "whatsapp" });
    expect(await envoyerCodeVerification("0555123456", "whatsapp")).toEqual({ succes: true, message: expect.stringContaining("WhatsApp"), numero: "+213555123456" });
    expect(envoyerVerif).toHaveBeenCalledWith({}, "0555123456", "whatsapp");
    envoyerVerif.mockRejectedValue(new ErreurCode("Ce numéro est déjà utilisé par un autre compte : connectez-vous avec ce numéro."));
    expect((await envoyerCodeVerification("0555123456", "sms")).message).toContain("déjà utilisé");
    envoyerVerif.mockRejectedValue(new Error("interne"));
    expect((await envoyerCodeVerification("0555123456", "sms")).message).toContain("Impossible d’envoyer");
  });
  it("vérifie le code", async () => {
    verifierVerif.mockResolvedValue(undefined);
    expect(await verifierCodeVerification("0555123456", "123456")).toEqual({ succes: true, message: "Numéro vérifié." });
    verifierVerif.mockRejectedValue(new ErreurCode("Code incorrect ou expiré."));
    expect(await verifierCodeVerification("0555123456", "123456")).toEqual({ succes: false, message: "Code incorrect ou expiré." });
  });
  it("enregistre le nom seul", async () => {
    nomClient.mockResolvedValue(undefined);
    expect(await enregistrerNom("Samia B")).toEqual({ succes: true, message: "Profil enregistré." });
    expect(nomClient).toHaveBeenCalledWith({}, "Samia B");
    expect((await enregistrerNom(42 as unknown as string)).succes).toBe(false);
  });
});

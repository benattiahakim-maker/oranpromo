import { beforeEach, describe, expect, it, vi } from "vitest";
import { envoyerCodeConnexion, verifierCodeConnexion } from "./actions";

const { envoyer, verifier, ErreurCode } = vi.hoisted(() => ({ envoyer: vi.fn(), verifier: vi.fn(), ErreurCode: class ErreurCode extends Error {} }));
const { cookie } = vi.hoisted(() => ({ cookie: { langue: "fr" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "langue" ? { value: cookie.langue } : undefined) }) }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/codes-telephone", () => ({ envoyerCodeConnexionClient: envoyer, verifierCodeConnexionClient: verifier, ErreurCode, MESSAGE_CODE_ENVOYE: "Code envoyé sur WhatsApp." }));
beforeEach(() => { vi.clearAllMocks(); cookie.langue = "fr"; rpc.mockResolvedValue({ data: null, error: null }); });

describe("connexion par numéro (actions serveur, US-21.2)", () => {
  it("envoie le code et rend le numéro normalisé", async () => {
    envoyer.mockResolvedValue({ numero: "+213555123456" });
    expect(await envoyerCodeConnexion("0555123456", "jeton")).toEqual({ succes: true, message: "Code envoyé sur WhatsApp.", numero: "+213555123456" });
    expect(envoyer).toHaveBeenCalledWith({ rpc }, "0555123456", "jeton");
  });
  it("relaie les refus prévus, cache les erreurs inattendues", async () => {
    envoyer.mockRejectedValue(new ErreurCode("Attendez une minute avant de demander un nouveau code."));
    expect(await envoyerCodeConnexion("0555123456", "j")).toEqual({ succes: false, message: "Attendez une minute avant de demander un nouveau code." });
    envoyer.mockRejectedValue(new Error("secret interne"));
    expect((await envoyerCodeConnexion("0555123456", "j")).message).not.toContain("secret");
  });
  it("après le bon code, renvoie une destination sûre", async () => {
    verifier.mockResolvedValue(undefined);
    expect(await verifierCodeConnexion("0555123456", "123456", "/panier", true)).toEqual({ succes: true, message: "Vous êtes connecté.", suite: "/panier" });
    expect((await verifierCodeConnexion("0555123456", "123456", "https://pirate.example", true)).suite).toBe("/compte/commandes");
    expect((await verifierCodeConnexion("0555123456", "123456", null, true)).suite).toBe("/compte/commandes");
  });
  it("code refusé", async () => {
    verifier.mockRejectedValue(new ErreurCode("Code incorrect ou expiré."));
    expect(await verifierCodeConnexion("0555123456", "000000", "/panier", true)).toEqual({ succes: false, message: "Code incorrect ou expiré." });
    verifier.mockRejectedValue(new Error("boom"));
    expect((await verifierCodeConnexion("0555123456", "000000", "/panier", true)).message).toContain("Impossible de vérifier");
  });
});

describe("US-23 : messages en arabe", () => {
  it("code faux : « الكود غالط ولا فات وقتو… » (texte validé n° 8) ; message inconnu : français gardé", async () => {
    cookie.langue = "ar";
    verifier.mockRejectedValueOnce(new ErreurCode("Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code."));
    expect(await verifierCodeConnexion("+213555123456", "000000", null, true)).toEqual({ succes: false, message: "الكود غالط ولا فات وقتو. شوف الأرقام الستة ولا اطلب كود جديد." });
    verifier.mockRejectedValueOnce(new ErreurCode("Message que personne n’a traduit."));
    expect((await verifierCodeConnexion("+213555123456", "000000", null, true)).message).toBe("Message que personne n’a traduit.");
  });
  it("en français, rien ne change", async () => {
    verifier.mockRejectedValueOnce(new ErreurCode("Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code."));
    expect((await verifierCodeConnexion("+213555123456", "000000", null, true)).message).toBe("Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code.");
  });
});

describe("US-34.2 : conditions acceptées à l'inscription", () => {
  it("sans la case cochée : pas de vérification du code, pas de compte", async () => {
    expect(await verifierCodeConnexion("0555123456", "123456", "/panier")).toEqual({ succes: false, message: "Cochez la case pour créer votre compte." });
    expect(await verifierCodeConnexion("0555123456", "123456", "/panier", false)).toEqual({ succes: false, message: "Cochez la case pour créer votre compte." });
    expect(verifier).not.toHaveBeenCalled();
    cookie.langue = "ar";
    expect((await verifierCodeConnexion("0555123456", "123456", null)).message).toBe("علّم على الخانة باش تدير الحساب نتاعك.");
  });
  it("code validé : accord enregistré (conditions + confidentialité, version en vigueur, contexte inscription)", async () => {
    verifier.mockResolvedValue(undefined);
    expect((await verifierCodeConnexion("0555123456", "123456", null, true)).succes).toBe(true);
    expect(rpc).toHaveBeenCalledWith("accepter_documents", { documents: ["conditions", "confidentialite"], versions: ["2026-10-10", "2026-10-10"], contexte: "inscription" });
  });
  it("code refusé : aucun accord enregistré", async () => {
    verifier.mockRejectedValue(new ErreurCode("Code incorrect ou expiré."));
    await verifierCodeConnexion("0555123456", "000000", null, true);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("échec de l'enregistrement : la connexion réussit quand même (le panier redemandera)", async () => {
    verifier.mockResolvedValue(undefined);
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const erreurConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await verifierCodeConnexion("0555123456", "123456", null, true)).succes).toBe(true);
    expect(erreurConsole).toHaveBeenCalled();
    erreurConsole.mockRestore();
  });
});

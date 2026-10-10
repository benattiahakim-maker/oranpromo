import { beforeEach, describe, expect, it, vi } from "vitest";
import { lireRetraitParCode, remettreCommandeRetrait } from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok", commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T18:30:00Z", terminee_le: null, mode_remise: null, lignes: [] };
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: resume, error: null }); });

describe("US-26.3 : actions du scanner", () => {
  it("code à 4 chiffres : résumé renvoyé, sans jeton", async () => {
    const r = await lireRetraitParCode("0481");
    expect(r).toEqual({ succes: true, message: "", resume });
    expect(rpc).toHaveBeenCalledWith("retrait_boutique", { code: "0481" });
    expect(JSON.stringify(r)).not.toContain("jeton");
  });
  it("relecture n°6 : code bloqué par la base (10 codes faux en 15 min) → message clair, en lecture et en remise", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "Trop de codes faux" } });
    const message = "Trop de codes faux : la saisie du code est bloquée 15 minutes. Scannez le QR code du client.";
    expect(await lireRetraitParCode("0481")).toEqual({ succes: false, message });
    expect(await remettreCommandeRetrait({ code: "0481" })).toEqual({ succes: false, message });
  });
  it("code mal tapé : pas d’appel ; code faux : message unique (la limite d’essais est dans la base)", async () => {
    expect(await lireRetraitParCode("48")).toEqual({ succes: false, message: "Tapez les 4 chiffres du code." });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { etat: "invalide" }, error: null });
    for (let i = 0; i < 8; i++) expect(await lireRetraitParCode("1234")).toEqual({ succes: false, message: "Code faux. Vérifiez les 4 chiffres avec le client." });
    expect(rpc).toHaveBeenCalledTimes(8);
  });
  it("lire ne remet rien : seule remettreCommandeRetrait appelle remettre_commande", async () => {
    await lireRetraitParCode("0481");
    expect(rpc).not.toHaveBeenCalledWith("remettre_commande", expect.anything());
    rpc.mockResolvedValue({ data: { ...resume, etat: "remise", mode_remise: "code" }, error: null });
    expect(await remettreCommandeRetrait({ code: "0481" })).toMatchObject({ succes: true, message: "Commande remise" });
    expect(rpc).toHaveBeenLastCalledWith("remettre_commande", { code: "0481" });
    await remettreCommandeRetrait({ jeton: JETON });
    expect(rpc).toHaveBeenLastCalledWith("remettre_commande", { jeton: JETON });
  });
  it("remise refusée : déjà remise, annulée, expirée, autre boutique", async () => {
    rpc.mockResolvedValue({ data: { ...resume, etat: "deja_remise", terminee_le: "2026-10-10T16:05:00Z" }, error: null });
    expect((await remettreCommandeRetrait({ jeton: JETON })).message).toBe("Déjà remise le 10/10 à 17 h 05.");
    rpc.mockResolvedValue({ data: { etat: "invalide" }, error: null });
    expect((await remettreCommandeRetrait({ jeton: JETON })).message).toBe("Ce QR code n’est pas valide pour votre boutique.");
    expect(await remettreCommandeRetrait({ jeton: "pas-un-jeton" })).toEqual({ succes: false, message: "Ce QR code n’est pas valide pour votre boutique." });
    expect(await remettreCommandeRetrait({ code: "x" })).toEqual({ succes: false, message: "Code faux. Vérifiez les 4 chiffres avec le client." });
  });
  it("compte sans boutique : « Connectez-vous à votre espace boutique. »", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    expect(await lireRetraitParCode("0481")).toEqual({ succes: false, message: "Connectez-vous à votre espace boutique." });
  });
});

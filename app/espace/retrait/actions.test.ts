import { beforeEach, describe, expect, it, vi } from "vitest";
import { lireRetraitParCode, remettreCommandeRetrait } from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok", commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T18:30:00Z", terminee_le: null, mode_remise: null, lignes: [] };
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: resume, error: null }); });

describe("US-26.3 : actions du scanner", () => {
  it("code à 6 chiffres : résumé renvoyé, sans jeton", async () => {
    const r = await lireRetraitParCode("048193");
    expect(r).toEqual({ succes: true, message: "", resume });
    expect(rpc).toHaveBeenCalledWith("retrait_boutique", { code: "048193" });
    expect(JSON.stringify(r)).not.toContain("jeton");
  });
  it("suivi relecture n°6 : code bloqué par la base (20 faux en une heure, ou 5 pour cette commande) → message de la base, en lecture et en remise", async () => {
    const message = "Trop de codes faux pour cette commande : son code est bloqué encore 15 min. Scannez le QR code du client.";
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message } });
    expect(await lireRetraitParCode("048193")).toEqual({ succes: false, message });
    expect(await remettreCommandeRetrait({ code: "048193" })).toEqual({ succes: false, message });
  });
  it("code mal tapé : pas d’appel ; code faux : message unique (la limite d’essais est dans la base)", async () => {
    expect(await lireRetraitParCode("48")).toEqual({ succes: false, message: "Tapez les 6 chiffres du code." });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { etat: "invalide" }, error: null });
    expect(await lireRetraitParCode("0481")).toEqual({ succes: false, message: "Tapez les 6 chiffres du code." });
    expect(rpc).not.toHaveBeenCalled();
    for (let i = 0; i < 8; i++) expect(await lireRetraitParCode("123456")).toEqual({ succes: false, message: "Code faux. Vérifiez les 6 chiffres avec le client." });
    expect(rpc).toHaveBeenCalledTimes(8);
  });
  it("lire ne remet rien : seule remettreCommandeRetrait appelle remettre_commande", async () => {
    await lireRetraitParCode("048193");
    expect(rpc).not.toHaveBeenCalledWith("remettre_commande", expect.anything());
    rpc.mockResolvedValue({ data: { ...resume, etat: "remise", mode_remise: "code" }, error: null });
    expect(await remettreCommandeRetrait({ code: "048193" })).toMatchObject({ succes: true, message: "Commande remise" });
    expect(rpc).toHaveBeenLastCalledWith("remettre_commande", { code: "048193" });
    await remettreCommandeRetrait({ jeton: JETON });
    expect(rpc).toHaveBeenLastCalledWith("remettre_commande", { jeton: JETON });
  });
  it("remise refusée : déjà remise, annulée, expirée, autre boutique", async () => {
    rpc.mockResolvedValue({ data: { ...resume, etat: "deja_remise", terminee_le: "2026-10-10T16:05:00Z" }, error: null });
    expect((await remettreCommandeRetrait({ jeton: JETON })).message).toBe("Déjà remise le 10/10 à 17 h 05.");
    rpc.mockResolvedValue({ data: { etat: "invalide" }, error: null });
    expect((await remettreCommandeRetrait({ jeton: JETON })).message).toBe("Ce QR code n’est pas valide pour votre boutique.");
    expect(await remettreCommandeRetrait({ jeton: "pas-un-jeton" })).toEqual({ succes: false, message: "Ce QR code n’est pas valide pour votre boutique." });
    expect(await remettreCommandeRetrait({ code: "x" })).toEqual({ succes: false, message: "Code faux. Vérifiez les 6 chiffres avec le client." });
  });
  it("compte sans boutique : « Connectez-vous à votre espace boutique. »", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    expect(await lireRetraitParCode("048193")).toEqual({ succes: false, message: "Connectez-vous à votre espace boutique." });
  });
});

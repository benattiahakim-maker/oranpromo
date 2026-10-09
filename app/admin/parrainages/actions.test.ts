import { beforeEach, describe, expect, it, vi } from "vitest";
import { annulerBonsParrainage, exclureCompteDuParrainage, reglerBudgetParrainage, retirerBoutiqueDesBons } from "./actions";
const { verifier, rpc } = vi.hoisted(() => ({ verifier: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); rpc.mockResolvedValue({ data: null, error: null }); });

describe("US-27.5 budget du parrainage", () => {
  it("enregistre le montant saisi (admin)", async () => {
    expect(await reglerBudgetParrainage("45 000")).toEqual({ succes: true, message: "Budget enregistré." });
    expect(rpc).toHaveBeenCalledWith("regler_budget_parrainage", { montant: 45000 });
  });
  it("0 : plus aucun nouveau bon", async () => {
    expect((await reglerBudgetParrainage("0")).message).toBe("Budget à 0 : aucun nouveau bon ne sera créé.");
  });
  it("saisie invalide : rien n’est envoyé", async () => {
    expect(await reglerBudgetParrainage("-5")).toEqual({ succes: false, message: "Budget invalide : un montant en DA entre 0 et 10 000 000." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("non-admin : refus sans appel à la base", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    expect(await reglerBudgetParrainage("100")).toEqual({ succes: false, message: "Accès réservé" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("US-27.5 actions sur les parrainages", () => {
  it("annuler les bons : motif transmis, nombre annoncé", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await annulerBonsParrainage("f1", "Faux compte")).toEqual({ succes: true, message: "2 bons annulés." });
    expect(rpc).toHaveBeenCalledWith("annuler_bons_parrainage", { filleul: "f1", motif: "Faux compte" });
  });
  it("motif refusé par la base : message relayé", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "Motif obligatoire (3 à 300 caractères)." } });
    expect(await annulerBonsParrainage("f1", "")).toEqual({ succes: false, message: "Motif obligatoire (3 à 300 caractères)." });
  });
  it("exclure / réadmettre un compte", async () => {
    expect((await exclureCompteDuParrainage("p1", true)).message).toBe("Compte exclu du parrainage.");
    expect(rpc).toHaveBeenLastCalledWith("exclure_parrainage", { profil: "p1", exclu: true });
    await exclureCompteDuParrainage("p1", false);
    expect(rpc).toHaveBeenLastCalledWith("exclure_parrainage", { profil: "p1", exclu: false });
  });
  it("retirer une boutique des bons", async () => {
    expect((await retirerBoutiqueDesBons("b1", true)).succes).toBe(true);
    expect(rpc).toHaveBeenCalledWith("retirer_boutique_des_bons", { boutique: "b1", retiree: true });
  });
  it("identifiant manquant : refus", async () => {
    expect(await retirerBoutiqueDesBons("", true)).toEqual({ succes: false, message: "Boutique invalide." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { annulerNoShowClient, bloquerCompteClient, debloquerCompteClient } from "./actions";
const { verifier, debloquer, annuler, bloquer } = vi.hoisted(() => ({ verifier: vi.fn(), debloquer: vi.fn(), annuler: vi.fn(), bloquer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
vi.mock("@/lib/clients", () => ({ debloquerClient: debloquer, annulerNoShow: annuler, bloquerClient: bloquer }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); debloquer.mockResolvedValue(undefined); });
describe("débloquer un client (US-20.4)", () => {
  it("débloque pour un admin", async () => { expect(await debloquerCompteClient("k1")).toEqual({ succes: true, message: "Client débloqué : son compteur repart de 0." }); expect(debloquer).toHaveBeenCalledWith({}, "k1"); });
  it("refuse un non-admin sans appeler la base", async () => { verifier.mockRejectedValue(new Error("Accès réservé")); expect(await debloquerCompteClient("k1")).toEqual({ succes: false, message: "Accès réservé" }); expect(debloquer).not.toHaveBeenCalled(); });
});
describe("annuler un no-show (relecture point 11)", () => {
  it("annule pour un admin", async () => { annuler.mockResolvedValue(undefined); expect(await annulerNoShowClient("c1")).toEqual({ succes: true, message: "No-show annulé." }); expect(annuler).toHaveBeenCalledWith({}, "c1"); });
  it("refuse un non-admin sans appeler la base", async () => { verifier.mockRejectedValue(new Error("Accès réservé")); expect(await annulerNoShowClient("c1")).toEqual({ succes: false, message: "Accès réservé" }); expect(annuler).not.toHaveBeenCalled(); });
});
describe("bloquer un client (relecture n°2 : numéro partagé)", () => {
  it("bloque pour un admin", async () => { bloquer.mockResolvedValue(undefined); expect(await bloquerCompteClient("k2")).toEqual({ succes: true, message: "Client bloqué : il ne peut plus commander." }); expect(bloquer).toHaveBeenCalledWith({}, "k2"); });
  it("refuse un non-admin sans appeler la base", async () => { verifier.mockRejectedValue(new Error("Accès réservé")); expect(await bloquerCompteClient("k2")).toEqual({ succes: false, message: "Accès réservé" }); expect(bloquer).not.toHaveBeenCalled(); });
  it("relaie le refus de la base", async () => { bloquer.mockRejectedValue(new Error("Client introuvable.")); expect(await bloquerCompteClient("k2")).toEqual({ succes: false, message: "Client introuvable." }); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { debloquerCompteClient } from "./actions";
const { verifier, debloquer } = vi.hoisted(() => ({ verifier: vi.fn(), debloquer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
vi.mock("@/lib/clients", () => ({ debloquerClient: debloquer }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); debloquer.mockResolvedValue(undefined); });
describe("débloquer un client (US-20.4)", () => {
  it("débloque pour un admin", async () => { expect(await debloquerCompteClient("k1")).toEqual({ succes: true, message: "Client débloqué : son compteur repart de 0." }); expect(debloquer).toHaveBeenCalledWith({}, "k1"); });
  it("refuse un non-admin sans appeler la base", async () => { verifier.mockRejectedValue(new Error("Accès réservé")); expect(await debloquerCompteClient("k1")).toEqual({ succes: false, message: "Accès réservé" }); expect(debloquer).not.toHaveBeenCalled(); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
import { nePlusRecevoir } from "./actions";

const JETON = "0123456789abcdef".repeat(3);
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: "desactivees", error: null }); });

describe("US-31.5 : « Ne plus recevoir » par le lien, sans connexion", () => {
  it("arrête les alertes", async () => {
    expect(await nePlusRecevoir(JETON)).toBe("desactivees");
    expect(rpc).toHaveBeenCalledWith("desactiver_alertes_par_lien", { jeton: JETON });
  });
  it("jeton mal formé : refusé sans appel à la base ; lien inconnu : invalide ; erreur de la base : erreur", async () => {
    expect(await nePlusRecevoir("x' or 1=1")).toBe("invalide");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await nePlusRecevoir(JETON)).toBe("invalide");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await nePlusRecevoir(JETON)).toBe("erreur");
  });
});

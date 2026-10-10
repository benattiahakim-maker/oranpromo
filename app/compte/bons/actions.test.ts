import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
import { ajouterCode } from "./actions";

describe("US-33.3 : action « Ajouter » un code", () => {
  it("code mal écrit : refusé sans appel à la base (ne compte pas comme essai)", async () => {
    expect(await ajouterCode("A-1")).toEqual({ etat: "inconnu" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("code normalisé envoyé à ajouter_code_bon ; erreur de la base : « erreur »", async () => {
    rpc.mockResolvedValueOnce({ data: { etat: "ajoute", montant: 500 }, error: null });
    expect(await ajouterCode(" aid 2026 ")).toEqual({ etat: "ajoute", montant: 500 });
    expect(rpc).toHaveBeenCalledWith("ajouter_code_bon", { code: "AID2026" });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    expect(await ajouterCode("AID2026")).toEqual({ etat: "erreur" });
  });
});

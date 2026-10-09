import { beforeEach, describe, expect, it, vi } from "vitest";
import { contesterMonNoShow } from "./actions";
const { contester } = vi.hoisted(() => ({ contester: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/clients", () => ({ contesterNoShow: contester, enregistrerProfilClient: vi.fn(), ErreurValidationProfil: class extends Error {} }));
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

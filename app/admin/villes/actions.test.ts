import { beforeEach, describe, expect, it, vi } from "vitest";
import { definirVilleAmbassadeur, ouvrirVille } from "./actions";
const { ouverture, villeAmb, revalidatePath } = vi.hoisted(() => ({ ouverture: vi.fn(), villeAmb: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/villes-admin", () => ({ changerOuvertureVille: ouverture, changerVilleAmbassadeur: villeAmb }));
vi.mock("next/cache", () => ({ revalidatePath }));
beforeEach(() => { vi.clearAllMocks(); ouverture.mockResolvedValue(undefined); villeAmb.mockResolvedValue(undefined); });
describe("US-29.4 : actions /admin/villes", () => {
  it("ouvre, ferme et rafraîchit les pages publiques", async () => {
    expect(await ouvrirVille("tlemcen", true)).toEqual({ succes: true, message: "Ville ouverte." }); expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(await ouvrirVille("tlemcen", false)).toEqual({ succes: true, message: "Ville fermée." });
  });
  it("renvoie l'erreur sans rafraîchir", async () => {
    ouverture.mockRejectedValue(new Error("Action réservée aux administrateurs.")); expect(await ouvrirVille("oran", false)).toEqual({ succes: false, message: "Action réservée aux administrateurs." }); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("enregistre la ville d'un ambassadeur", async () => { expect((await definirVilleAmbassadeur("a", null)).succes).toBe(true); expect(villeAmb).toHaveBeenCalledWith({}, "a", null); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmerCommandeDepuisLien } from "./actions";

const { confirmer } = vi.hoisted(() => ({ confirmer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ client: true }) }));
vi.mock("@/lib/confirmation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/confirmation")>()), confirmerParLien: confirmer }));
beforeEach(() => { vi.clearAllMocks(); });

describe("US-20.6 : action « Confirmer la commande » (sans connexion)", () => {
  it("transmet le lien au contrôle serveur", async () => {
    confirmer.mockResolvedValue({ succes: true, etat: "confirmee", message: "ok" });
    expect(await confirmerCommandeDepuisLien("lien")).toEqual({ succes: true, etat: "confirmee", message: "ok" });
    expect(confirmer).toHaveBeenCalledWith({ client: true }, "lien");
  });
  it("n’échoue jamais : erreur inattendue → message simple", async () => {
    confirmer.mockRejectedValue(new Error("détail interne"));
    expect((await confirmerCommandeDepuisLien("lien")).etat).toBe("erreur");
    expect((await confirmerCommandeDepuisLien(42 as unknown as string)).etat).toBe("invalide");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { deciderLigneDeCote, marquerRelevePaye, mettreLigneDeCote } from "./actions";
const { verifier, rpc } = vi.hoisted(() => ({ verifier: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); rpc.mockResolvedValue({ data: null, error: null }); });

describe("US-27.5 relevés", () => {
  it("mettre de côté avec motif", async () => {
    expect((await mettreLigneDeCote("l1", "Remise suspecte")).succes).toBe(true);
    expect(rpc).toHaveBeenCalledWith("mettre_de_cote", { ligne: "l1", motif: "Remise suspecte" });
  });
  it("décider : rembourser ou refuser seulement", async () => {
    expect((await deciderLigneDeCote("l1", "rembourser", "Vérifié")).message).toBe("Ligne remise à rembourser (relevé en cours de la boutique).");
    expect(rpc).toHaveBeenCalledWith("decider_ligne", { ligne: "l1", decision: "rembourser", motif: "Vérifié" });
    expect(await deciderLigneDeCote("l1", "supprimer", "x")).toEqual({ succes: false, message: "Décision inconnue : rembourser ou refuser." });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("marquer comme payé : référence et date transmises ; relevé payé figé (refus relayé)", async () => {
    expect(await marquerRelevePaye("r1", "CCP 0012", "2026-11-05")).toEqual({ succes: true, message: "Relevé marqué comme payé. Il n’est plus modifiable." });
    expect(rpc).toHaveBeenCalledWith("marquer_releve_paye", { releve: "r1", reference: "CCP 0012", paye_le: "2026-11-05" });
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "Seul un relevé clôturé (à payer) peut être marqué comme payé." } });
    expect((await marquerRelevePaye("r1", "CCP 0012", "2026-11-05")).message).toBe("Seul un relevé clôturé (à payer) peut être marqué comme payé.");
  });
  it("réservé à l’admin", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    for (const r of [await mettreLigneDeCote("l1", "abc"), await deciderLigneDeCote("l1", "refuser", "abc"), await marquerRelevePaye("r1", "abc", "2026-11-05")]) expect(r).toEqual({ succes: false, message: "Accès réservé" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

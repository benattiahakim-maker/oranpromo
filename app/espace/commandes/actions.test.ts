import { beforeEach, describe, expect, it, vi } from "vitest";
import { changerStatutCommandeBoutique } from "./actions";

const { rpc, commande, boutique } = vi.hoisted(() => ({ rpc: vi.fn(), commande: { valeur: null as unknown }, boutique: { valeur: "b1" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, from: () => { const c: Record<string, unknown> = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: commande.valeur, error: null }) }; return c; } }) }));
vi.mock("@/lib/gestion-articles", () => ({ boutiqueDuCompte: async () => boutique.valeur }));
const id = "11111111-1111-1111-1111-111111111111";
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); commande.valeur = { id, boutique_id: "b1", statut: "demandee" }; boutique.valeur = "b1"; });

describe("action serveur de la boutique (US-20.3)", () => {
  it("confirme une commande de sa boutique", async () => {
    expect(await changerStatutCommandeBoutique(id, "confirmee", null, "")).toEqual({ succes: true, message: "Commande mise à jour." });
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id, statut: "confirmee", motif: null, note: null });
  });
  it("refuse une commande d’une autre boutique sans appeler la base", async () => {
    boutique.valeur = "b2";
    expect(await changerStatutCommandeBoutique(id, "confirmee", null, "")).toEqual({ succes: false, message: "Commande introuvable." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuse une étape sautée ou une annulation sans motif", async () => {
    expect((await changerStatutCommandeBoutique(id, "recuperee", null, "")).message).toBe("Changement de statut impossible.");
    expect((await changerStatutCommandeBoutique(id, "annulee", null, "")).message).toBe("Choisissez le motif de l’annulation.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("transmet le motif et la note d’une annulation", async () => {
    await changerStatutCommandeBoutique(id, "annulee", "plus_en_stock", " Désolé ");
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id, statut: "annulee", motif: "plus_en_stock", note: "Désolé" });
  });
});

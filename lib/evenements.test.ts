import { beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerEvenement } from "./evenements";
const { insert, creerClientNavigateur } = vi.hoisted(() => ({ insert: vi.fn(), creerClientNavigateur: vi.fn() }));
vi.mock("./supabase/client", () => ({ creerClientNavigateur }));
beforeEach(() => { vi.clearAllMocks(); insert.mockResolvedValue({ error: null }); creerClientNavigateur.mockReturnValue({ from: () => ({ insert }) }); });
describe("US-13 : événements sans donnée personnelle", () => {
  it("envoie uniquement le type et les références de l’article", async () => { await enregistrerEvenement("vue_article", "boutique", "article"); expect(insert).toHaveBeenCalledWith({ type: "vue_article", boutique_id: "boutique", article_id: "article" }); });
  it("envoie une vue de boutique sans identifiant d’article", async () => { await enregistrerEvenement("vue_boutique", "boutique"); expect(insert).toHaveBeenCalledWith({ type: "vue_boutique", boutique_id: "boutique" }); });
  it("absorbe une erreur réseau ou de client sans perturber la page", async () => { insert.mockRejectedValue(new Error("Réseau")); await expect(enregistrerEvenement("partage", "boutique", "article")).resolves.toBeUndefined(); creerClientNavigateur.mockImplementation(() => { throw new Error("Client indisponible"); }); await expect(enregistrerEvenement("vue_boutique", "boutique")).resolves.toBeUndefined(); });
});

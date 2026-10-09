import { beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerEvenement } from "./evenements";
const { enregistrerMesure } = vi.hoisted(() => ({ enregistrerMesure: vi.fn() }));
vi.mock("@/app/visiteurs/actions", () => ({ enregistrerMesure }));
beforeEach(() => { vi.clearAllMocks(); enregistrerMesure.mockResolvedValue(true); });
describe("US-13 : événements sans donnée personnelle, envoyés par le serveur (limite par visiteur)", () => {
  it("envoie uniquement le type et les références de l’article", async () => { await enregistrerEvenement("vue_article", "boutique", "article"); expect(enregistrerMesure).toHaveBeenCalledWith("vue_article", "boutique", "article", undefined); });
  it("envoie une vue de boutique sans identifiant d’article", async () => { await enregistrerEvenement("vue_boutique", "boutique"); expect(enregistrerMesure).toHaveBeenCalledWith("vue_boutique", "boutique", undefined, undefined); });
  it("envoie la taille d’un clic « Ajouter au panier »", async () => { await enregistrerEvenement("clic_reserver", "boutique", "article", "M"); expect(enregistrerMesure).toHaveBeenCalledWith("clic_reserver", "boutique", "article", "M"); });
  it("absorbe une erreur réseau sans perturber la page", async () => { enregistrerMesure.mockRejectedValue(new Error("Réseau")); await expect(enregistrerEvenement("partage", "boutique", "article")).resolves.toBeUndefined(); });
});

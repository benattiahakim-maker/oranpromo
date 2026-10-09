import { beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerMesure, envoyerSignalement } from "./actions";

const { mesurer, signaler, ErreurSignalement } = vi.hoisted(() => ({ mesurer: vi.fn(), signaler: vi.fn(), ErreurSignalement: class ErreurSignalement extends Error {} }));
const entetes = new Headers({ "x-real-ip": "105.98.1.2" });
vi.mock("next/headers", () => ({ headers: async () => entetes }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/visiteurs", () => ({ mesurerEvenement: mesurer, signalerArticle: signaler, ErreurSignalement, MESSAGE_SIGNALEMENT_ECHEC: "Le signalement n’a pas pu être envoyé. Réessayez." }));
beforeEach(() => { vi.clearAllMocks(); });

describe("actions serveur des visiteurs (limites par visiteur)", () => {
  it("mesure : transmet la session et les en-têtes de la requête", async () => {
    mesurer.mockResolvedValue(true);
    expect(await enregistrerMesure("clic_reserver", "b", "a", "M")).toBe(true);
    expect(mesurer).toHaveBeenCalledWith({}, entetes, { type: "clic_reserver", boutiqueId: "b", articleId: "a", taille: "M" });
  });
  it("mesure : n’échoue jamais", async () => {
    mesurer.mockRejectedValue(new Error("panne"));
    expect(await enregistrerMesure("vue_boutique", "b")).toBe(false);
  });
  it("signalement : relaie les refus prévus, cache les erreurs inattendues", async () => {
    signaler.mockResolvedValue(undefined);
    expect(await envoyerSignalement("a", "arnaque", "x")).toEqual({ succes: true, message: "Merci, nous allons vérifier." });
    signaler.mockRejectedValue(new ErreurSignalement("Vous avez déjà signalé cet article, merci. Il sera examiné rapidement."));
    expect(await envoyerSignalement("a", "arnaque", "")).toEqual({ succes: false, message: "Vous avez déjà signalé cet article, merci. Il sera examiné rapidement." });
    signaler.mockRejectedValue(new Error("secret interne"));
    expect((await envoyerSignalement("a", "arnaque", "")).message).toBe("Le signalement n’a pas pu être envoyé. Réessayez.");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { commanderPanier } from "./actions";

const { getUser, passer, after, envoyer } = vi.hoisted(() => ({ getUser: vi.fn(), passer: vi.fn(), after: vi.fn((tache: () => unknown) => { void tache(); }), envoyer: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/commandes", () => ({ passerCommande: passer }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
const ligne = { article_id: "a1", taille: "M", quantite: 2 };
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "k1" } }, error: null }); passer.mockResolvedValue("c1"); });

describe("commander le panier (US-20.2, US-20.5)", () => {
  it("passe la commande puis prévient la boutique sur WhatsApp après la réponse", async () => {
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ id: "c1" });
    expect(passer).toHaveBeenCalledWith(expect.anything(), "b1", [ligne], "");
    expect(after).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith(expect.anything(), "c1");
  });
  it("n’envoie rien si la commande est refusée", async () => {
    passer.mockRejectedValue(new Error("Votre compte est bloqué."));
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ erreur: "Votre compte est bloqué." });
    expect(after).not.toHaveBeenCalled();
  });
  it("demande la connexion sans session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ connexion: true, erreur: "Connectez-vous pour commander." });
    expect(passer).not.toHaveBeenCalled();
  });
});

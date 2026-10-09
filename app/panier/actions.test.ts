import { beforeEach, describe, expect, it, vi } from "vitest";
import { commanderPanier } from "./actions";

const { getUser, passer, definirLangue, after, envoyer } = vi.hoisted(() => ({ getUser: vi.fn(), passer: vi.fn(), definirLangue: vi.fn(), after: vi.fn((tache: () => unknown) => { void tache(); }), envoyer: vi.fn() }));
vi.mock("next/server", () => ({ after }));
const { cookie } = vi.hoisted(() => ({ cookie: { langue: "fr" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "langue" ? { value: cookie.langue } : undefined) }) }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/commandes", () => ({ passerCommande: passer, definirLangueCommande: definirLangue }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
const ligne = { article_id: "a1", taille: "M", quantite: 2 };
beforeEach(() => { vi.clearAllMocks(); cookie.langue = "fr"; getUser.mockResolvedValue({ data: { user: { id: "k1" } }, error: null }); passer.mockResolvedValue("c1"); });

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

describe("US-23 : erreurs de commande en arabe", () => {
  it("erreur de la base avec valeurs, et connexion demandée", async () => {
    cookie.langue = "ar";
    passer.mockRejectedValueOnce(new Error("Il ne reste que 1 pièce(s) en taille M pour « Polo bleu »."));
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ erreur: "بقاو غير 1 في مقاس M لـ « Polo bleu »." });
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ connexion: true, erreur: "ادخل لحسابك باش تطلب." });
  });
});

describe("US-23 : langue de la commande (messages WhatsApp au client)", () => {
  it("site en arabe : la commande est marquée « ar » avant l'envoi des messages", async () => {
    cookie.langue = "ar";
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ id: "c1" });
    expect(definirLangue).toHaveBeenCalledWith(expect.anything(), "c1", "ar");
    expect(definirLangue.mock.invocationCallOrder[0]).toBeLessThan(after.mock.invocationCallOrder[0]);
  });
  it("site en français : rien à enregistrer (français par défaut)", async () => {
    await commanderPanier("b1", [ligne], "");
    expect(definirLangue).not.toHaveBeenCalled();
  });
  it("échec de l'enregistrement de la langue : la commande est quand même passée", async () => {
    cookie.langue = "ar";
    definirLangue.mockRejectedValueOnce(new Error("réseau"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ id: "c1" });
    expect(after).toHaveBeenCalled();
    erreur.mockRestore();
  });
});

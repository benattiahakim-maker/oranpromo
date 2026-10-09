import { beforeEach, describe, expect, it, vi } from "vitest";
import { commanderPanier } from "./actions";

const { getUser, passer, definirLangue, after, envoyer, utiliser, ordre } = vi.hoisted(() => {
  const ordre: string[] = [];
  return { ordre, getUser: vi.fn(), passer: vi.fn(), definirLangue: vi.fn(), after: vi.fn((tache: () => unknown) => { ordre.push("after"); void tache(); }), envoyer: vi.fn(), utiliser: vi.fn(async () => { ordre.push("utiliser_bon"); return "applique"; }) };
});
vi.mock("@/lib/bons", () => ({ utiliserBon: utiliser }));
vi.mock("next/server", () => ({ after }));
const { cookie } = vi.hoisted(() => ({ cookie: { langue: "fr" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "langue" ? { value: cookie.langue } : undefined) }) }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/commandes", () => ({ passerCommande: passer, definirLangueCommande: definirLangue }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
const ligne = { article_id: "a1", taille: "M", quantite: 2 };
beforeEach(() => { vi.clearAllMocks(); ordre.length = 0; utiliser.mockImplementation(async () => { ordre.push("utiliser_bon"); return "applique"; }); cookie.langue = "fr"; getUser.mockResolvedValue({ data: { user: { id: "k1" } }, error: null }); passer.mockResolvedValue("c1"); });

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

describe("US-25.4 : refus de la base pour un produit de beauté", () => {
  it("arabe : « contenance » → « الحجم » ; français : tel quel", async () => {
    const refus = "Il ne reste que 1 pièce(s) en contenance 100 ml pour « Eau de parfum oud boisé ».";
    cookie.langue = "ar";
    passer.mockRejectedValueOnce(new Error(refus));
    expect(await commanderPanier("b1", [{ ...ligne, taille: "100 ml" }], "")).toEqual({ erreur: "بقاو غير 1 في الحجم 100 ml لـ « Eau de parfum oud boisé »." });
    cookie.langue = "fr";
    passer.mockRejectedValueOnce(new Error(refus));
    expect(await commanderPanier("b1", [{ ...ligne, taille: "100 ml" }], "")).toEqual({ erreur: refus });
  });
});

describe("US-27.4 : bon parrainage au panier", () => {
  it("case cochée : utiliser_bon juste après passer_commande, avant le message à la boutique", async () => {
    passer.mockImplementation(async () => { ordre.push("passer_commande"); return "c1"; });
    expect(await commanderPanier("b1", [ligne], "", true)).toEqual({ id: "c1" });
    expect(utiliser).toHaveBeenCalledWith(expect.anything(), "c1");
    expect(ordre).toEqual(["passer_commande", "utiliser_bon", "after"]);
  });
  it("case décochée (ou ancien appel sans 4e argument) : pas de bon", async () => {
    await commanderPanier("b1", [ligne], "", false);
    await commanderPanier("b1", [ligne], "");
    expect(utiliser).not.toHaveBeenCalled();
  });
  it.each([["aucun_bon", "aucun_bon"], ["minimum", "minimum"], ["boutique_exclue", "boutique_exclue"], ["deja", "erreur"], ["erreur", "erreur"]])("bon non posé (%s) : commande gardée au prix plein, raison « %s »", async (reponse, raison) => {
    utiliser.mockResolvedValueOnce(reponse);
    expect(await commanderPanier("b1", [ligne], "", true)).toEqual({ id: "c1", bon: raison });
    expect(after).toHaveBeenCalledTimes(1);
  });
  it("commande refusée : aucun bon tenté", async () => {
    passer.mockRejectedValue(new Error("Votre compte est bloqué."));
    await commanderPanier("b1", [ligne], "", true);
    expect(utiliser).not.toHaveBeenCalled();
  });
});

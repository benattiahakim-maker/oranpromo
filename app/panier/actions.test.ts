import { beforeEach, describe, expect, it, vi } from "vitest";
import { commanderPanier } from "./actions";

const { getUser, passer, definirLangue, after, envoyer, utiliser, ordre } = vi.hoisted(() => {
  const ordre: string[] = [];
  return { ordre, getUser: vi.fn(), passer: vi.fn(), definirLangue: vi.fn(), after: vi.fn((tache: () => unknown) => { ordre.push("after"); void tache(); }), envoyer: vi.fn(), utiliser: vi.fn(async () => { ordre.push("utiliser_bon"); return "applique"; }) };
});
vi.mock("@/lib/bons", async (original) => ({ ...(await original<typeof import("@/lib/bons")>()), utiliserBon: utiliser }));
vi.mock("next/server", () => ({ after }));
const { cookie } = vi.hoisted(() => ({ cookie: { langue: "fr" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "langue" ? { value: cookie.langue } : undefined) }) }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, rpc }) }));
vi.mock("@/lib/commandes", () => ({ passerCommande: passer, definirLangueCommande: definirLangue }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
const ligne = { article_id: "a1", taille: "M", quantite: 2 };
beforeEach(() => { vi.clearAllMocks(); ordre.length = 0; utiliser.mockImplementation(async () => { ordre.push("utiliser_bon"); return "applique"; }); cookie.langue = "fr"; getUser.mockResolvedValue({ data: { user: { id: "k1" } }, error: null }); passer.mockResolvedValue("c1");
  aAccepter = []; rpc.mockImplementation(async (nom: string) => { ordre.push(nom); return nom === "documents_a_accepter" ? { data: aAccepter, error: null } : { data: null, error: null }; }); });
let aAccepter: { document: string; version: string }[] = [];

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
    expect(utiliser).toHaveBeenCalledWith(expect.anything(), "c1", undefined);
    expect(ordre).toEqual(["documents_a_accepter", "passer_commande", "utiliser_bon", "after"]);
  });
  it("US-33.3 : bon choisi au panier : son identifiant est passé à utiliser_bon ; identifiant invalide ignoré", async () => {
    passer.mockResolvedValue("c1");
    const bon = "0b0b0b0b-0000-4000-8000-000000000001";
    await commanderPanier("b1", [ligne], "", bon);
    expect(utiliser).toHaveBeenLastCalledWith(expect.anything(), "c1", bon);
    utiliser.mockClear();
    await commanderPanier("b1", [ligne], "", "pas-un-uuid");
    expect(utiliser).not.toHaveBeenCalled();
  });
  it("case décochée (ou ancien appel sans 4e argument) : pas de bon", async () => {
    await commanderPanier("b1", [ligne], "", false);
    await commanderPanier("b1", [ligne], "");
    expect(utiliser).not.toHaveBeenCalled();
  });
  it.each([["aucun_bon", "aucun_bon"], ["minimum", "minimum"], ["boutique_exclue", "boutique_exclue"], ["deja", "erreur"], ["erreur", "erreur"], ["univers", "univers"], ["ville", "ville"], ["plafond_boutique", "plafond_boutique"]])("bon non posé (%s) : commande gardée au prix plein, raison « %s »", async (reponse, raison) => {
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

describe("US-34.2 : conditions à accepter avant la commande", () => {
  const nouvelles = [{ document: "conditions", version: "2026-12-01" }];
  it("rien à accepter : commande comme avant, aucun accord enregistré", async () => {
    expect(await commanderPanier("b1", [ligne], "")).toEqual({ id: "c1" });
    expect(rpc).not.toHaveBeenCalledWith("accepter_documents", expect.anything());
  });
  it("nouvelle version, case non cochée : pas de commande", async () => {
    aAccepter = nouvelles;
    expect(await commanderPanier("b1", [ligne], "", false, [])).toEqual({ conditions: true, erreur: "Nos conditions ont changé : acceptez-les pour commander." });
    expect(passer).not.toHaveBeenCalled();
  });
  it("case cochée sur une version dépassée : recharger, pas de commande", async () => {
    aAccepter = nouvelles;
    expect(await commanderPanier("b1", [ligne], "", false, [{ document: "conditions", version: "2026-10-10" }])).toEqual({ conditions: true, erreur: "Les conditions ont changé : rechargez la page." });
    expect(await commanderPanier("b1", [ligne], "", false, "n'importe quoi" as never)).toEqual({ conditions: true, erreur: "Nos conditions ont changé : acceptez-les pour commander." });
    expect(passer).not.toHaveBeenCalled();
  });
  it("case cochée sur la bonne version : accord enregistré (contexte commande) puis commande", async () => {
    aAccepter = nouvelles;
    passer.mockImplementation(async () => { ordre.push("passer_commande"); return "c1"; });
    expect(await commanderPanier("b1", [ligne], "", false, [{ document: "conditions", version: "2026-12-01" }])).toEqual({ id: "c1" });
    expect(rpc).toHaveBeenCalledWith("accepter_documents", { documents: ["conditions"], versions: ["2026-12-01"], contexte: "commande" });
    expect(ordre.slice(0, 3)).toEqual(["documents_a_accepter", "accepter_documents", "passer_commande"]);
  });
  it("accord refusé par la base : pas de commande, message clair (en arabe aussi)", async () => {
    aAccepter = nouvelles;
    rpc.mockImplementation(async (nom: string) => nom === "documents_a_accepter" ? { data: aAccepter, error: null } : { data: null, error: { message: "Les conditions ont changé : rechargez la page." } });
    cookie.langue = "ar";
    expect(await commanderPanier("b1", [ligne], "", false, [{ document: "conditions", version: "2026-12-01" }])).toEqual({ erreur: "الشروط تبدلو: عاود حمّل الصفحة." });
    expect(passer).not.toHaveBeenCalled();
  });
});

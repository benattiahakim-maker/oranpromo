import { beforeEach, describe, expect, it, vi } from "vitest";
import { accepterConditionsEspace } from "./actions";

const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, rpc }) }));
const documents = [{ document: "conditions_commercants", version: "2026-10-10" }, { document: "confidentialite", version: "2026-10-10" }];
let aAccepter = documents;
beforeEach(() => {
  vi.clearAllMocks(); aAccepter = documents;
  getUser.mockResolvedValue({ data: { user: { id: "m1" } } });
  rpc.mockImplementation(async (nom: string) => nom === "documents_a_accepter" ? { data: aAccepter, error: null } : { data: null, error: null });
});

describe("US-34.3 : accepter les conditions commerçants (action serveur)", () => {
  it("enregistre l'accord du compte connecté, contexte espace", async () => {
    expect(await accepterConditionsEspace(documents)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("accepter_documents", { documents: ["conditions_commercants", "confidentialite"], versions: ["2026-10-10", "2026-10-10"], contexte: "espace" });
  });
  it("rien coché ou envoi invalide : refus sans appel à la base", async () => {
    expect((await accepterConditionsEspace([])).erreur).toBe("Cochez la case pour accepter les conditions.");
    expect((await accepterConditionsEspace("x")).erreur).toBe("Cochez la case pour accepter les conditions.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sans session : connexion demandée", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await accepterConditionsEspace(documents)).erreur).toBe("Connectez-vous pour accepter les conditions.");
  });
  it("version affichée dépassée : recharger, rien enregistré", async () => {
    aAccepter = [{ document: "conditions_commercants", version: "2026-12-01" }];
    expect((await accepterConditionsEspace(documents)).erreur).toBe("Les conditions ont changé : rechargez la page.");
    expect(rpc).not.toHaveBeenCalledWith("accepter_documents", expect.anything());
  });
  it("refus de la base : message clair", async () => {
    rpc.mockImplementation(async (nom: string) => nom === "documents_a_accepter" ? { data: aAccepter, error: null } : { data: null, error: { message: "Ce texte ne concerne pas votre compte." } });
    expect((await accepterConditionsEspace(documents)).erreur).toBe("Impossible d’enregistrer votre accord. Réessayez.");
  });
});

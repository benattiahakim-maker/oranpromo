import { describe, expect, it, vi } from "vitest";
import { acceptationCouvre, accepterDocuments, documentsInscription, documentsValides, lireDocumentsAAccepter, MESSAGE_CONDITIONS_CHANGEES } from "./acceptations";
import { VERSIONS } from "./juridique";

function clientRpc(reponse: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: reponse.data ?? null, error: reponse.error ?? null });
  return { client: { rpc } as never, rpc };
}

describe("documentsValides", () => {
  it("garde les textes connus avec une date AAAA-MM-JJ", () => {
    expect(documentsValides([{ document: "conditions", version: "2026-10-10" }])).toEqual([{ document: "conditions", version: "2026-10-10" }]);
    expect(documentsValides([])).toEqual([]);
  });
  it("refuse un texte inconnu, une date invalide, un doublon ou autre chose qu'une liste", () => {
    expect(documentsValides([{ document: "autre", version: "2026-10-10" }])).toBeNull();
    expect(documentsValides([{ document: "conditions", version: "10/10/2026" }])).toBeNull();
    expect(documentsValides([{ document: "conditions", version: "2026-10-10" }, { document: "conditions", version: "2026-10-10" }])).toBeNull();
    expect(documentsValides("conditions")).toBeNull();
    expect(documentsValides([null])).toBeNull();
  });
});

describe("acceptationCouvre", () => {
  const aAccepter = [{ document: "conditions" as const, version: "2026-12-01" }];
  it("vrai si chaque texte à accepter a été coché dans la même version", () => {
    expect(acceptationCouvre(aAccepter, [{ document: "conditions", version: "2026-12-01" }, { document: "confidentialite", version: "2026-10-10" }])).toBe(true);
    expect(acceptationCouvre([], [])).toBe(true);
  });
  it("faux si une version a changé ou si un texte manque", () => {
    expect(acceptationCouvre(aAccepter, [{ document: "conditions", version: "2026-10-10" }])).toBe(false);
    expect(acceptationCouvre(aAccepter, [])).toBe(false);
  });
});

describe("lecture et envoi", () => {
  it("lit documents_a_accepter", async () => {
    const { client, rpc } = clientRpc({ data: [{ document: "confidentialite", version: "2026-10-10" }] });
    expect(await lireDocumentsAAccepter(client)).toEqual([{ document: "confidentialite", version: "2026-10-10" }]);
    expect(rpc).toHaveBeenCalledWith("documents_a_accepter");
  });
  it("erreur de lecture : message clair", async () => {
    await expect(lireDocumentsAAccepter(clientRpc({ error: { message: "x" } }).client)).rejects.toThrow("Impossible de vérifier les conditions acceptées");
  });
  it("envoie textes, versions et contexte ; rien à envoyer : pas d'appel", async () => {
    const { client, rpc } = clientRpc({});
    await accepterDocuments(client, documentsInscription(), "inscription");
    expect(rpc).toHaveBeenCalledWith("accepter_documents", { documents: ["conditions", "confidentialite"], versions: [VERSIONS.conditions, VERSIONS.confidentialite], contexte: "inscription" });
    rpc.mockClear();
    await accepterDocuments(client, [], "commande");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("version changée dans la base : demander de recharger", async () => {
    await expect(accepterDocuments(clientRpc({ error: { message: "Les conditions ont changé : rechargez la page." } }).client, documentsInscription(), "commande"))
      .rejects.toThrow(MESSAGE_CONDITIONS_CHANGEES);
    await expect(accepterDocuments(clientRpc({ error: { message: "autre" } }).client, documentsInscription(), "commande"))
      .rejects.toThrow("Impossible d’enregistrer votre accord");
  });
});

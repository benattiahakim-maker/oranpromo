// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CorpsTropGros, lireCorpsLimite, lireFormulaireLimite } from "./corps-requete";

const flux = (morceaux: Uint8Array[]) => new ReadableStream<Uint8Array>({ start(c) { morceaux.forEach(m => c.enqueue(m)); c.close(); } });
const requeteFlux = (morceaux: Uint8Array[], entetes: Record<string, string> = {}) => new Request("http://localhost/x", { method: "POST", body: flux(morceaux), headers: entetes, duplex: "half" } as RequestInit);

describe("lecture bornée du corps d'une requête", () => {
  it("lit un corps sans Content-Length tant qu'il reste sous la limite", async () => {
    expect(await lireCorpsLimite(requeteFlux([new Uint8Array([1, 2]), new Uint8Array([3])]), 3)).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("coupe un envoi sans Content-Length dès qu'il dépasse la limite", async () => {
    await expect(lireCorpsLimite(requeteFlux([new Uint8Array(3), new Uint8Array(2)]), 4)).rejects.toBeInstanceOf(CorpsTropGros);
  });
  it("refuse d'emblée un Content-Length trop grand ou invalide", async () => {
    await expect(lireCorpsLimite(new Request("http://localhost/x", { method: "POST", body: "abc", headers: { "content-length": "99" } }), 10)).rejects.toBeInstanceOf(CorpsTropGros);
    await expect(lireCorpsLimite(new Request("http://localhost/x", { method: "POST", body: "abc", headers: { "content-length": "-1" } }), 10)).rejects.toBeInstanceOf(CorpsTropGros);
  });
  it("analyse un formulaire multipart borné", async () => {
    const formulaire = new FormData(); formulaire.append("photo", new File([new Uint8Array([255, 216, 255])], "p.jpg", { type: "image/jpeg" }));
    const source = new Request("http://localhost/x", { method: "POST", body: formulaire });
    const relu = await lireFormulaireLimite(new Request("http://localhost/x", { method: "POST", body: await source.arrayBuffer(), headers: { "content-type": source.headers.get("content-type")! } }), 1000);
    expect((relu.get("photo") as File).size).toBe(3);
  });
});

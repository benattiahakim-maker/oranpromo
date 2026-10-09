import { describe, expect, it } from "vitest";
import { origineRequete } from "./origine";

const requete = (url: string, entetes: Record<string, string>) => new Request(url, { headers: entetes });

describe("origineRequete", () => {
  it("garde l'adresse du navigateur même si le serveur se croit sur localhost", () => {
    expect(origineRequete(requete("http://localhost:3000/auth/callback", { host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });
  it("utilise l'hôte et le protocole transmis par l'hébergeur", () => {
    expect(origineRequete(requete("http://localhost:3000/x", { host: "interne:3000", "x-forwarded-host": "oranpromo.com", "x-forwarded-proto": "https" }))).toBe("https://oranpromo.com");
  });
  it("ignore un en-tête d'hôte invalide", () => {
    expect(origineRequete(requete("http://localhost:3000/x", { host: "evil.com/chemin" }))).toBe("http://localhost:3000");
  });
});

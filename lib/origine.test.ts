import { describe, expect, it } from "vitest";
import { hoteAutorise, origineRequete } from "./origine";

const requete = (url: string, entetes: Record<string, string>) => new Request(url, { headers: entetes });
const dev = { siteUrl: "http://localhost:3000", production: false };
const prod = { siteUrl: "https://oranpromo.com", production: true };

describe("origineRequete", () => {
  it("garde l'adresse du navigateur même si le serveur se croit sur localhost", () => {
    expect(origineRequete(requete("http://localhost:3000/auth/callback", { host: "127.0.0.1:3000" }), dev)).toBe("http://127.0.0.1:3000");
  });
  it("utilise l'hôte transmis par l'hébergeur quand c'est celui du site", () => {
    expect(origineRequete(requete("http://localhost:3000/x", { host: "interne:3000", "x-forwarded-host": "oranpromo.com", "x-forwarded-proto": "https" }), prod)).toBe("https://oranpromo.com");
  });
  it("ignore un en-tête d'hôte invalide", () => {
    expect(origineRequete(requete("http://localhost:3000/x", { host: "evil.com/chemin" }), { production: false })).toBe("http://localhost:3000");
  });
  it("refuse un X-Forwarded-Host inconnu et revient à l'adresse du site", () => {
    expect(origineRequete(requete("http://interne:3000/x", { host: "interne:3000", "x-forwarded-host": "evil.com", "x-forwarded-proto": "https" }), prod)).toBe("https://oranpromo.com");
    expect(origineRequete(requete("http://localhost:3000/x", { host: "localhost:3000", "x-forwarded-host": "evil.com" }), dev)).toBe("http://localhost:3000");
  });
  it("n'accepte pas localhost en production quand le site est en ligne", () => {
    expect(origineRequete(requete("http://interne:3000/x", { host: "127.0.0.1:3000" }), prod)).toBe("https://oranpromo.com");
  });
  it("impose le protocole du site pour son propre hôte", () => {
    expect(origineRequete(requete("http://interne/x", { host: "oranpromo.com", "x-forwarded-proto": "http" }), prod)).toBe("https://oranpromo.com");
  });
});

describe("hoteAutorise", () => {
  it("autorise l'hôte du site et les hôtes locaux en développement seulement", () => {
    expect(hoteAutorise("oranpromo.com", prod)).toBe(true);
    expect(hoteAutorise("OranPromo.com", prod)).toBe(true);
    expect(hoteAutorise("www.oranpromo.com", prod)).toBe(false);
    expect(hoteAutorise("localhost:3000", prod)).toBe(false);
    expect(hoteAutorise("127.0.0.1:3000", dev)).toBe(true);
    expect(hoteAutorise("127.0.0.1:3000", { siteUrl: "http://localhost:3000", production: true })).toBe(true);
    expect(hoteAutorise("evil.com", dev)).toBe(false);
  });
});

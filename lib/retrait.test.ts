import { describe, expect, it, vi } from "vitest";
import { codeRetraitValide, jetonRetraitValide, lienPartageRetrait, lienRetrait, lienScanRetrait, lireRetraitClient, lireRetraitParLien, qrCodeRetrait } from "./retrait";

const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const client = (resultat: { data: unknown; error: unknown }) => { const rpc = vi.fn().mockResolvedValue(resultat); return { rpc, c: { rpc } as never }; };

describe("US-26 : retrait par QR code", () => {
  it("formats du jeton (22 caractères base64url) et du code (4 chiffres)", () => {
    expect(jetonRetraitValide(JETON)).toBe(true);
    expect(jetonRetraitValide("q7Kx2mPZ9vTfW8LrB4n1a")).toBe(false);
    expect(jetonRetraitValide("q7Kx2mPZ9vTfW8LrB4n1a+")).toBe(false);
    expect(jetonRetraitValide(null)).toBe(false);
    expect(codeRetraitValide("0481")).toBe(true);
    expect(codeRetraitValide("481")).toBe(false); expect(codeRetraitValide("48a1")).toBe(false); expect(codeRetraitValide("04811")).toBe(false);
  });
  it("lien du proche et contenu du QR code (espace de la boutique), sur l’adresse du site", () => {
    expect(lienRetrait(JETON, "https://oranpromo.example/")).toBe(`https://oranpromo.example/retrait/${JETON}`);
    expect(lienScanRetrait(JETON, "https://oranpromo.example")).toBe(`https://oranpromo.example/espace/retrait/${JETON}`);
  });
  it("envoi à un proche : WhatsApp sans destinataire, message en français ou en arabe avec le lien", () => {
    const lien = lienRetrait(JETON, "https://oranpromo.example");
    const fr = decodeURIComponent(lienPartageRetrait("fr", 128, "Parfumerie Démo", lien).replace("https://wa.me/?text=", ""));
    expect(fr).toBe(`Peux-tu récupérer ma commande n° 128 chez Parfumerie Démo ? Montre ce QR code au vendeur (ou donne-lui le code) et paie sur place : ${lien}`);
    const ar = decodeURIComponent(lienPartageRetrait("ar", 128, "Parfumerie Démo", lien).replace("https://wa.me/?text=", ""));
    expect(ar).toContain("الطلبية رقم 128"); expect(ar.endsWith(lien)).toBe(true);
  });
  it("QR code : SVG en adresse data:, généré localement", async () => {
    const qr = await qrCodeRetrait(JETON, "https://oranpromo.example");
    expect(qr.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(qr)).toContain("<svg");
  });
  it("page du proche : jeton mal formé → la base n’est pas appelée", async () => {
    const { rpc, c } = client({ data: null, error: null });
    expect(await lireRetraitParLien(c, "pas-un-jeton")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("page du proche : vue de la base, état inconnu refusé, erreur signalée", async () => {
    const vue = { etat: "prete", numero: 128, total: 6300, expire_le: null, terminee_le: null, boutique: { nom: "B", slug: "b", quartier: "Q", adresse: null }, lignes: [], code: "0481" };
    const ok = client({ data: vue, error: null });
    expect(await lireRetraitParLien(ok.c, JETON)).toEqual(vue);
    expect(ok.rpc).toHaveBeenCalledWith("retrait_par_lien", { jeton: JETON });
    expect(await lireRetraitParLien(client({ data: { ...vue, etat: "bizarre" }, error: null }).c, JETON)).toBeNull();
    expect(await lireRetraitParLien(client({ data: null, error: null }).c, JETON)).toBeNull();
    await expect(lireRetraitParLien(client({ data: null, error: { message: "x" } }).c, JETON)).rejects.toThrow();
  });
  it("client : son jeton et son code, rien si la base ne rend rien ou un format inattendu", async () => {
    const ok = client({ data: [{ jeton: JETON, code: "0481" }], error: null });
    expect(await lireRetraitClient(ok.c, "c1")).toEqual({ jeton: JETON, code: "0481" });
    expect(ok.rpc).toHaveBeenCalledWith("retrait_client", { commande: "c1" });
    expect(await lireRetraitClient(client({ data: [], error: null }).c, "c1")).toBeNull();
    expect(await lireRetraitClient(client({ data: [{ jeton: "x", code: "0481" }], error: null }).c, "c1")).toBeNull();
    await expect(lireRetraitClient(client({ data: null, error: { message: "x" } }).c, "c1")).rejects.toThrow();
  });
});

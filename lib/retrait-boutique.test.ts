import { describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { formaterDateRemise, jetonDepuisQr, lienScanRetrait, lireRetraitBoutique, messageRetraitBoutique, remettreRetrait } from "./retrait";

// US-26.3 : côté boutique (scanner, code, remise).
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const SITE = "https://oranpromo.example";
const client = (resultat: { data: unknown; error: unknown }) => { const rpc = vi.fn().mockResolvedValue(resultat); return { rpc, c: { rpc } as never }; };

/** Image RGBA d'un QR code (mêmes réglages que qrCodeSvg : correction M, marge 4), pour le décoder avec jsqr. */
function imageQr(texte: string, echelle = 4) {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: "M" });
  const cote = (modules.size + 8) * echelle;
  const data = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) {
    if (!modules.get(y, x)) continue;
    for (let dy = 0; dy < echelle; dy++) for (let dx = 0; dx < echelle; dx++) {
      const i = (((y + 4) * echelle + dy) * cote + (x + 4) * echelle + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, cote };
}

describe("US-26.3 : lecture du QR code scanné", () => {
  it("n’accepte que <site>/espace/retrait/<jeton> du même site", () => {
    expect(jetonDepuisQr(`${SITE}/espace/retrait/${JETON}`, SITE)).toBe(JETON);
    expect(jetonDepuisQr(`${SITE}/espace/retrait/${JETON}/`, SITE)).toBe(JETON);
    expect(jetonDepuisQr(` ${SITE}/espace/retrait/${JETON}?x=1 `, SITE)).toBe(JETON);
    expect(jetonDepuisQr(`https://autre.example/espace/retrait/${JETON}`, SITE)).toBeNull();
    expect(jetonDepuisQr(`http://oranpromo.example/espace/retrait/${JETON}`, SITE)).toBeNull();
    expect(jetonDepuisQr(`${SITE}/retrait/${JETON}`, SITE)).toBeNull();
    expect(jetonDepuisQr(`${SITE}/b/parfumerie-demo`, SITE)).toBeNull();
    expect(jetonDepuisQr(`${SITE}/espace/retrait/${JETON}x`, SITE)).toBeNull();
    expect(jetonDepuisQr(`${SITE}/espace/retrait/../commandes`, SITE)).toBeNull();
    expect(jetonDepuisQr(JETON, SITE)).toBeNull();
    expect(jetonDepuisQr("WIFI:S:boutique;T:WPA;P:secret;;", SITE)).toBeNull();
    expect(jetonDepuisQr(null, SITE)).toBeNull();
    expect(jetonDepuisQr(`${SITE}/espace/retrait/${JETON}${"a".repeat(300)}`, SITE)).toBeNull();
  });
  it("jsqr (repli iPhone) relit le QR code généré pour le client et donne le jeton", () => {
    const { data, cote } = imageQr(lienScanRetrait(JETON, SITE));
    const lu = jsQR(data, cote, cote);
    expect(lu?.data).toBe(`${SITE}/espace/retrait/${JETON}`);
    expect(jetonDepuisQr(lu?.data, SITE)).toBe(JETON);
  });
});

describe("US-26.3 : résumé et remise", () => {
  const resume = { etat: "ok", commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T18:30:00Z", terminee_le: null, mode_remise: null, lignes: [] };
  it("lit le résumé par jeton ou par code ; mauvais format = invalide sans appel", async () => {
    const { rpc, c } = client({ data: resume, error: null });
    expect(await lireRetraitBoutique(c, { jeton: JETON })).toEqual(resume);
    expect(rpc).toHaveBeenLastCalledWith("retrait_boutique", { jeton: JETON });
    await lireRetraitBoutique(c, { code: "0481" });
    expect(rpc).toHaveBeenLastCalledWith("retrait_boutique", { code: "0481" });
    rpc.mockClear();
    expect(await lireRetraitBoutique(c, { jeton: "abc" })).toEqual({ etat: "invalide" });
    expect(await lireRetraitBoutique(c, { code: "12" })).toEqual({ etat: "invalide" });
    expect(await remettreRetrait(c, { code: "12a4" })).toEqual({ etat: "invalide" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("remet par la base (remettre_commande), jamais par une simple lecture", async () => {
    const { rpc, c } = client({ data: { ...resume, etat: "remise", mode_remise: "qr" }, error: null });
    expect((await remettreRetrait(c, { jeton: JETON })).etat).toBe("remise");
    expect(rpc).toHaveBeenCalledWith("remettre_commande", { jeton: JETON });
  });
  it("erreurs : pas de boutique connectée → message clair ; le reste → message générique", async () => {
    await expect(lireRetraitBoutique(client({ data: null, error: { code: "42501", message: "x" } }).c, { jeton: JETON })).rejects.toThrow("Connectez-vous à votre espace boutique.");
    await expect(lireRetraitBoutique(client({ data: null, error: { code: "XX000", message: "détail technique" } }).c, { jeton: JETON })).rejects.toThrow("Impossible de lire cette commande. Réessayez.");
    await expect(lireRetraitBoutique(client({ data: { etat: "bizarre" }, error: null }).c, { jeton: JETON })).rejects.toThrow("Impossible de lire");
  });
  it("messages (textes 17 à 20 de la story) : même message pour un QR code inconnu ou d’une autre boutique", () => {
    expect(messageRetraitBoutique({ etat: "invalide" }, false)).toBe("Ce QR code n’est pas valide pour votre boutique.");
    expect(messageRetraitBoutique({ etat: "invalide" }, true)).toBe("Code faux. Vérifiez les 4 chiffres avec le client.");
    expect(messageRetraitBoutique({ etat: "deja_remise", terminee_le: "2026-10-10T16:05:00Z" }, false)).toBe("Déjà remise le 10/10 à 17 h 05.");
    expect(messageRetraitBoutique({ etat: "annulee" }, false)).toBe("Cette commande a été annulée.");
    expect(messageRetraitBoutique({ etat: "expiree" }, true)).toBe("Cette commande a expiré : elle n’est plus à remettre.");
    expect(messageRetraitBoutique({ etat: "ok" }, false)).toBeNull();
    expect(formaterDateRemise("2026-10-10T07:03:00Z")).toBe("10/10 à 08 h 03");
  });
});

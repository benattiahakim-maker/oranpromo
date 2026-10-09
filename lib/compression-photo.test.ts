import { afterEach, describe, expect, it, vi } from "vitest";
import { compresserPhoto, dimensionsPhoto } from "./compression-photo";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("US-10 : dimensions et compression des photos", () => {
  it.each([[4000, 3000, 1600, 1200], [3000, 4000, 1200, 1600], [2000, 2000, 1600, 1600], [800, 600, 800, 600], [1600, 500, 1600, 500]])("redimensionne %s × %s sans agrandir", (largeur, hauteur, l, h) => {
    expect(dimensionsPhoto(largeur, hauteur)).toEqual({ largeur: l, hauteur: h });
  });
  it.each([[0, 100], [-1, 100], [Infinity, 100], [100, NaN]])("refuse des dimensions invalides", (l, h) => { expect(() => dimensionsPhoto(l, h)).toThrow(); });
  it("produit un JPEG de qualité 0.8 avant envoi et libère l’URL locale", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: revoke }));
    vi.stubGlobal("Image", class { src = ""; naturalWidth = 4000; naturalHeight = 3000; decode = async () => {}; });
    const contexte = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(contexte as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
    const resultat = await compresserPhoto(new File(["original"], "photo.png", { type: "image/png" }));
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
    expect(contexte.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(resultat.type).toBe("image/jpeg");
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});

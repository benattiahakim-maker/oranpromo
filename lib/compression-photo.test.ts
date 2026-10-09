import { afterEach, describe, expect, it, vi } from "vitest";
import { compresserPhoto, dimensionsPhoto, lirePhotoPreparee, preparerPhoto } from "./compression-photo";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("US-10 : dimensions et compression des photos", () => {
  it.each([[4000, 3000, 1200, 900], [3000, 4000, 900, 1200], [2000, 2000, 1200, 1200], [800, 600, 800, 600], [1200, 500, 1200, 500]])("redimensionne %s × %s sans agrandir", (largeur, hauteur, l, h) => {
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
    expect(contexte.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 900);
    expect(resultat.type).toBe("image/jpeg");
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
  it("calcule la miniature à 400 px sans agrandir", () => {
    expect(dimensionsPhoto(4000, 3000, 400)).toEqual({ largeur: 400, hauteur: 300 });
    expect(dimensionsPhoto(300, 200, 400)).toEqual({ largeur: 300, hauteur: 200 });
  });
  it("prépare une grande photo 1200 px et une miniature 400 px, en baissant la qualité si la photo est trop lourde", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }));
    vi.stubGlobal("Image", class { src = ""; naturalWidth = 3000; naturalHeight = 4000; decode = async () => {}; });
    const contexte = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(contexte as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback, _type, qualite) {
      const lourde = this.width > 400 && qualite === 0.8;
      callback(new Blob([new Uint8Array(lourde ? 900 * 1024 : this.width > 400 ? 400 * 1024 : 30 * 1024)], { type: "image/jpeg" }));
    });
    const { photo, vignette } = await preparerPhoto(new File(["original"], "photo.jpg", { type: "image/jpeg" }));
    expect(contexte.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 900, 1200);
    expect(contexte.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 400);
    expect(toBlob.mock.calls.map(appel => appel[2])).toEqual([0.8, 0.7, 0.7]);
    expect(photo.size).toBe(400 * 1024);
    expect(vignette?.size).toBe(30 * 1024);
  });
  it("lit l’ancien format (un seul JPEG) comme une photo sans miniature", () => {
    const photo = new Blob(["jpeg"], { type: "image/jpeg" });
    expect(lirePhotoPreparee(photo)).toEqual({ photo, vignette: null });
  });
});

import { describe, expect, it } from "vitest";
import { verifierPhotoPreparee } from "./photo-preparee";

const jpeg = (taille: number) => new Blob([new Uint8Array(taille)], { type: "image/jpeg" });
describe("contrôle d’une photo préparée (grande photo + miniature)", () => {
  it("accepte une photo avec ou sans miniature", () => {
    const preparee = { photo: jpeg(700 * 1024), vignette: jpeg(30 * 1024) };
    expect(verifierPhotoPreparee(preparee)).toBe(preparee);
    expect(verifierPhotoPreparee({ photo: jpeg(10), vignette: null }).vignette).toBeNull();
  });
  it.each([jpeg(0), new Blob(["png"], { type: "image/png" }), jpeg(5 * 1024 * 1024 + 1)])("refuse une grande photo invalide", photo => {
    expect(() => verifierPhotoPreparee({ photo, vignette: null })).toThrow("5 Mo");
  });
  it.each([jpeg(0), new Blob(["png"], { type: "image/png" }), jpeg(150 * 1024 + 1)])("refuse une miniature invalide", vignette => {
    expect(() => verifierPhotoPreparee({ photo: jpeg(10), vignette })).toThrow("miniature");
  });
});

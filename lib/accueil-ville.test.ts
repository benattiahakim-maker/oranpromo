import { describe, expect, it } from "vitest";
import { CREDIT_GRANDE_PHOTO, GRANDE_PHOTO, GRANDE_PHOTO_COMMUNE, grandePhotoVille } from "./accueil";

describe("US-29.3 : grande photo de l'accueil par ville (question 7)", () => {
  it("Oran : Santa Cruz et son crédit, comme avant", () => {
    expect(grandePhotoVille("oran")).toEqual({ photo: GRANDE_PHOTO, credit: CREDIT_GRANDE_PHOTO });
  });
  it("autres villes : photo commune neutre du projet, sans crédit à afficher", () => {
    expect(grandePhotoVille("tlemcen")).toEqual({ photo: GRANDE_PHOTO_COMMUNE, credit: null });
    expect(GRANDE_PHOTO_COMMUNE.adresse).toBe("/images/accueil/cat-robes.webp");
  });
});

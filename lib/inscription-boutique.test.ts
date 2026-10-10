import { describe, expect, it } from "vitest";
import { lienInscription, lireResultatInscription, slugDuLien } from "./inscription-boutique";

describe("US-31.3 : inscription en boutique", () => {
  it("lien de l'affiche sur le site public", () => {
    expect(lienInscription("chez-amine", "https://bledeal.dz/")).toBe("https://bledeal.dz/i/chez-amine");
    expect(lienInscription("chez-amine", "javascript:alert(1)")).toBe("http://localhost:3000/i/chez-amine");
  });
  it("slug lu dans l'adresse", () => {
    expect(slugDuLien("chez-amine")).toBe("chez-amine");
    expect(slugDuLien("CHEZ-AMINE")).toBe("chez-amine");
    expect(slugDuLien("%E0%A4%A")).toBeNull();
    expect(slugDuLien("../x")).toBeNull();
  });
  it("réponse de la base lue prudemment", () => {
    expect(lireResultatInscription({ suivie_nouvelle: true, rattache: true })).toEqual({ suivie_nouvelle: true, rattache: true });
    expect(lireResultatInscription(null)).toEqual({ suivie_nouvelle: false, rattache: false });
    expect(lireResultatInscription({ rattache: "oui" })).toEqual({ suivie_nouvelle: false, rattache: false });
  });
});

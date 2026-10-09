import { describe, expect, it } from "vitest";
import { lireBrouillonArticle, serialiserBrouillonArticle } from "./brouillon-article";
const champs = { titre: "Polo bleu", categorie: "T-shirts et polos", genre: "homme", couleur: "Bleu", prix: "3500", tailles: ["M"], description: "Manches courtes", descriptionAr: "قميص" };
describe("brouillon local", () => {
  it("ne tronque pas une saisie invalide et conserve l’origine IA des champs restaurés", () => { const long = { ...champs, titre: "A".repeat(121), description: "B".repeat(2000), champsIA: ["titre" as const] }; expect(lireBrouillonArticle(serialiserBrouillonArticle(long))).toEqual(long); });
  it("conserve tous les champs, y compris le texte arabe, sans photos ni données étrangères", () => { const serie = serialiserBrouillonArticle({ ...champs, photos: ["secret"] } as typeof champs); expect(lireBrouillonArticle(serie)).toEqual(champs); expect(serie).not.toContain("secret"); });
  it.each([null, "", "{", "null", "[]", JSON.stringify({ ...champs, tailles: [42] }), JSON.stringify({ ...champs, titre: null })])("ignore un brouillon invalide", texte => { expect(lireBrouillonArticle(texte)).toBeNull(); });
  it("filtre les valeurs inconnues et les tailles incompatibles", () => { expect(lireBrouillonArticle(JSON.stringify({ ...champs, couleur: "inconnue", tailles: ["M", "40"] }))).toMatchObject({ couleur: "", tailles: ["M"] }); });
});

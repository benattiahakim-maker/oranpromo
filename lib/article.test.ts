import { describe, expect, it } from "vitest";
import { donneesArticle, normaliserTailles, validerArticle, type SaisieArticle } from "./article";

const valide: SaisieArticle = { titre: "Polo bleu", categorie: "Polos", genre: "homme", couleur: "", description: "", prix: "3500", tailles: ["M"], photos: [{ type: "image/jpeg", size: 8000000 }] };
describe("US-10 : validation article", () => {
  it("US-15 : conserve le texte arabe et limite sa longueur sans inventer de titre arabe", () => { expect(donneesArticle({ ...valide, descriptionAr: " قميص أزرق\nأكمام قصيرة. " })).toMatchObject({ description_ar: "قميص أزرق\nأكمام قصيرة." }); expect(donneesArticle({ ...valide, descriptionAr: "" }).description_ar).toBeNull(); expect(donneesArticle(valide)).not.toHaveProperty("description_ar"); expect(validerArticle({ ...valide, descriptionAr: "ق".repeat(1122) }).descriptionAr).toBeDefined(); });
  it("valide une modification sans réenvoyer les photos, en conservant les autres règles", () => {
    expect(validerArticle({ ...valide, photos: [] }, { verifierPhotos: false })).toEqual({});
    expect(validerArticle({ ...valide, photos: [], titre: "", tailles: [] }, { verifierPhotos: false })).toMatchObject({ titre: expect.any(String), tailles: expect.any(String) });
    expect(validerArticle({ ...valide, photos: [] }).photos).toBeDefined();
  });
  it("accepte un article et une photo originale de plus de 5 Mo à compresser", () => { expect(validerArticle(valide)).toEqual({}); });
  it("renvoie une erreur par champ obligatoire", () => {
    const erreurs = validerArticle({ ...valide, photos: [], titre: "", categorie: "", prix: "", tailles: [] });
    expect(Object.keys(erreurs).sort()).toEqual(["categorie", "photos", "prix", "tailles", "titre"]);
    expect(erreurs.photos).toBe("Ajoutez au moins une photo.");
  });
  it.each(["A", "A".repeat(121), "  "])("refuse un titre hors limites", titre => { expect(validerArticle({ ...valide, titre }).titre).toBeDefined(); });
  it.each(["AB", "A".repeat(120)])("accepte les limites du titre", titre => { expect(validerArticle({ ...valide, titre }).titre).toBeUndefined(); });
  it.each(["0", "-1", "3.5", "3,5", "1e3", "abc", "2147483648"])("refuse le prix %s", prix => { expect(validerArticle({ ...valide, prix }).prix).toBeDefined(); });
  it.each(["1", " 3500 ", "2147483647"])("accepte le prix %s", prix => { expect(validerArticle({ ...valide, prix }).prix).toBeUndefined(); });
  it("refuse 6 photos, un fichier non image et une image vide", () => {
    for (const photos of [Array(6).fill(valide.photos[0]), [{ type: "application/pdf", size: 100 }], [{ type: "image/png", size: 0 }]]) expect(validerArticle({ ...valide, photos }).photos).toBeDefined();
  });
  it("refuse une catégorie ou un genre inconnus", () => {
    expect(validerArticle({ ...valide, categorie: "Autre inconnue", genre: "inconnu" })).toHaveProperty("categorie");
    expect(validerArticle({ ...valide, genre: "inconnu" })).toHaveProperty("genre");
  });
  it("normalise les tailles, dédoublonne et accepte les pointures", () => {
    expect(normaliserTailles([" m ", "M", "40", "40", ""])).toEqual(["M", "40"]);
    expect(validerArticle({ ...valide, tailles: ["40", "42"] }).tailles).toBeUndefined();
    expect(validerArticle({ ...valide, tailles: ["Unique"] }).tailles).toBeUndefined();
    expect(validerArticle({ ...valide, tailles: ["Unique", "M"] }).tailles).toBeDefined();
  });
  it("nettoie les champs et laisse couleur et description facultatives", () => {
    expect(donneesArticle({ ...valide, titre: " Polo bleu ", couleur: " ", description: " " })).toMatchObject({ titre: "Polo bleu", prix: 3500, couleur: null, description: null });
  });
});

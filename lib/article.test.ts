import { describe, expect, it } from "vitest";
import { estJpegReel, typeImageReel, COULEURS_ARTICLE, CATEGORIES_ARTICLE, couleurDepuisIA, filtrerTailles, taillesPourArticle, donneesArticle, normaliserTailles, validerArticle, type SaisieArticle } from "./article";

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
    expect(validerArticle({ ...valide, categorie: "Chaussures", tailles: ["40", "42"] }).tailles).toBeUndefined();
    expect(validerArticle({ ...valide, categorie: "Accessoires", tailles: ["Unique"] }).tailles).toBeUndefined();
    expect(validerArticle({ ...valide, tailles: ["Unique", "M"] }).tailles).toBeDefined();
  });
  it("nettoie les champs et laisse couleur et description facultatives", () => {
    expect(donneesArticle({ ...valide, titre: " Polo bleu ", couleur: " ", description: " " })).toMatchObject({ titre: "Polo bleu", prix: 3500, couleur: null, description: null });
  });
});

describe("couleurs et tailles du formulaire", () => {
  it.each(COULEURS_ARTICLE)("enregistre la couleur %s sans modifier son nom", couleur => { expect(validerArticle({ ...valide, couleur }).couleur).toBeUndefined(); expect(donneesArticle({ ...valide, couleur }).couleur).toBe(couleur); });
  it.each(["bleu", "Inconnue", "Bleu rouge", " Bleu "])("refuse une couleur hors liste %s", couleur => { expect(validerArticle({ ...valide, couleur }).couleur).toBeDefined(); });
  it.each([["bleu marine", "Bleu marine"], ["Marine", "Bleu marine"], ["bleu foncé", "Bleu marine"], ["crème", "Beige"], ["verte", "Vert"], ["rose clair", "Rose"], ["bleu acme", ""], ["inconnue", ""]])("rapproche la proposition IA %s", (texte, attendu) => { expect(couleurDepuisIA(texte)).toBe(attendu); });
  it.each(["Polos", "T-shirts", "Chemises", "Pulls", "Vestes", "Robes", "Jupes"])("propose XS à 3XL pour %s", categorie => { expect(taillesPourArticle(categorie, "homme")).toEqual(["XS", "S", "M", "L", "XL", "XXL", "3XL"]); });
  it.each(["Pantalons", "Jeans"])("propose les tailles numériques et XS à XXL pour %s", categorie => { expect(taillesPourArticle(categorie, "femme")).toEqual(["36", "38", "40", "42", "44", "46", "48", "50", "XS", "S", "M", "L", "XL", "XXL"]); });
  it("propose les pointures adultes, enfant et la taille unique", () => { expect(taillesPourArticle("Chaussures", "mixte")).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 35))); expect(taillesPourArticle("Chaussures", "enfant")).toEqual(Array.from({ length: 11 }, (_, i) => String(i + 24))); expect(taillesPourArticle("Accessoires", "enfant")).toEqual(["Unique"]); expect(taillesPourArticle("Polos", "enfant")).toEqual(["2 ans", "4 ans", "6 ans", "8 ans", "10 ans", "12 ans", "14 ans"]); expect(taillesPourArticle("inconnue", "homme")).toEqual([]); });
  it.each(CATEGORIES_ARTICLE)("accepte uniquement les tailles autorisées pour %s et chaque genre", categorie => { for (const genre of ["homme", "femme", "mixte", "enfant"]) { for (const taille of taillesPourArticle(categorie, genre)) expect(validerArticle({ ...valide, categorie, genre, tailles: [taille] }).tailles).toBeUndefined(); expect(validerArticle({ ...valide, categorie, genre, tailles: ["999"] }).tailles).toBeDefined(); } });
  it("retire seulement les tailles devenues incompatibles", () => { expect(filtrerTailles(["M", "40"], "Jeans", "homme")).toEqual(["M", "40"]); expect(filtrerTailles(["M", "40"], "Chaussures", "homme")).toEqual(["40"]); expect(filtrerTailles(["M", "4 ans"], "Polos", "enfant")).toEqual(["4 ans"]); });
});

describe("signature réelle des photos", () => {
  it("reconnaît JPEG, PNG et WebP par leurs octets magiques", () => {
    expect(typeImageReel(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(typeImageReel(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(typeImageReel(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(typeImageReel(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(typeImageReel(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
  it("refuse un fichier annoncé JPEG dont le contenu n'en est pas un", async () => {
    expect(await estJpegReel(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], { type: "image/jpeg" }))).toBe(true);
    expect(await estJpegReel(new Blob(["<html>"], { type: "image/jpeg" }))).toBe(false);
    expect(await estJpegReel(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/jpeg" }))).toBe(false);
  });
});

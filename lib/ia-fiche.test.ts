import { describe, expect, it } from "vitest";
import { champsVidesAPreRemplir, PHOTO_A_REPRENDRE, validerFicheIA } from "./ia-fiche";
const reponse = { estVetement: true, nette: true, titre: "Polo bleu", description: "Polo bleu à manches courtes. Col boutonné.", categorie: "T-shirts et polos", genre: "homme", couleur: "Bleu marine" };
describe("validation et nettoyage des propositions IA", () => {
  it("valide la fiche descriptive sans prix ni taille", () => { expect(validerFicheIA(reponse)).toEqual({ titre: reponse.titre, description: reponse.description, categorie: "T-shirts et polos", genre: "homme", couleur: "Bleu marine" }); });
  it.each([{ estVetement: false }, { nette: false }])("demande une autre photo si %j", changement => { expect(() => validerFicheIA({ ...reponse, ...changement })).toThrow(PHOTO_A_REPRENDRE); });
  it.each([{ categorie: "Inconnue" }, { genre: "autre" }, { titre: "X" }, { titre: "x".repeat(121) }, { couleur: "x".repeat(81) }, { description: "x".repeat(601) }, { nette: "oui" }, { prix: 5000 }, { taille: "M" }, { couleur: null }])("refuse une réponse invalide %j", changement => { expect(() => validerFicheIA({ ...reponse, ...changement })).toThrow(); });
  it("enlève les marques, logos, affirmations d’authenticité et noms inconnus même en minuscules", () => {
    const fiche = validerFicheIA({ ...reponse, titre: "Polo Nike original", description: "Polo bleu à manches courtes. Logo authentique Nike. Marque inconnue acme. Col boutonné.", couleur: "bleu acme" });
    expect(fiche.titre).toBe("T-shirts et polos"); expect(fiche.couleur).toBe(""); expect(fiche.description).toBe("Polo bleu à manches courtes. Col boutonné.");
  });
  it("limite la description à deux phrases et retire les prix et tailles", () => {
    expect(validerFicheIA({ ...reponse, description: "Prix 3000 DA. Taille M. Polo bleu. Col boutonné. Manches courtes." }).description).toBe("Polo bleu. Col boutonné.");
  });
  it("remplit uniquement les champs vides sans toucher aux valeurs saisies", () => {
    expect(champsVidesAPreRemplir({ titre: "Mon titre", description: "", categorie: "Robes", genre: "femme", couleur: " " }, validerFicheIA(reponse))).toEqual({ description: reponse.description, couleur: "Bleu marine" });
  });
});

describe("IA : produits de beauté", () => {
  it("accepte un produit de beauté de la nouvelle liste et garde une description descriptive", () => {
    const parfum = { estVetement: true, nette: true, titre: "Parfum oud", description: "Flacon en verre transparent avec un bouchon doré. Parfum de 100 ml.", categorie: "Parfums", genre: "mixte", couleur: "Ambre" };
    const fiche = validerFicheIA(parfum);
    expect(fiche).toMatchObject({ titre: "Parfum oud", categorie: "Parfums", genre: "mixte" });
    expect(fiche.description).toBe("Flacon en verre transparent avec un bouchon doré.");
  });
  it("refuse une ancienne catégorie", () => { expect(() => validerFicheIA({ estVetement: true, nette: true, titre: "Polo", description: "", categorie: "Polos", genre: "homme", couleur: "" })).toThrow(); });
});

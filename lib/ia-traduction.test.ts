import { describe, expect, it } from "vitest";
import { texteArabeTraduction, validerSaisieTraduction, validerTraductionIA } from "./ia-traduction";
const traduction = { titreAr: "قميص أزرق", descriptionAr: "قميص بأكمام قصيرة." };
describe("US-15 : validation de la traduction", () => {
  it("valide de l’arabe et assemble titre et description avec un saut de ligne", () => { expect(validerTraductionIA(traduction)).toEqual(traduction); expect(texteArabeTraduction(traduction)).toBe("قميص أزرق\nقميص بأكمام قصيرة."); });
  it.each([{ titreAr: "" }, { descriptionAr: " " }, { titreAr: "Polo bleu" }, { descriptionAr: "Description française" }, { titreAr: "ق".repeat(121) }, { descriptionAr: "ق".repeat(1001) }, { titreAr: null }, { prix: 5000 }, { titreAr: "قميص Nike" }, { descriptionAr: "قميص أصلي" }, { descriptionAr: "ماركة نايك" }])("rejette un résultat invalide %j", changement => { expect(() => validerTraductionIA({ ...traduction, ...changement })).toThrow(); });
  it("accepte les bornes de longueur", () => { expect(validerTraductionIA({ titreAr: "ق".repeat(120), descriptionAr: "ق".repeat(1000) }).titreAr.length).toBe(120); });
  it("permet une description vide uniquement lorsque la source est vide", () => { expect(validerTraductionIA({ ...traduction, descriptionAr: "" }, true).descriptionAr).toBe(""); });
  it.each([{ titre: "" }, { titre: "x".repeat(121) }, { description: "x".repeat(1001) }, { titre: 2 }, { extra: "injection" }])("rejette une saisie invalide %j", changement => { expect(() => validerSaisieTraduction({ titre: "Polo", description: "Bleu", ...changement })).toThrow(); });
  it("valide le titre seul sans inventer une description", () => { expect(validerSaisieTraduction({ titre: " Polo ", description: "" })).toEqual({ titre: "Polo", description: "" }); });
});

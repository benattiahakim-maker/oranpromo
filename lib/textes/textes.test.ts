import { describe, expect, it } from "vitest";
import { fr } from "./fr";
import { ar } from "./ar";
import { textesDe } from ".";

type Arbre = { [cle: string]: string | Arbre };
function feuilles(arbre: Arbre, prefixe = ""): [string, string][] {
  return Object.entries(arbre).flatMap(([cle, valeur]) => typeof valeur === "string" ? [[`${prefixe}${cle}`, valeur] as [string, string]] : feuilles(valeur, `${prefixe}${cle}.`));
}
const variables = (texte: string) => [...texte.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe("US-23 : dictionnaires", () => {
  it("l'arabe a exactement les mêmes clés que le français, sans texte vide", () => {
    expect(feuilles(ar).map(([cle]) => cle)).toEqual(feuilles(fr).map(([cle]) => cle));
    for (const [cle, texte] of [...feuilles(fr), ...feuilles(ar)]) expect(texte.trim(), cle).not.toBe("");
  });
  it("chaque texte arabe garde les mêmes {variables} que le français", () => {
    const arabe = new Map(feuilles(ar));
    for (const [cle, texte] of feuilles(fr)) expect(variables(arabe.get(cle)!), cle).toEqual(variables(texte));
  });
  it("textesDe choisit le dictionnaire de la langue", () => {
    expect(textesDe("ar")).toBe(ar);
    expect(textesDe("fr")).toBe(fr);
  });
  it("textes validés par le propriétaire (9/10) : erreur générale", () => {
    expect(ar.erreur.titre).toBe("كاين مشكل");
    expect(ar.erreur.reessayer).toBe("عاود جرّب");
  });
});

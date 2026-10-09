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
  it("les textes validés par le propriétaire (9/10) sont repris tels quels", () => {
    expect(ar.accueil.voirPromos).toBe("شوف التخفيضات"); // 1
    expect(ar.fiche.ajouter).toBe("زيد للسلة"); // 2
    expect(ar.panier.commander).toBe("اطلب"); // 3
    expect(ar.fiche.confirmation).toContain("الخلاص في الحانوت"); // 4
    expect(ar.panier.mention).toContain("الخلاص في الحانوت");
    expect(ar.commandes.titresSuivi.prete).toBe("طلبك راهو واجد"); // 5
    expect(ar.noShows.contester).toBe("اعترض"); // 6
    expect(ar.fiche.plusDisponible).toBe("هاد السلعة ما بقاتش"); // 7
    expect(`${ar.erreur.titre} · ${ar.erreur.reessayer}`).toBe("كاين مشكل · عاود جرّب"); // 9
  });
  it("chaque catégorie et chaque univers a sa traduction", async () => {
    const { CATEGORIES_ARTICLE, UNIVERS, GENRES_ARTICLE } = await import("@/lib/article");
    for (const c of CATEGORIES_ARTICLE) { expect(fr.listes.categories[c]).toBe(c); expect(ar.listes.categories[c]).toBeTruthy(); }
    for (const u of UNIVERS) expect(fr.listes.univers[u.cle]).toBe(u.nom);
    for (const g of GENRES_ARTICLE) expect(ar.listes.genres[g]).toBeTruthy();
  });
});

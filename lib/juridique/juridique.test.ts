import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyserDocument, analyserEnLigne, blocsDocument, CHEMINS, DOCUMENTS_JURIDIQUES, formaterVersion, VERSION_PROVISOIRE, VERSIONS } from ".";
import { TEXTES_JURIDIQUES } from "./textes";

const FICHIERS = { conditions: "conditions-utilisation.md", conditions_commercants: "conditions-commercants.md", confidentialite: "confidentialite.md" } as const;

describe("US-34.1 : textes juridiques", () => {
  it.each(DOCUMENTS_JURIDIQUES)("%s : copie exacte du brouillon de docs/juridique/", document => {
    expect(TEXTES_JURIDIQUES[document]).toBe(readFileSync(join(process.cwd(), "docs/juridique", FICHIERS[document]), "utf8"));
  });
  it("versions datées AAAA-MM-JJ, chemins publics, bandeau provisoire tant que l'avocat n'a pas relu", () => {
    for (const d of DOCUMENTS_JURIDIQUES) expect(VERSIONS[d]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CHEMINS).toEqual({ conditions: "/conditions", conditions_commercants: "/conditions-commercants", confidentialite: "/confidentialite" });
    expect(VERSION_PROVISOIRE).toBe(true);
  });
  it("formaterVersion : 2026-10-10 → 10/10/2026, 2026-01-05 → 5/1/2026", () => {
    expect(formaterVersion("2026-10-10")).toBe("10/10/2026");
    expect(formaterVersion("2026-01-05")).toBe("5/1/2026");
    expect(formaterVersion("autre")).toBe("autre");
  });
  it("gras et code en ligne", () => {
    expect(analyserEnLigne("a **b** `[RC]` c")).toEqual([{ texte: "a " }, { texte: "b", gras: true }, { texte: " [RC] c" }]);
  });
  it("le titre # et la consigne interne (première citation) ne sont pas publiés", () => {
    const blocs = analyserDocument("# Titre — BROUILLON\n\n> Consigne interne `docs/`\n\n## 1. Section\n\nTexte.\n\n> Citation publiée");
    expect(blocs).toEqual([
      { type: "titre", niveau: 2, segments: [{ texte: "1. Section" }] },
      { type: "paragraphe", segments: [{ texte: "Texte." }] },
      { type: "paragraphe", segments: [{ texte: "Citation publiée" }] },
    ]);
    for (const d of DOCUMENTS_JURIDIQUES) expect(JSON.stringify(blocsDocument(d))).not.toContain("docs/juridique");
  });
  it("listes à puces et numérotées, suite d'élément indentée, tableaux", () => {
    const blocs = analyserDocument("- un\n- deux\n  suite\n\n1. a\n2. b\n\n| A | B |\n| --- | --- |\n| x | **y** |");
    expect(blocs[0]).toEqual({ type: "liste", ordonnee: false, elements: [[{ texte: "un" }], [{ texte: "deux suite" }]] });
    expect(blocs[1]).toMatchObject({ type: "liste", ordonnee: true });
    expect(blocs[2]).toEqual({ type: "tableau", entetes: [[{ texte: "A" }], [{ texte: "B" }]], lignes: [[[{ texte: "x" }], [{ texte: "y", gras: true }]]] });
  });
  it("les trois documents donnent leurs sections (BleDeal ne vend rien, blocage au 5e no-show, droits, prestataires)", () => {
    const texte = (d: (typeof DOCUMENTS_JURIDIQUES)[number]) => JSON.stringify(blocsDocument(d));
    expect(texte("conditions")).toContain("BleDeal ne vend rien.");
    expect(texte("conditions")).toContain("Au 5e « client pas venu », le compte est bloqué");
    expect(texte("conditions_commercants")).toContain("Authenticité");
    expect(texte("confidentialite")).toContain("Vos droits");
    expect(blocsDocument("confidentialite").some(b => b.type === "tableau")).toBe(true);
  });
});

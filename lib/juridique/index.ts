// US-34.1 : textes juridiques (conditions clients, conditions commerçants, confidentialité), versions et lecture.
// Les textes sont des BROUILLONS (docs/juridique/) : chaque page affiche « Version provisoire, en cours de relecture
// juridique » tant que l'avocat ne les a pas relus (décision du propriétaire du 10/10).
import { TEXTES_JURIDIQUES } from "./textes";

export type DocumentJuridique = "conditions" | "conditions_commercants" | "confidentialite";
export const DOCUMENTS_JURIDIQUES: readonly DocumentJuridique[] = ["conditions", "conditions_commercants", "confidentialite"];

/** Version en vigueur de chaque texte (date AAAA-MM-JJ) ; la même que dans la base (versions_documents, US-34.2). */
export const VERSIONS: Record<DocumentJuridique, string> = {
  conditions: "2026-10-10",
  conditions_commercants: "2026-10-10",
  confidentialite: "2026-10-10",
};

/** Tant que vrai : bandeau « version provisoire » sur chaque page et dans chaque demande d'acceptation. */
export const VERSION_PROVISOIRE = true;

export const CHEMINS: Record<DocumentJuridique, string> = {
  conditions: "/conditions",
  conditions_commercants: "/conditions-commercants",
  confidentialite: "/confidentialite",
};

/** « 2026-10-10 » → « 10/10/2026 ». */
export function formaterVersion(version: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!m) return version;
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
}

export type Segment = { texte: string; gras?: boolean };
export type Bloc =
  | { type: "titre"; niveau: 2 | 3; segments: Segment[] }
  | { type: "paragraphe"; segments: Segment[] }
  | { type: "liste"; ordonnee: boolean; elements: Segment[][] }
  | { type: "tableau"; entetes: Segment[][]; lignes: Segment[][][] };

/** Texte en ligne : **gras** ; `code` et [crochets] gardés tels quels (sans les accents graves). */
export function analyserEnLigne(texte: string): Segment[] {
  const segments: Segment[] = [];
  const morceaux = texte.replace(/`([^`]*)`/g, "$1").split(/\*\*/);
  morceaux.forEach((morceau, i) => {
    if (morceau === "") return;
    segments.push(i % 2 === 1 ? { texte: morceau, gras: true } : { texte: morceau });
  });
  return segments;
}

function cellules(ligne: string): string[] {
  return ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

/**
 * Sous-ensemble du Markdown des brouillons : titres ## et ###, paragraphes, listes (- et 1.), tableaux, gras.
 * Le titre # et le premier bloc de citation (consignes internes du brouillon) ne sont pas publiés.
 */
export function analyserDocument(markdown: string): Bloc[] {
  const lignes = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocs: Bloc[] = [];
  let i = 0;
  let citationSautee = false;
  while (i < lignes.length) {
    const ligne = lignes[i];
    const propre = ligne.trim();
    if (propre === "") { i++; continue; }
    if (/^# /.test(propre)) { i++; continue; }
    if (propre.startsWith(">")) {
      const contenu: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) { contenu.push(lignes[i].trim().replace(/^>\s?/, "")); i++; }
      if (!citationSautee) { citationSautee = true; continue; }
      blocs.push({ type: "paragraphe", segments: analyserEnLigne(contenu.join(" ")) });
      continue;
    }
    const titre = /^(#{2,3}) (.*)$/.exec(propre);
    if (titre) { blocs.push({ type: "titre", niveau: titre[1].length as 2 | 3, segments: analyserEnLigne(titre[2]) }); i++; continue; }
    if (propre.startsWith("|")) {
      const tableau: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) { tableau.push(lignes[i]); i++; }
      const [entete, , ...corps] = tableau;
      blocs.push({ type: "tableau", entetes: cellules(entete).map(analyserEnLigne), lignes: corps.map(l => cellules(l).map(analyserEnLigne)) });
      continue;
    }
    const puce = /^(-|\d+\.) /;
    if (puce.test(propre)) {
      const ordonnee = /^\d+\./.test(propre);
      const elements: Segment[][] = [];
      while (i < lignes.length && puce.test(lignes[i].trim())) {
        let element = lignes[i].trim().replace(puce, "");
        i++;
        // Suite d'un élément sur la ligne suivante (indentée).
        while (i < lignes.length && /^\s{2,}\S/.test(lignes[i]) && !puce.test(lignes[i].trim())) { element += " " + lignes[i].trim(); i++; }
        elements.push(analyserEnLigne(element));
      }
      blocs.push({ type: "liste", ordonnee, elements });
      continue;
    }
    const paragraphe: string[] = [];
    while (i < lignes.length && lignes[i].trim() !== "" && !/^(#{1,3} |>|\||-\s|\d+\.\s)/.test(lignes[i].trim())) { paragraphe.push(lignes[i].trim()); i++; }
    blocs.push({ type: "paragraphe", segments: analyserEnLigne(paragraphe.join(" ")) });
  }
  return blocs;
}

/** Blocs publiables d'un document. */
export function blocsDocument(document: DocumentJuridique): Bloc[] {
  return analyserDocument(TEXTES_JURIDIQUES[document]);
}

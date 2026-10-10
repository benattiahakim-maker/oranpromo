// Pour les tests : trouver un texte coupé en plusieurs éléments (par exemple un prix isolé dans <Prix />, un numéro
// dans <Numero />). Renvoie l'élément le plus profond dont le texte complet correspond.
export function texteComplet(motif: RegExp | string) {
  // Espaces normalisées comme le fait Testing Library (les prix ont des espaces insécables).
  const correspond = (brut: string) => { const texte = brut.replace(/\s+/g, " ").trim(); return typeof motif === "string" ? texte === motif : motif.test(texte); };
  return (_contenu: string, element: Element | null) => Boolean(element && correspond(element.textContent ?? "")
    && ![...element.children].some(enfant => correspond(enfant.textContent ?? "")));
}

/** Texte d'un rendu HTML sans les balises (rendu serveur `renderToStaticMarkup`), espaces normalisées. */
export function sansBalises(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FournisseurTextes from "./FournisseurTextes";
import PiedDePage from "./PiedDePage";
import { textesDe } from "@/lib/textes";

describe("US-34.1 : pied de page", () => {
  it.each([["fr", ["Conditions", "Commerçants", "Confidentialité"]], ["ar", ["الشروط", "التجار", "الخصوصية"]]] as const)("%s : trois liens juridiques", (langue, libelles) => {
    const html = renderToStaticMarkup(<FournisseurTextes langue={langue} textes={textesDe(langue)}><PiedDePage /></FournisseurTextes>);
    for (const l of libelles) expect(html).toContain(l);
    expect(html).toContain('href="/conditions"');
    expect(html).toContain('href="/conditions-commercants"');
    expect(html).toContain('href="/confidentialite"');
  });
});

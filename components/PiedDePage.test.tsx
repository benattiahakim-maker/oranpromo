import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FournisseurTextes from "./FournisseurTextes";
const chemin = vi.hoisted(() => ({ valeur: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => chemin.valeur }));
import PiedDePage, { pageEnFrancais } from "./PiedDePage";
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

describe("revue RTL : pied de page des pages en français", () => {
  const francais = { piedDePage: "Informations juridiques", conditions: "Conditions", commercants: "Commerçants", confidentialite: "Confidentialité" };
  const afficher = (c: string) => { chemin.valeur = c; return renderToStaticMarkup(<FournisseurTextes langue="ar" textes={textesDe("ar")}><PiedDePage francais={francais} /></FournisseurTextes>); };
  beforeEach(() => { chemin.valeur = "/"; });
  it.each(["/espace/affiche", "/admin", "/admin/bons", "/confirmer/abc"])("site en arabe, %s : libellés français, ltr", (c) => {
    const html = afficher(c);
    expect(html).toMatch(/^<footer dir="ltr" lang="fr"/);
    for (const l of ["Conditions", "Commerçants", "Confidentialité", "Informations juridiques"]) expect(html).toContain(l);
    expect(html).not.toContain("الشروط");
  });
  it.each(["/", "/compte", "/conditions", "/espaces", "/administration", "/b/espace", "/espace", "/espace/commandes", "/espace/connexion", "/espace/affiches"])("site en arabe, %s : pied de page en arabe (suit la page)", (c) => {
    const html = afficher(c);
    expect(html).toContain("الشروط"); expect(html).not.toContain('dir="ltr"');
  });
  it("pageEnFrancais", () => {
    expect(pageEnFrancais(null)).toBe(false); expect(pageEnFrancais("/espace")).toBe(false); expect(pageEnFrancais("/espace/affiche")).toBe(true); expect(pageEnFrancais("/espace-x")).toBe(false);
  });
});

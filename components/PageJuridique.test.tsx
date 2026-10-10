import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./EntetePublic", () => ({ default: () => <header>entête</header> }));
import PageJuridique from "./PageJuridique";

describe("US-34.1 : pages juridiques", () => {
  it("français : titre, version datée, bandeau « version provisoire », texte publié sans la consigne interne", () => {
    const html = renderToStaticMarkup(<PageJuridique document="conditions" langue="fr" />);
    expect(html).toContain("Conditions d’utilisation");
    expect(html).toContain("Version du 10/10/2026");
    expect(html).toContain("Version provisoire, en cours de relecture juridique.");
    expect(html).toContain("BleDeal ne vend rien.");
    expect(html).not.toContain("docs/juridique");
    expect(html).not.toContain("Le texte officiel"); expect(html).not.toContain("data-traduction-attente");
  });
  it("arabe : titre et bandeaux en arabe, texte français (dir=ltr) en attendant la traduction juridique", () => {
    const html = renderToStaticMarkup(<PageJuridique document="confidentialite" langue="ar" />);
    expect(html).toContain("سياسة الخصوصية");
    expect(html).toContain("نسخة مؤقتة، راهي في المراجعة القانونية.");
    expect(html).toContain("النص الرسمي هو النسخة بالفرنسية اللي تحت. الترجمة بالعربية تجي من بعد المراجعة القانونية.");
    expect(html).toContain('dir="ltr" lang="fr"');
    expect(html).toContain("<table");
  });
  it.each(["conditions", "conditions_commercants", "confidentialite"] as const)("arabe, %s : l’avis « texte officiel en français » est tout en haut, avant le titre", (document) => {
    const html = renderToStaticMarkup(<PageJuridique document={document} langue="ar" />);
    const avis = html.indexOf("النص الرسمي هو النسخة بالفرنسية");
    expect(avis).toBeGreaterThan(-1);
    expect(html.slice(html.indexOf("<main"), avis)).not.toContain("<h1");
  });
  it("conditions commerçants : authenticité et produits interdits", () => {
    const html = renderToStaticMarkup(<PageJuridique document="conditions_commercants" langue="fr" />);
    expect(html).toContain("Conditions commerçants");
    expect(html).toContain("Produits interdits");
  });
});

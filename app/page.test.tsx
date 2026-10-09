import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Accueil from "./page";
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/catalogue", () => ({ chargerPromos: async () => [] }));
vi.mock("@/components/Promos", () => ({ default: () => null }));
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => <span data-src={props.src} data-alt={props.alt} /> }));

describe("page d’accueil : images de marque", () => {
  it("affiche la photo de Santa Cruz avec son crédit, et les tuiles avec les images de marque", async () => {
    const html = renderToStaticMarkup(await Accueil());
    expect(html).toContain('data-src="/images/accueil/accueil-santa-cruz.webp" data-alt=""');
    expect(html).toContain("Les promos d’Oran");
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:Santa_cruz_Oran.jpg"'); expect(html).toContain(">Bachounda</a>");
    expect(html).toContain('href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr"'); expect(html).toContain("CC BY-SA 4.0</a>, Wikimedia Commons");
    expect(html).toContain("/images/accueil/univers-femme.webp"); expect(html).toContain("/images/accueil/cat-parfums.webp");
    expect(html).not.toContain("tuile-unie");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Accueil from "./page";
const { langue } = vi.hoisted(() => ({ langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => langue.valeur, getTextes: async () => textesDe(langue.valeur) }; });
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

describe("US-23 : accueil en arabe", () => {
  it("bouton « شوف التخفيضات » (texte validé), univers et catégories traduits, liens inchangés", async () => {
    langue.valeur = "ar";
    const html = renderToStaticMarkup(await Accueil());
    langue.valeur = "fr";
    expect(html).toContain(">شوف التخفيضات</a>");
    expect(html).toContain("بروموات وهران");
    expect(html).toContain(">نساء<"); expect(html).toContain(">عطور<");
    expect(html).toContain('href="/catalogue?promo=1"');
    expect(html).not.toContain("Voir les promos");
  });
});

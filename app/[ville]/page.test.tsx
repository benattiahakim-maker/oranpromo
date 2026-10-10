import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Accueil from "./page";
const { langue } = vi.hoisted(() => ({ langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => langue.valeur, getTextes: async () => textesDe(langue.valeur) }; });
vi.mock("@/lib/ville-serveur", async () => { const { VILLE_ORAN } = await import("@/lib/ville"); const TLEMCEN = { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167 }; return { getVilleOuverte: async (code: string) => ({ oran: VILLE_ORAN, tlemcen: TLEMCEN } as Record<string, typeof VILLE_ORAN>)[code] ?? null, getVillesOuvertes: async () => [VILLE_ORAN] }; });
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
const { chargerPromos } = vi.hoisted(() => ({ chargerPromos: vi.fn(async () => []) }));
vi.mock("@/lib/catalogue", () => ({ chargerPromos }));
vi.mock("@/components/Promos", () => ({ default: () => null }));
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => <span data-src={props.src} data-alt={props.alt} /> }));

describe("page d’accueil : images de marque", () => {
  it("affiche la photo de Santa Cruz avec son crédit, et les tuiles avec les images de marque", async () => {
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
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
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    langue.valeur = "fr";
    expect(html).toContain(">شوف التخفيضات</a>");
    expect(html).toContain("بروموات وهران");
    expect(html).toContain(">نساء<"); expect(html).toContain(">عطور<");
    expect(html).toContain('href="/oran/catalogue?promo=1"');
    expect(html).not.toContain("Voir les promos");
  });
});

describe("US-24.3 : lien vers la carte sur l'accueil", () => {
  it("bloc « Les boutiques sur la carte » vers /oran/carte, sans carte ni tuile chargée", async () => {
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    expect(html).toContain('href="/oran/carte"');
    expect(html).toContain("Les boutiques sur la carte");
    expect(html).toContain("Trouvez les promos près de chez vous.");
    expect(html).not.toMatch(/leaflet|basemaps|tile\.openstreetmap/);
  });
  it("en arabe : « الحوانت في الخريطة · شوف الخريطة »", async () => {
    langue.valeur = "ar";
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    langue.valeur = "fr";
    expect(html).toContain("الحوانت في الخريطة");
    expect(html).toContain("شوف الخريطة");
  });
});

describe("US-27.3 : bloc « Parraine tes amis » sur l'accueil", () => {
  it("absent tant que le parrainage est fermé (ou base illisible)", async () => {
    expect(renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }))).not.toContain('href="/parrainage"');
  });
  it("présent quand il est ouvert : « Parraine tes amis · 300 DA chacun » vers /parrainage", async () => {
    const serveur = await import("@/lib/supabase/server");
    vi.spyOn(serveur, "creerClientServeur").mockResolvedValueOnce({ rpc: async (nom: string) => ({ data: nom === "parrainage_ouvert", error: null }) } as never);
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    expect(html).toContain('href="/parrainage"'); expect(html).toContain("Parraine tes amis"); expect(html).toContain("300 DA chacun");
  });
});

describe("US-29.2 : accueil d'une ville (/oran)", () => {
  it("liens de la ville : tuiles, « Voir les promos », « Tout voir », carte ; adresse canonique /oran", async () => {
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    expect(html).toContain('href="/oran/catalogue?univers=femme"');
    expect(html).toContain('href="/oran/catalogue?categorie=Robes"');
    expect(html).toContain('href="/oran/catalogue"');
    expect(html).not.toMatch(/href="\/catalogue/);
    const { generateMetadata } = await import("./page");
    expect(await generateMetadata({ params: Promise.resolve({ ville: "oran" }) })).toEqual({ title: "Promos à Oran", description: "Les promos des boutiques de vêtements d’Oran. Réservez sur WhatsApp, payez en boutique.", alternates: { canonical: "/oran" } });
  });
  it("ville fermée ou inconnue (sans passer par le layout) : page introuvable", async () => {
    await expect(Accueil({ params: Promise.resolve({ ville: "alger" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("US-29.3 : accueil d'une autre ville (Tlemcen)", () => {
  it("« Les promos de Tlemcen », promos de Tlemcen seulement, photo commune sans crédit, liens /tlemcen/…", async () => {
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "tlemcen" }) }));
    expect(html).toContain("Les promos de Tlemcen");
    expect(chargerPromos).toHaveBeenLastCalledWith(expect.anything(), "tlemcen");
    expect(html).toContain('data-src="/images/accueil/cat-robes.webp"');
    expect(html).not.toContain("Santa"); expect(html).not.toContain("Bachounda");
    expect(html).toContain('href="/tlemcen/carte"'); expect(html).toContain('href="/tlemcen/catalogue?promo=1"');
    const { generateMetadata } = await import("./page");
    expect(await generateMetadata({ params: Promise.resolve({ ville: "tlemcen" }) })).toMatchObject({ title: "Promos à Tlemcen", description: "Les promos des boutiques de vêtements de Tlemcen. Réservez sur WhatsApp, payez en boutique." });
  });
  it("en arabe : « بروموات تلمسان »", async () => {
    langue.valeur = "ar";
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "tlemcen" }) }));
    langue.valeur = "fr";
    expect(html).toContain("بروموات تلمسان");
  });
  it("Oran : promos d'Oran, Santa Cruz et son crédit (comme avant)", async () => {
    const html = renderToStaticMarkup(await Accueil({ params: Promise.resolve({ ville: "oran" }) }));
    expect(chargerPromos).toHaveBeenLastCalledWith(expect.anything(), "oran");
    expect(html).toContain("Les promos d’Oran"); expect(html).toContain(">Bachounda</a>");
  });
});

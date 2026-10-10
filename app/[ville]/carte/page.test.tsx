import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Carte, { generateMetadata } from "./page";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/ville-serveur", async () => { const { VILLE_ORAN } = await import("@/lib/ville"); const TLEMCEN = { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167 }; return { getVilleOuverte: async (code: string) => ({ oran: VILLE_ORAN, tlemcen: TLEMCEN } as Record<string, typeof VILLE_ORAN>)[code] ?? null, getVillesOuvertes: async () => [VILLE_ORAN] }; });
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => "fr", getTextes: async () => textesDe("fr") }; });
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const lignes = [
  { id: "a", slug: "boutique-nour", nom: "Boutique Nour", quartier: "Akid Lotfi", latitude: 35.7303, longitude: -0.5784, promos_en_cours: 0, rayons: [{ categorie: "Robes", genre: "femme" }] },
  { id: "b", slug: "maison-ilyes", nom: "Maison Ilyes", quartier: "Front de Mer", latitude: 35.7034, longitude: -0.6436, promos_en_cours: 1, rayons: [{ categorie: "Chemises", genre: "homme" }] },
  { id: "c", slug: "atelier-sarah", nom: "Atelier Sarah", quartier: "Gambetta", latitude: null, longitude: null, promos_en_cours: 0, rayons: [] },
];
const page = async (univers?: string) => renderToStaticMarkup(await Carte({ params: Promise.resolve({ ville: "oran" }), searchParams: Promise.resolve(univers ? { univers } : {}) }));
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: lignes, error: null }); });

describe("US-24.3 : /carte rendue par le serveur (liste lisible sans JavaScript)", () => {
  it("une seule lecture, boutiques_carte ; liste et section « Sans position » dans le HTML", async () => {
    const html = await page();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("boutiques_carte", { code_ville: "oran" });
    expect(html).toContain('href="/b/boutique-nour"'); expect(html).toContain('href="/b/maison-ilyes"');
    expect(html).toContain("Sans position sur la carte (1)"); expect(html).toContain('href="/b/atelier-sarah"');
    expect(html).toContain("1 promo en cours");
  });
  it("filtre ?univers=homme appliqué par le serveur ; univers inconnu ignoré", async () => {
    const html = await page("homme");
    expect(html).toContain("Maison Ilyes"); expect(html).not.toContain("Boutique Nour"); expect(html).not.toContain("Atelier Sarah");
    expect(await page("inconnu")).toContain("Atelier Sarah");
  });
  it("erreur de lecture : message clair", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "réseau" } });
    expect(await page()).toContain("Impossible de charger les boutiques. Réessayez.");
  });
  it("titre de la page", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ ville: "oran" }) })).toEqual({ title: "Carte des boutiques", alternates: { canonical: "/oran/carte" } });
  });
});

describe("US-29.3 : carte d'une ville", () => {
  it("épingles de la ville demandée ; « 2 boutiques à Tlemcen »", async () => {
    rpc.mockResolvedValue({ data: lignes.slice(0, 2), error: null });
    const html = renderToStaticMarkup(await Carte({ params: Promise.resolve({ ville: "tlemcen" }), searchParams: Promise.resolve({}) }));
    expect(rpc).toHaveBeenCalledWith("boutiques_carte", { code_ville: "tlemcen" });
    expect(html).toContain("2 boutiques à Tlemcen");
    expect(html).toContain('href="/tlemcen/carte?univers=femme"');
  });
  it("Oran : « 3 boutiques à Oran » (comme avant)", async () => {
    expect(await page()).toContain("3 boutiques à Oran");
  });
});

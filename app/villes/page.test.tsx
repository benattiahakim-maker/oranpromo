import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { langue, cookie } = vi.hoisted(() => ({ langue: { valeur: "fr" as "fr" | "ar" }, cookie: { valeur: null as string | null } }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => langue.valeur, getTextes: async () => textesDe(langue.valeur) }; });
vi.mock("@/lib/ville-serveur", async () => {
  const { VILLE_ORAN } = await import("@/lib/ville");
  return { getCookieVille: async () => cookie.valeur, getVillesOuvertes: async () => [{ ...VILLE_ORAN, boutiques: 12 }, { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", boutiques: 1 }] };
});
vi.mock("@/app/ville/actions", () => ({ choisirVille: vi.fn() }));
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
import FournisseurTextes from "@/components/FournisseurTextes";
import { textesDe } from "@/lib/textes";
import Villes, { generateMetadata } from "./page";

const page = async (params: Record<string, string> = {}) => {
  const contenu = await Villes({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(<FournisseurTextes langue={langue.valeur} textes={textesDe(langue.valeur)}>{contenu}</FournisseurTextes>);
};

describe("US-29.2 : page /villes", () => {
  it("titre, texte, « Me localiser », villes ouvertes avec leur nombre de boutiques, chaque ville = bouton du formulaire", async () => {
    const html = await page({ retour: "/oran/catalogue?promo=1" });
    expect(html).toContain("Choisissez votre ville");
    expect(html).toContain("Les promos et les boutiques dépendent de la ville. Vous pourrez en changer à tout moment.");
    expect(html).toContain("Me localiser");
    expect(html).toMatch(/value="oran"[^>]*name="ville">.*?Oran.*?12 boutiques/);
    expect(html).toMatch(/value="tlemcen"[^>]*name="ville">.*?Tlemcen.*?1 boutique </);
    expect(html).toContain('name="retour" value="/oran/catalogue?promo=1"');
    expect(html).not.toContain("pas encore sur BleDeal");
  });
  it("ville inconnue ou fermée demandée : « Cette ville n’est pas encore sur BleDeal. »", async () => {
    expect(await page({ inconnue: "alger" })).toContain("Cette ville n’est pas encore sur BleDeal.");
  });
  it("ville gardée marquée comme actuelle", async () => {
    cookie.valeur = "tlemcen";
    const html = await page(); cookie.valeur = null;
    expect(html).toMatch(/value="tlemcen" aria-current="true"/);
  });
  it("en arabe : « اختار مدينتك », « لقاني وين راني », « وهران · 12 حانوت »", async () => {
    langue.valeur = "ar";
    const html = await page(); langue.valeur = "fr";
    expect(html).toContain("اختار مدينتك"); expect(html).toContain("لقاني وين راني");
    expect(html).toContain("وهران"); expect(html).toContain("12 حانوت");
  });
  it("titre de la page et adresse canonique", async () => {
    expect(await generateMetadata()).toEqual({ title: "Choisir sa ville", alternates: { canonical: "/villes" } });
  });
});

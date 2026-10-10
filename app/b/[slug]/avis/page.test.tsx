import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { lireResumes, lireAvisBoutique, boutique } = vi.hoisted(() => ({ lireResumes: vi.fn(), lireAvisBoutique: vi.fn(), boutique: { valeur: { id: "b1", nom: "Boutique Nour" } as { id: string; nom: string } | null } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: boutique.valeur, error: null }) }) }) }) }) }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => "fr" }));
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));
vi.mock("@/lib/avis", async (original) => ({ ...(await original<typeof import("@/lib/avis")>()), lireResumes, lireAvisBoutique }));

const un = (i: number) => ({ id: `a${i}`, auteur: `Client ${i}`, note: 4, criteres: [], commentaire: `Avis ${i}`, mois: "2026-10-01", reponse: null });
const afficher = async (page?: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: "boutique-nour" }), searchParams: Promise.resolve(page ? { page } : {}) }));
beforeEach(() => { vi.clearAllMocks(); boutique.valeur = { id: "b1", nom: "Boutique Nour" };
  lireResumes.mockResolvedValue(new Map([["b1", { nombre: 25, moyenne: 4.2, criteres: { accueil: 0, article_conforme: 0, rapidite: 0 } }]])); });

describe("US-32.3 : « Voir tous les avis »", () => {
  it("20 avis par page, les plus récents d'abord ; lien vers les plus anciens", async () => {
    lireAvisBoutique.mockResolvedValue(Array.from({ length: 21 }, (_, i) => un(i)));
    const html = await afficher();
    expect(lireAvisBoutique).toHaveBeenCalledWith(expect.anything(), "b1", 21, 0);
    expect(html).toContain("Avis sur Boutique Nour"); expect(html).toContain("★ 4,2 · 25 avis");
    expect(html).toContain("Avis 19"); expect(html).not.toContain("Avis 20");
    expect(html).toContain('href="/b/boutique-nour/avis?page=2"'); expect(html).not.toContain("Avis plus récents");
  });
  it("page 2 : décalage de 20, lien vers les plus récents, pas de suivante", async () => {
    lireAvisBoutique.mockResolvedValue([un(20)]);
    const html = await afficher("2");
    expect(lireAvisBoutique).toHaveBeenCalledWith(expect.anything(), "b1", 21, 20);
    expect(html).toContain('href="/b/boutique-nour/avis?page=1"'); expect(html).not.toContain("Avis plus anciens");
  });
  it("page invalide → 1 ; boutique non validée : « Boutique indisponible » ; erreur : message", async () => {
    lireAvisBoutique.mockResolvedValue([]);
    await afficher("abc");
    expect(lireAvisBoutique).toHaveBeenCalledWith(expect.anything(), "b1", 21, 0);
    lireAvisBoutique.mockRejectedValue(new Error("x"));
    expect(await afficher()).toContain("Impossible de charger les avis. Réessayez.");
    boutique.valeur = null;
    expect(await afficher()).toContain("Boutique indisponible");
  });
});

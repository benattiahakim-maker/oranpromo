import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Statistiques from "./page";
const { getUser, eq, maybeSingle, chargerStatistiques } = vi.hoisted(() => ({ getUser: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), chargerStatistiques: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: (champ: string, id: string) => { eq(champ, id); return { maybeSingle }; } }) }) }) }));
vi.mock("@/lib/statistiques", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/statistiques")>(), chargerStatistiques }));
vi.mock("next/navigation", () => ({ redirect: (chemin: string) => { throw new Error(`redirection:${chemin}`); } }));
beforeEach(() => {
  vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null }); maybeSingle.mockResolvedValue({ data: { boutique_id: "ma-boutique" }, error: null });
  chargerStatistiques.mockResolvedValue({ vuesBoutique: 12, vuesArticles: 34, clicsReservation: 5, topArticles: [{ id: "a", titre: "Polo", vues: 8, clics: 2 }] });
});
describe("US-13 : page du commerçant", () => {
  it("lit les statistiques de ma boutique sur la période choisie", async () => {
    const html = renderToStaticMarkup(await Statistiques({ searchParams: Promise.resolve({ jours: "30" }) }));
    expect(eq).toHaveBeenCalledWith("id", "compte"); expect(chargerStatistiques).toHaveBeenCalledWith(expect.any(Object), "ma-boutique", 30);
    expect(html).toContain("Mes statistiques"); expect(html).toContain("Polo"); expect(html).toContain("8"); expect(html).toContain("Réserver"); expect(html).toContain('aria-current="page"');
  });
  it("protège la page même sans le proxy", async () => { getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(Statistiques({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirection:/espace/connexion"); expect(chargerStatistiques).not.toHaveBeenCalled(); });
  it("ne lit pas d’événements pour un compte sans boutique", async () => { maybeSingle.mockResolvedValue({ data: { boutique_id: null }, error: null }); const html = renderToStaticMarkup(await Statistiques({ searchParams: Promise.resolve({}) })); expect(html).toContain("aucune boutique"); expect(chargerStatistiques).not.toHaveBeenCalled(); });
  it("affiche une erreur de lecture plutôt que des compteurs nuls", async () => { chargerStatistiques.mockRejectedValue(new Error("Réseau")); const html = renderToStaticMarkup(await Statistiques({ searchParams: Promise.resolve({}) })); expect(html).toContain('role="alert"'); expect(html).toContain("Impossible de charger vos statistiques"); expect(html).not.toContain("Aucune vue"); });
});

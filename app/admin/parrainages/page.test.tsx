import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Parrainages from "./page";
import Remboursements from "../remboursements/page";
const { verifier, budget, parrainages, releves, deCote } = vi.hoisted(() => ({ verifier: vi.fn(), budget: vi.fn(), parrainages: vi.fn(), releves: vi.fn(), deCote: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/parrainage-admin", async o => ({ ...(await o<typeof import("@/lib/parrainage-admin")>()), lireBudget: budget, listerParrainages: parrainages, listerReleves: releves, listerLignesDeCote: deCote }));
beforeEach(() => {
  vi.clearAllMocks(); verifier.mockResolvedValue("admin");
  budget.mockResolvedValue({ mois: "2026-10-01", actif: false, budget: 30000, emis: 0, utilise: 0, en_file: 0, restant: 30000 });
  parrainages.mockResolvedValue([]); releves.mockResolvedValue([]); deCote.mockResolvedValue([]);
});
describe("US-27.5 pages admin", () => {
  it("non-admin : accès réservé, rien n’est lu", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    expect(renderToStaticMarkup(await Parrainages())).toContain("Accès réservé");
    expect(renderToStaticMarkup(await Remboursements({ searchParams: Promise.resolve({ mois: "2026-09" }) }))).toContain("Accès réservé");
    expect(budget).not.toHaveBeenCalled(); expect(parrainages).not.toHaveBeenCalled(); expect(releves).not.toHaveBeenCalled();
  });
  it("/admin/parrainages : budget et liste", async () => {
    const html = renderToStaticMarkup(await Parrainages());
    expect(html).toContain("Budget d’octobre : 0 DA émis sur 30 000 DA"); expect(html).toContain("Aucun parrainage pour l’instant.");
  });
  it("/admin/remboursements : mois de l’URL", async () => {
    const html = renderToStaticMarkup(await Remboursements({ searchParams: Promise.resolve({ mois: "2026-09" }) }));
    expect(releves).toHaveBeenCalledWith({}, "2026-09-01");
    expect(html).toContain("Septembre 2026 : 0 bon · 0 DA à rembourser");
  });
  it("erreur de lecture : message", async () => {
    releves.mockRejectedValue(new Error("x"));
    expect(renderToStaticMarkup(await Remboursements({ searchParams: Promise.resolve({}) }))).toContain("Impossible de charger les relevés. Réessayez.");
  });
});

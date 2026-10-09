import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Moderation from "./page";
const { verifier, charger, historique } = vi.hoisted(() => ({ verifier: vi.fn(), charger: vi.fn(), historique: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/moderation")>(), verifierAdministrateur: verifier, chargerSignalements: charger, chargerHistoriqueModeration: historique }));
vi.mock("@/components/SignalementsModeration", () => ({ default: () => <p>File ouverte</p> }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); charger.mockResolvedValue([]); historique.mockResolvedValue([]); });
describe("accès et historique US-18", () => {
  it("refuse un ambassadeur avant de charger des données privées", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({}) }))).toContain("Accès réservé");
    expect(charger).not.toHaveBeenCalled();
    expect(historique).not.toHaveBeenCalled();
  });
  it("affiche la date, l’action et l’article dans l’onglet Historique", async () => {
    historique.mockResolvedValue([{ id: "d1", date: "2026-10-09T10:00:00Z", action: "masquer", titre: "Polo bleu", articleId: "a1" }]);
    const html = renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "historique" }) }));
    expect(html).toContain("Polo bleu");
    expect(html).toContain("Masquer l’article");
    expect(html).toContain('dateTime="2026-10-09T10:00:00Z"');
    expect(charger).not.toHaveBeenCalled();
  });
  it("signale une erreur de chargement", async () => {
    charger.mockRejectedValue(new Error("réseau"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({}) }))).toContain("Impossible de charger la modération");
  });
});

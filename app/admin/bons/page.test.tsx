import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Bons from "./page";
const { admin, programmes, signaux, villes } = vi.hoisted(() => ({ admin: vi.fn(), programmes: vi.fn(), signaux: vi.fn(), villes: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: admin }));
vi.mock("@/lib/bons-admin", () => ({ listerProgrammes: programmes, lireSignaux: signaux }));
vi.mock("@/lib/villes-admin", () => ({ listerVilles: villes }));
vi.mock("@/components/ProgrammesBons", () => ({ default: ({ programmes, signaux }: { programmes: { id: string; nom_fr: string }[]; signaux: Record<string, unknown[]> }) => programmes.map(p => `${p.nom_fr}:${signaux[p.id].length}`).join(",") }));
vi.mock("@/components/NouvelleCampagne", () => ({ default: ({ villes }: { villes: { code: string }[] }) => `villes=${villes.map(v => v.code).join("|")}` }));
beforeEach(() => {
  vi.clearAllMocks(); admin.mockResolvedValue("u"); programmes.mockResolvedValue([{ id: "a", nom_fr: "Bienvenue" }, { id: "b", nom_fr: "Aïd 2026" }]);
  signaux.mockImplementation(async (_c: unknown, id: string) => { if (id === "a") throw new Error("x"); return [{}]; });
  villes.mockResolvedValue([{ code: "oran", nom: "Oran", ouverte: true }, { code: "tlemcen", nom: "Tlemcen", ouverte: false }]);
});
describe("US-33.5 : /admin/bons", () => {
  it("programmes, signaux (erreur = aucun), villes ouvertes seulement", async () => {
    const html = renderToStaticMarkup(await Bons());
    expect(html).toContain("Bienvenue:0,Aïd 2026:1"); expect(html).toContain("villes=oran");
  });
  it("refuse le non-admin avant toute lecture", async () => {
    admin.mockRejectedValue(new Error("Accès réservé")); expect(renderToStaticMarkup(await Bons())).toContain("Accès réservé"); expect(programmes).not.toHaveBeenCalled();
  });
  it("signale une lecture impossible", async () => {
    programmes.mockRejectedValue(new Error("x")); expect(renderToStaticMarkup(await Bons())).toContain("Impossible de charger les programmes. Réessayez.");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Villes from "./page";
const { role, villes, ambassadeurs } = vi.hoisted(() => ({ role: vi.fn(), villes: vi.fn(), ambassadeurs: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/boutique", () => ({ lireRoleAdministration: role }));
vi.mock("@/lib/villes-admin", () => ({ listerVillesAvecComptes: villes, listerAmbassadeurs: ambassadeurs }));
vi.mock("@/components/VillesAdministration", () => ({ default: ({ villes }: { villes: { nom: string }[] }) => villes.map(v => v.nom).join(",") }));
beforeEach(() => { vi.clearAllMocks(); role.mockResolvedValue("admin"); villes.mockResolvedValue([{ nom: "Oran" }, { nom: "Tlemcen" }]); ambassadeurs.mockResolvedValue([]); });
describe("US-29.4 : /admin/villes", () => {
  it("affiche les villes à l'admin", async () => { const html = renderToStaticMarkup(await Villes()); expect(html).toContain("Villes"); expect(html).toContain("Oran,Tlemcen"); });
  it("refuse l'ambassadeur avant toute lecture", async () => { role.mockResolvedValue("ambassadeur"); expect(renderToStaticMarkup(await Villes())).toContain("Accès réservé"); expect(villes).not.toHaveBeenCalled(); });
  it("refuse une session expirée", async () => { role.mockRejectedValue(new Error("Votre session a expiré. Reconnectez-vous.")); expect(renderToStaticMarkup(await Villes())).toContain("Votre session a expiré"); });
  it("signale une lecture impossible", async () => { villes.mockRejectedValue(new Error("Impossible de charger les villes. Réessayez.")); expect(renderToStaticMarkup(await Villes())).toContain("Impossible de charger les villes"); });
});

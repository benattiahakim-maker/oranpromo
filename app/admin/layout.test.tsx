import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Administration from "./layout";
const { getUser, maybeSingle } = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }) }));
vi.mock("next/navigation", () => ({ redirect: (chemin: string) => { throw new Error(`redirection:${chemin}`); } }));
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null }); });
describe("US-16 : accès administration côté serveur", () => {
  it("redirige une session absente", async () => { getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(Administration({ children: "Boutiques" })).rejects.toThrow("redirection:/espace/connexion"); });
  it("affiche Accès réservé à un commerçant et cache les enfants", async () => { maybeSingle.mockResolvedValue({ data: { role: "commercant" }, error: null }); const html = renderToStaticMarkup(await Administration({ children: "contenu privé" })); expect(html).toContain("Accès réservé"); expect(html).not.toContain("contenu privé"); });
  it.each(["admin", "ambassadeur"])("autorise le rôle %s", async role => { maybeSingle.mockResolvedValue({ data: { role }, error: null }); expect(renderToStaticMarkup(await Administration({ children: "Les boutiques" }))).toContain("Les boutiques"); });
});

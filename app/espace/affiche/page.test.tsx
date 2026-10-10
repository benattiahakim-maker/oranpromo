import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Affiche from "./page";
const { getUser, from, eqProfil, eqBoutique } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), eqProfil: vi.fn(), eqBoutique: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from }) }));
const { qrTextes } = vi.hoisted(() => ({ qrTextes: [] as string[] }));
vi.mock("@/lib/lien-boutique", async (original) => {
  const vrai = await original<typeof import("@/lib/lien-boutique")>();
  return { ...vrai, qrCodeSvg: async (texte: string) => { qrTextes.push(texte); return vrai.qrCodeSvg(texte); } };
});
vi.mock("next/navigation", () => ({ redirect: (chemin: string) => { throw new Error(`redirection:${chemin}`); } }));
const boutique = (statut: string) => ({ maybeSingle: async () => ({ data: { nom: "Boutique Nour", slug: "boutique-nour", statut }, error: null }) });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oranpromo.com");
  getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null });
  eqProfil.mockReturnValue({ maybeSingle: async () => ({ data: { boutique_id: "boutique" }, error: null }) }); eqBoutique.mockReturnValue(boutique("validee"));
  from.mockImplementation((table: string) => ({ select: () => ({ eq: table === "profils" ? eqProfil : eqBoutique }) }));
});
describe("US-22 : affiche à imprimer", () => {
  it("affiche le nom, le QR code et le lien de ma boutique", async () => {
    const html = renderToStaticMarkup(await Affiche());
    expect(eqProfil).toHaveBeenCalledWith("id", "compte"); expect(eqBoutique).toHaveBeenCalledWith("id", "boutique");
    expect(html).toContain("Boutique Nour"); expect(html).toContain("data:image/svg+xml"); expect(html).toContain("https://oranpromo.com/i/boutique-nour"); expect(html).toContain("Inscrivez-vous et suivez la boutique"); expect(qrTextes.at(-1)).toBe("https://oranpromo.com/i/boutique-nour"); expect(html).toContain("Scannez pour voir nos articles et nos promos"); expect(html).toContain("Imprimer"); expect(html).toContain("BleDeal · Oran");
  });
  it("protège la page même sans le proxy", async () => { getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(Affiche()).rejects.toThrow("redirection:/espace/connexion"); });
  it("pas d’affiche pour une boutique non validée", async () => { eqBoutique.mockReturnValue(boutique("suspendue")); const html = renderToStaticMarkup(await Affiche()); expect(html).toContain("dès que votre boutique sera validée"); expect(html).not.toContain("data:image/svg+xml"); });
  it("pas d’affiche sans boutique rattachée", async () => { eqProfil.mockReturnValue({ maybeSingle: async () => ({ data: { boutique_id: null }, error: null }) }); const html = renderToStaticMarkup(await Affiche()); expect(html).toContain("aucune boutique"); expect(eqBoutique).not.toHaveBeenCalled(); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const { maybeSingle, eq, ImageResponse } = vi.hoisted(() => ({ maybeSingle: vi.fn(), eq: vi.fn(), ImageResponse: vi.fn() }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(...args: unknown[]) { ImageResponse(...args); return new Response("png", { status: 200, headers: { "content-type": "image/png" } }); } } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ from: () => ({ select: () => { const requete = { eq: (...args: unknown[]) => { eq(...args); return requete; }, maybeSingle }; return requete; } }) }) }));
const appel = (slug: string) => GET(new Request(`https://oranpromo.com/b/${slug}/apercu`), { params: Promise.resolve({ slug }) });
beforeEach(() => { vi.clearAllMocks(); maybeSingle.mockResolvedValue({ data: { nom: "Boutique Nour", quartier: "Akid Lotfi" }, error: null }); });
describe("US-22 : image d’aperçu générée", () => {
  it("génère une image 1200 × 630 pour une boutique validée", async () => {
    const reponse = await appel("boutique-nour");
    expect(reponse.status).toBe(200); expect(eq).toHaveBeenCalledWith("slug", "boutique-nour"); expect(eq).toHaveBeenCalledWith("statut", "validee");
    expect(ImageResponse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1200, height: 630 }));
  });
  it("relecture n°6, point 8 : cache d’1 h au plus, navigateur et hébergeur (s-maxage=3600, avant 86400)", async () => {
    await appel("boutique-nour");
    expect(ImageResponse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }));
  });
  it("répond 404 pour une boutique non validée ou inconnue", async () => { maybeSingle.mockResolvedValue({ data: null, error: null }); expect((await appel("boutique-cachee")).status).toBe(404); expect(ImageResponse).not.toHaveBeenCalled(); });
  it("répond 404 sans lire la base pour un slug invalide", async () => { expect((await appel("Nour--x")).status).toBe(404); expect(eq).not.toHaveBeenCalled(); });
});

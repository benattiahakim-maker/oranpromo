// US-32.4 : bloc « ★ 4,6 · 18 avis · 2 sans réponse » dans /espace.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Espace from "./page";

const { rpc, maybeSingleProfil } = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingleProfil: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "compte" } }, error: null }) },
  from: (table: string) => ({ select: () => ({ eq: () => table === "profils" ? { maybeSingle: maybeSingleProfil } : table === "boutiques" ? { maybeSingle: async () => ({ data: null, error: null }) } : { order: async () => ({ data: [], error: null }) } }) }),
  rpc,
}) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/parrainage-admin", () => ({ lireRelevesBoutique: async () => [] }));
vi.mock("@/lib/abonnements", () => ({ lireAbonnesBoutique: async () => null, texteAbonnes: () => "" }));
beforeEach(() => { vi.clearAllMocks(); maybeSingleProfil.mockResolvedValue({ data: { boutique_id: "b1" }, error: null }); });
const props = { searchParams: Promise.resolve({}) };

describe("US-32.4 : avis dans le tableau de bord de l’espace", () => {
  it("affiche le résumé avec un lien vers /espace/avis", async () => {
    rpc.mockResolvedValue({ data: [{ nombre: 18, moyenne: 4.6, sans_reponse: 2 }], error: null });
    const html = renderToStaticMarkup(await Espace(props));
    expect(rpc).toHaveBeenCalledWith("resume_ma_boutique");
    expect(html).toContain('href="/espace/avis"');
    expect(html).toContain("★ 4,6 · 18 avis · 2 sans réponse");
  });
  it("lecture en échec : pas de bloc, le reste de l’espace s’affiche", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    const html = renderToStaticMarkup(await Espace(props));
    expect(html).not.toContain("/espace/avis");
    expect(html).toContain("Mes articles");
  });
  it("compte sans boutique : pas de lecture des avis", async () => {
    maybeSingleProfil.mockResolvedValue({ data: { boutique_id: null }, error: null });
    await Espace(props);
    expect(rpc).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
// US-35 : langue de la requête (cookie) : français dans ces tests.
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => "fr", getTextes: async () => textesDe("fr"), enLangue: async <T,>(r: T) => r }; });
import ModificationArticle from "./page";
const { getUser, from, eq, maybeSingle } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from }) }));
vi.mock("next/navigation", () => ({ redirect: (chemin: string) => { throw new Error(`redirection:${chemin}`); }, notFound: () => { throw new Error("introuvable"); }, useRouter: () => ({}) }));
const id = "a0000000-0000-0000-0000-000000000001";
beforeEach(() => {
  vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null });
  const requete = { eq, maybeSingle }; eq.mockReturnValue(requete);
  from.mockReturnValue({ select: () => requete });
  maybeSingle.mockResolvedValueOnce({ data: { boutique_id: "ma-boutique" }, error: null });
});
describe("US-11 : accès à la modification", () => {
  it("charge l’article seulement dans ma boutique", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id }, error: null }); const element = await ModificationArticle({ params: Promise.resolve({ id }) });
    expect(eq).toHaveBeenCalledWith("id", "compte"); expect(eq).toHaveBeenCalledWith("id", id); expect(eq).toHaveBeenCalledWith("boutique_id", "ma-boutique"); expect(element.props.article.id).toBe(id);
  });
  it("renvoie une page introuvable pour un article inaccessible", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null }); await expect(ModificationArticle({ params: Promise.resolve({ id }) })).rejects.toThrow("introuvable");
  });
  it("refuse un compte non connecté", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(ModificationArticle({ params: Promise.resolve({ id }) })).rejects.toThrow("redirection:/espace/connexion"); expect(from).not.toHaveBeenCalled();
  });
});

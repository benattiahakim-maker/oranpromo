import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AjouterArticle from "./page";

const { getUser, maybeSingle, eq } = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: (champ: string, id: string) => { eq(champ, id); return { maybeSingle }; } }) }) }) }));
vi.mock("next/navigation", () => ({ redirect: (chemin: string) => { throw new Error(`redirection:${chemin}`); } }));
beforeEach(() => { getUser.mockReset(); maybeSingle.mockReset(); eq.mockClear(); });

describe("US-10 : rattachement à la boutique", () => {
  it("affiche le message demandé pour un profil sans boutique", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "utilisateur" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { boutique_id: null }, error: null });
    expect(renderToStaticMarkup(await AjouterArticle())).toContain("Votre compte n&#x27;est rattaché à aucune boutique");
    expect(eq).toHaveBeenCalledWith("id", "utilisateur");
  });
  it("passe uniquement la boutique du profil connecté au formulaire", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "utilisateur" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { boutique_id: "boutique-profil" }, error: null });
    const element = await AjouterArticle();
    expect(element.props.boutiqueId).toBe("boutique-profil");
  });
  it("refuse une session absente", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(AjouterArticle()).rejects.toThrow("redirection:/espace/connexion");
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});

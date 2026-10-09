import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Espace from "./page";

const { getUser, signOut, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(), signOut: vi.fn(),
  redirect: vi.fn((chemin: string): never => { throw new Error(`redirection:${chemin}`); }),
}));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser, signOut } }) }));
vi.mock("next/navigation", () => ({ redirect }));
beforeEach(() => { getUser.mockReset(); signOut.mockReset(); redirect.mockClear(); });

describe("US-09 : espace provisoire", () => {
  it("vérifie la session sans afficher de liste d’articles", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "vendeur@example.com" } }, error: null });
    const element = await Espace({ searchParams: Promise.resolve({}) });
    // Ne pas exécuter le formulaire d’action serveur durant le rendu de contrôle.
    const enfants = element.props.children;
    const texte = renderToStaticMarkup(<>{enfants[0]}{enfants[1]}</>);
    expect(texte).toContain("Connecté : vendeur@example.com");
    expect(texte).not.toContain("article");
  });
  it("protège aussi la page directement, indépendamment du proxy", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(Espace({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirection:/espace/connexion");
  });
  it("ferme la session locale et renvoie au formulaire", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "vendeur@example.com" } }, error: null });
    signOut.mockResolvedValue({ error: null });
    const element = await Espace({ searchParams: Promise.resolve({}) });
    const formulaire = element.props.children[3];
    await expect(formulaire.props.action()).rejects.toThrow("redirection:/espace/connexion");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("signale une erreur de déconnexion sans annoncer un succès", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "vendeur@example.com" } }, error: null });
    signOut.mockResolvedValue({ error: { message: "Erreur réseau" } });
    const element = await Espace({ searchParams: Promise.resolve({}) });
    await expect(element.props.children[3].props.action()).rejects.toThrow("redirection:/espace?erreur=deconnexion");
  });
});

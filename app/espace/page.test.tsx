import { beforeEach, describe, expect, it, vi } from "vitest";
import Espace from "./page";
import { deconnecter } from "./actions";
const { getUser, signOut, redirect, from, eqProfil, eqArticles } = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn(), redirect: vi.fn((chemin: string): never => { throw new Error(`redirection:${chemin}`); }), from: vi.fn(), eqProfil: vi.fn(), eqArticles: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser, signOut }, from }) }));
vi.mock("next/navigation", () => ({ redirect }));
beforeEach(() => {
  vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "compte", email: "vendeur@example.com" } }, error: null });
  eqProfil.mockReturnValue({ maybeSingle: async () => ({ data: { boutique_id: "boutique" }, error: null }) }); eqArticles.mockReturnValue({ order: async () => ({ data: [], error: null }) });
  from.mockImplementation((table: string) => ({ select: () => ({ eq: table === "profils" ? eqProfil : eqArticles }) }));
});
const props = () => ({ searchParams: Promise.resolve({}) });
describe("US-11 : espace commerçant", () => {
  it("lit uniquement les articles de la boutique du profil connecté", async () => { await Espace(props()); expect(eqProfil).toHaveBeenCalledWith("id", "compte"); expect(eqArticles).toHaveBeenCalledWith("boutique_id", "boutique"); });
  it("protège aussi la page sans le proxy", async () => { getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(Espace(props())).rejects.toThrow("redirection:/espace/connexion"); });
  it("ferme la session locale", async () => { signOut.mockResolvedValue({ error: null }); await expect(deconnecter()).rejects.toThrow("redirection:/espace/connexion"); expect(signOut).toHaveBeenCalledWith({ scope: "local" }); });
  it("signale une erreur de déconnexion", async () => { signOut.mockResolvedValue({ error: { message: "Réseau" } }); await expect(deconnecter()).rejects.toThrow("redirection:/espace?erreur=deconnexion"); });
  it("ne lit aucun article si le compte n’a pas de boutique", async () => { eqProfil.mockReturnValue({ maybeSingle: async () => ({ data: { boutique_id: null }, error: null }) }); await Espace(props()); expect(eqArticles).not.toHaveBeenCalled(); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { set, redirect, ouvertes } = vi.hoisted(() => ({
  set: vi.fn(),
  redirect: vi.fn((chemin: string) => { throw new Error(`REDIRECT ${chemin}`); }),
  ouvertes: { liste: [{ code: "oran" }, { code: "tlemcen" }] as { code: string }[] },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/ville-serveur", () => ({ getVillesOuvertes: async () => ouvertes.liste }));
import { choisirVille } from "./actions";

const formulaire = (valeurs: Record<string, string>) => { const f = new FormData(); Object.entries(valeurs).forEach(([n, v]) => f.set(n, v)); return f; };
beforeEach(() => { vi.clearAllMocks(); ouvertes.liste = [{ code: "oran" }, { code: "tlemcen" }]; });

describe("US-29.2 : choisirVille (formulaire de /villes)", () => {
  it("garde la ville un an dans le cookie « ville » (comme la langue) et rouvre la même page dans la ville", async () => {
    await expect(choisirVille(formulaire({ ville: "tlemcen", retour: "/oran/catalogue?q=robe" }))).rejects.toThrow("REDIRECT /tlemcen/catalogue?q=robe");
    expect(set).toHaveBeenCalledWith("ville", "tlemcen", { path: "/", maxAge: 31536000, sameSite: "lax", secure: false });
  });
  it("sans page de retour : accueil de la ville", async () => {
    await expect(choisirVille(formulaire({ ville: "oran" }))).rejects.toThrow("REDIRECT /oran");
  });
  it("ville fermée, inconnue ou vide : aucun cookie, retour à /villes", async () => {
    for (const ville of ["alger", "", "catalogue"]) await expect(choisirVille(formulaire({ ville }))).rejects.toThrow("REDIRECT /villes");
    expect(set).not.toHaveBeenCalled();
  });
  it("retour vers un autre site refusé", async () => {
    await expect(choisirVille(formulaire({ ville: "oran", retour: "//evil.example/x" }))).rejects.toThrow("REDIRECT /oran");
  });
});

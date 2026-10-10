import { describe, expect, it, vi } from "vitest";

const { redirect, notFound } = vi.hoisted(() => ({
  redirect: vi.fn((chemin: string) => { throw new Error(`REDIRECT ${chemin}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/ville-serveur", async () => { const { VILLE_ORAN } = await import("@/lib/ville"); return { getVilleOuverte: async (code: string) => (code === "oran" ? VILLE_ORAN : null) }; });
import LayoutVille from "./layout";

const layout = (ville: string) => LayoutVille({ children: "contenu", params: Promise.resolve({ ville }) });

describe("US-29.2 : pages d'une ville", () => {
  it("ville ouverte : la page s'affiche", async () => {
    expect(await layout("oran")).toBe("contenu");
  });
  it("ville fermée ou inconnue : page de choix « pas encore sur BleDeal »", async () => {
    await expect(layout("tlemcen")).rejects.toThrow("REDIRECT /villes?inconnue=tlemcen");
    await expect(layout("contact")).rejects.toThrow("REDIRECT /villes?inconnue=contact");
  });
  it("adresse qui n'est pas un code de ville : page introuvable", async () => {
    for (const ville of ["Oran", "oran2", "x", "favicon"]) await expect(layout(ville)).rejects.toThrow("NOT_FOUND");
  });
});

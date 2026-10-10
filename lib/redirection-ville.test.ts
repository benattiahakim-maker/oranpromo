import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, ville } = vi.hoisted(() => ({
  redirect: vi.fn((chemin: string) => { throw new Error(`REDIRECT ${chemin}`); }),
  ville: { defaut: "oran" as string | null },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/ville-serveur", () => ({ getVilleParDefaut: async () => ville.defaut }));
import { chaineRecherche, redirigerVersVille } from "./redirection-ville";
import AccueilSansVille from "@/app/page";
import CatalogueSansVille from "@/app/catalogue/page";
import CarteSansVille from "@/app/carte/page";

beforeEach(() => { vi.clearAllMocks(); ville.defaut = "oran"; });

describe("US-29.2 : anciennes adresses /, /catalogue, /carte", () => {
  it("Oran seule ouverte (aujourd'hui) : même page à Oran, paramètres gardés", async () => {
    await expect(AccueilSansVille({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /oran");
    await expect(CatalogueSansVille({ searchParams: Promise.resolve({ promo: "1", q: "robe d'été" }) })).rejects.toThrow("REDIRECT /oran/catalogue?promo=1&q=robe+d%27%C3%A9t%C3%A9");
    await expect(CarteSansVille({ searchParams: Promise.resolve({ univers: "homme" }) })).rejects.toThrow("REDIRECT /oran/carte?univers=homme");
  });
  it("plusieurs villes ouvertes, aucun choix gardé : page de choix, avec la page à rouvrir", async () => {
    ville.defaut = null;
    await expect(redirigerVersVille("/catalogue", { promo: "1" })).rejects.toThrow("REDIRECT /villes?retour=%2Fcatalogue%3Fpromo%3D1");
    await expect(redirigerVersVille("", {})).rejects.toThrow("REDIRECT /villes?retour=%2F");
    await expect(redirigerVersVille("", { promo: "1" })).rejects.toThrow("REDIRECT /villes?retour=%2F%3Fpromo%3D1");
  });
  it("paramètres répétés gardés", () => {
    expect(chaineRecherche({ a: ["1", "2"], b: undefined })).toBe("?a=1&a=2");
    expect(chaineRecherche({})).toBe("");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NavigationEspace from "./NavigationEspace";
const { chemin } = vi.hoisted(() => ({ chemin: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: chemin }));
vi.mock("@/app/espace/actions", () => ({ deconnecter: vi.fn() }));
afterEach(cleanup);
describe("navigation de l’espace", () => {
  it("propose les trois pages et la déconnexion sur toutes les pages protégées", () => { chemin.mockReturnValue("/espace/articles/nouveau"); render(<NavigationEspace />); expect(screen.getByRole("link", { name: "Mes articles" }).getAttribute("href")).toBe("/espace"); expect(screen.getByRole("link", { name: "Ajouter" }).getAttribute("href")).toBe("/espace/articles/nouveau"); expect(screen.getByRole("link", { name: "Statistiques" }).getAttribute("href")).toBe("/espace/statistiques"); expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy(); });
  it("cache le menu sur la connexion", () => { chemin.mockReturnValue("/espace/connexion"); render(<NavigationEspace />); expect(screen.queryByRole("navigation")).toBeNull(); });
});

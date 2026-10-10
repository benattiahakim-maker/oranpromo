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
  it("affiche les commandes reçues avec le nombre à confirmer (US-20.3)", () => { chemin.mockReturnValue("/espace"); render(<NavigationEspace aConfirmer={2} />); expect(screen.getByRole("link", { name: "Commandes (2)" }).getAttribute("href")).toBe("/espace/commandes"); });
  it("US-32 : lien « Avis » vers /espace/avis, avec le nombre d’avis sans réponse", () => {
    chemin.mockReturnValue("/espace"); render(<NavigationEspace avisSansReponse={2} />);
    const lien = screen.getByRole("link", { name: "Avis, 2 sans réponse" });
    expect(lien.getAttribute("href")).toBe("/espace/avis"); expect(lien.textContent).toBe("Avis (2)");
  });
  it("US-32 : sans avis en attente, « Avis » sans nombre", () => {
    chemin.mockReturnValue("/espace"); render(<NavigationEspace />);
    expect(screen.getByRole("link", { name: "Avis" }).textContent).toBe("Avis");
  });
});

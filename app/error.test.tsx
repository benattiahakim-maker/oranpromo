import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Erreur from "./error";
import PageIntrouvable from "./not-found";
afterEach(cleanup);
it("réessaie sans afficher les détails de l’erreur", () => { const retry = vi.fn(); render(<Erreur error={new Error("détail interne")} retry={retry} />); expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeTruthy(); expect(screen.queryByText("détail interne")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Réessayer" })); expect(retry).toHaveBeenCalledOnce(); });
it("propose l’accueil et la recherche sur la page introuvable", () => { render(<PageIntrouvable />); expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy(); expect(screen.getByRole("link", { name: "BleDeal" }).getAttribute("href")).toBe("/"); expect(screen.getByRole("link", { name: "Rechercher" }).getAttribute("href")).toBe("/catalogue"); });

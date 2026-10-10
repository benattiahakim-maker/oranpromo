import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AccepterConditionsCommercant, { RESUME_CONDITIONS_COMMERCANTS } from "./AccepterConditionsCommercant";

const { accepter, refresh } = vi.hoisted(() => ({ accepter: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/conditions/actions", () => ({ accepterConditionsEspace: accepter }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const documents = [{ document: "conditions_commercants" as const, version: "2026-10-10" }, { document: "confidentialite" as const, version: "2026-10-10" }];

describe("US-34.3 : acceptation des conditions commerçants", () => {
  it("résumé en 5 points, liens, mention provisoire, case non cochée et « Accepter » inactif", () => {
    render(<AccepterConditionsCommercant documents={documents} />);
    expect(screen.getByRole("heading", { name: "Conditions commerçants" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(RESUME_CONDITIONS_COMMERCANTS[0]).toContain("BleDeal ne vend rien");
    expect(screen.getByRole("note")).toHaveTextContent("Version provisoire, en cours de relecture juridique.");
    expect(screen.getByRole("link", { name: "Lire les conditions commerçants" })).toHaveAttribute("href", "/conditions-commercants");
    expect(screen.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
    expect(screen.getByRole("checkbox", { name: "J’ai lu et j’accepte les conditions commerçants (version du 10/10/2026) et la politique de confidentialité." })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Accepter" })).toBeDisabled();
  });
  it("case cochée : envoie les versions affichées puis recharge l'espace", async () => {
    accepter.mockResolvedValue({ ok: true });
    render(<AccepterConditionsCommercant documents={documents} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(accepter).toHaveBeenCalledWith(documents);
  });
  it("version changée entre-temps : message, case décochée, page rechargée", async () => {
    accepter.mockResolvedValue({ erreur: "Les conditions ont changé : rechargez la page." });
    render(<AccepterConditionsCommercant documents={documents} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("rechargez la page");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(refresh).toHaveBeenCalled();
  });
});

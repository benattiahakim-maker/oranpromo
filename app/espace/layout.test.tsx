import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import EspaceLayout from "./layout";

const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
let aAccepter: { document: string; version: string }[] = [];
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { boutique_id: null } }) }) }) }) }) }));
vi.mock("@/components/NavigationEspace", () => ({ default: () => <nav>Navigation</nav> }));
vi.mock("@/components/AccepterConditionsCommercant", () => ({ default: ({ documents }: { documents: { document: string }[] }) => <p>Demande d’accord : {documents.map(d => d.document).join(", ")}</p> }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); aAccepter = [];
  getUser.mockResolvedValue({ data: { user: { id: "m1" } } });
  rpc.mockImplementation(async () => ({ data: aAccepter, error: null }));
});

describe("US-34.3 : espace fermé tant que les conditions ne sont pas acceptées", () => {
  it("conditions à accepter : la demande remplace la page, la navigation (déconnexion) reste", async () => {
    aAccepter = [{ document: "conditions_commercants", version: "2026-10-10" }];
    render(await EspaceLayout({ children: <p>Mes articles</p> }));
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Demande d’accord : conditions_commercants")).toBeInTheDocument();
    expect(screen.queryByText("Mes articles")).toBeNull();
  });
  it("rien à accepter, visiteur ou lecture impossible : la page s'affiche", async () => {
    render(await EspaceLayout({ children: <p>Mes articles</p> }));
    expect(screen.getByText("Mes articles")).toBeInTheDocument();
    cleanup();
    getUser.mockResolvedValue({ data: { user: null } });
    render(await EspaceLayout({ children: <p>Connexion</p> }));
    expect(screen.getByText("Connexion")).toBeInTheDocument();
    cleanup();
    getUser.mockResolvedValue({ data: { user: { id: "m1" } } });
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(await EspaceLayout({ children: <p>Mes articles</p> }));
    expect(screen.getByText("Mes articles")).toBeInTheDocument();
  });
});

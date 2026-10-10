// US-32 : compteur d'avis sans réponse dans la navigation de l'espace.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import EspaceLayout from "./layout";

const { rpc, boutique, aConfirmer } = vi.hoisted(() => ({ rpc: vi.fn(), boutique: { id: "b1" as string | null }, aConfirmer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "m1" } } }) }, rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { boutique_id: boutique.id } }) }) }) }) }) }));
vi.mock("@/lib/commandes", () => ({ compterCommandesAConfirmer: aConfirmer }));
vi.mock("@/lib/acceptations", () => ({ lireDocumentsAAccepter: async () => [] }));
vi.mock("@/components/NavigationEspace", () => ({ default: ({ aConfirmer: n, avisSansReponse }: { aConfirmer: number; avisSansReponse: number }) => <nav>commandes {n} · avis {avisSansReponse}</nav> }));
vi.mock("@/components/AccepterConditionsCommercant", () => ({ default: () => null }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); boutique.id = "b1"; aConfirmer.mockResolvedValue(3); rpc.mockResolvedValue({ data: [{ nombre: 18, moyenne: 4.6, sans_reponse: 2 }], error: null }); });

describe("US-32 : avis sans réponse dans la navigation", () => {
  it("lit le nombre avec resume_ma_boutique et le passe à la navigation", async () => {
    render(await EspaceLayout({ children: <p>Page</p> }));
    expect(screen.getByText("commandes 3 · avis 2")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("resume_ma_boutique");
  });
  it("lecture des avis en échec : 0, les commandes à confirmer restent", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    render(await EspaceLayout({ children: <p>Page</p> }));
    expect(screen.getByText("commandes 3 · avis 0")).toBeTruthy();
  });
  it("compte sans boutique (admin) : aucune lecture, 0", async () => {
    boutique.id = null;
    render(await EspaceLayout({ children: <p>Page</p> }));
    expect(screen.getByText("commandes 0 · avis 0")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});

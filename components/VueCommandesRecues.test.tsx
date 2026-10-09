import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import VueCommandesRecues from "./VueCommandesRecues";
import type { CommandeRecue } from "@/lib/commandes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/form", () => ({ default: ({ children }: { children: React.ReactNode }) => <form>{children}</form> }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique: vi.fn(), changerStatutCommandesBoutique: vi.fn(), declarerClientPasVenu: vi.fn() }));
afterEach(cleanup);

const commande = { id: "c1", numero: 118, client_id: "k", boutique_id: "b", statut: "confirmee", client_nom: "Nadia", client_telephone: "+213555123456", note: null, motif_annulation: null, total: 2900, cree_le: "2026-10-09T10:00:00Z", confirmee_le: "2026-10-09T11:00:00Z", prete_le: null, expire_le: null, terminee_le: null, no_show_le: null, no_show_annule_le: null, contestee_le: null, contestation_validee_le: null, telephone_verifie: true, langue: "fr", mode_remise: null, bon_id: null, remise_bon: 0, lignes_commande: [] } as unknown as CommandeRecue;
const base = { boutiqueId: "b", boutique: "B", maintenant: Date.parse("2026-10-09T13:05:00Z"), recherche: false, texteRecherche: "", compteurs: { a_confirmer: 0, a_preparer: 1, pretes: 0, terminees: 0 }, erreur: false };

describe("US-28.3 : accès à la liste de préparation", () => {
  it("bouton sur « À préparer » quand il y a des commandes", () => {
    render(<VueCommandesRecues {...base} etape="a_preparer" commandes={[commande]} />);
    expect(screen.getByRole("link", { name: /Liste de préparation \(1 commande\)/ })).toHaveAttribute("href", "/espace/commandes/preparation");
  });
  it("pas de bouton sur les autres étapes ni quand « À préparer » est vide", () => {
    render(<VueCommandesRecues {...base} etape="a_confirmer" commandes={[]} />);
    expect(screen.queryByRole("link", { name: /Liste de préparation/ })).toBeNull();
    cleanup();
    render(<VueCommandesRecues {...base} etape="a_preparer" commandes={[]} />);
    expect(screen.queryByRole("link", { name: /Liste de préparation/ })).toBeNull();
  });
});

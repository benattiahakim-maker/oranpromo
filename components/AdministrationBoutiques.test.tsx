// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoutiquesAdministration from "./BoutiquesAdministration";
import NouvelleBoutique from "./NouvelleBoutique";
import type { Tables } from "@/lib/supabase/types";
const { ajouterBoutique, modifierStatutBoutique, rattacherCompteBoutique, refresh } = vi.hoisted(() => ({ ajouterBoutique: vi.fn(), modifierStatutBoutique: vi.fn(), rattacherCompteBoutique: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/boutiques/actions", () => ({ ajouterBoutique, modifierStatutBoutique, rattacherCompteBoutique }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const boutique: Tables<"boutiques"> = { id: "boutique", nom: "Étoile", quartier: "Akid Lotfi", statut: "en_attente", slug: "etoile", adresse: "Oran", whatsapp: "+213555123456", latitude: null, longitude: null, horaires: null, instagram: null, facebook: null, cree_le: "2026-10-09T00:00:00Z", bons_acceptes: true, ville: "oran" };
beforeEach(() => { vi.clearAllMocks(); modifierStatutBoutique.mockResolvedValue({ succes: true, message: "Statut enregistré." }); rattacherCompteBoutique.mockResolvedValue({ succes: true, message: "Compte rattaché." }); });
afterEach(cleanup);
describe("US-16 : interface boutiques", () => {
  it("cache les actions administrateur pour l’ambassadeur", () => { render(<BoutiquesAdministration boutiques={[boutique]} role="ambassadeur" />); expect(screen.getByText("En attente")).toBeInTheDocument(); expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull(); });
  it("permet de valider, suspendre et réactiver", async () => {
    render(<BoutiquesAdministration boutiques={[boutique]} role="admin" />);
    fireEvent.click(screen.getByRole("button", { name: "Valider" })); await screen.findByRole("button", { name: "Suspendre" }); expect(modifierStatutBoutique).toHaveBeenCalledWith("boutique", "validee");
    fireEvent.click(screen.getByRole("button", { name: "Suspendre" })); await screen.findByRole("button", { name: "Réactiver" }); expect(modifierStatutBoutique).toHaveBeenCalledWith("boutique", "suspendue");
    fireEvent.click(screen.getByRole("button", { name: "Réactiver" })); await screen.findByRole("button", { name: "Suspendre" });
  });
  it("rattache le compte et affiche une erreur française de la RPC", async () => {
    rattacherCompteBoutique.mockResolvedValue({ succes: false, message: "Le commerçant doit d’abord se connecter une fois." }); render(<BoutiquesAdministration boutiques={[boutique]} role="admin" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "vendeur@example.com" } }); fireEvent.click(screen.getByRole("button", { name: "Rattacher" })); await waitFor(() => expect(rattacherCompteBoutique).toHaveBeenCalledWith("boutique", "vendeur@example.com")); expect(await screen.findByRole("alert")).toHaveTextContent("se connecter une fois");
  });
  it("nom : champ limité à 80 caractères, message clair au-delà", () => {
    render(<NouvelleBoutique />); const champ = screen.getAllByRole("textbox")[0]; expect(champ).toHaveAttribute("name", "nom"); expect(champ).toHaveAttribute("maxLength", "80");
    fireEvent.change(champ, { target: { value: "A".repeat(81) } }); fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" }));
    expect(screen.getByText("Le nom de la boutique doit contenir entre 2 et 80 caractères.")).toBeInTheDocument(); expect(ajouterBoutique).not.toHaveBeenCalled();
  });
  it("affiche la validation sous chaque champ obligatoire", () => { render(<NouvelleBoutique />); fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" })); expect(screen.getAllByRole("alert")).toHaveLength(4); expect(ajouterBoutique).not.toHaveBeenCalled(); });
});

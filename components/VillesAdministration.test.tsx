// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VillesAdministration from "./VillesAdministration";
import { ZONE_ORAN } from "@/lib/position";
import type { VilleAvecCompte } from "@/lib/villes-admin";
const { ouvrirVille, definirVilleAmbassadeur, refresh } = vi.hoisted(() => ({ ouvrirVille: vi.fn(), definirVilleAmbassadeur: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/villes/actions", () => ({ ouvrirVille, definirVilleAmbassadeur }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const villes: VilleAvecCompte[] = [
  { ...ZONE_ORAN, code: "oran", nom_ar: "وهران", numero_wilaya: 31, ouverte: true, ordre: 1, validees: 12, enAttente: 2 },
  { nom: "Tlemcen", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167, code: "tlemcen", nom_ar: "تلمسان", numero_wilaya: 13, ouverte: false, ordre: 4, validees: 3, enAttente: 1 },
];
beforeEach(() => { vi.clearAllMocks(); ouvrirVille.mockResolvedValue({ succes: true, message: "Ville ouverte." }); definirVilleAmbassadeur.mockResolvedValue({ succes: true, message: "Ville de l’ambassadeur enregistrée." }); });
afterEach(cleanup);
describe("US-29.4 : liste des villes", () => {
  it("affiche chaque ville (FR + AR, wilaya, comptes) et son état", () => {
    render(<VillesAdministration villes={villes} ambassadeurs={[]} />);
    expect(screen.getByText("Wilaya 31 · 12 validées · 2 en attente")).toBeInTheDocument(); expect(screen.getByText("تلمسان")).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("button", { name: "Oran : ouverte, fermer" })).toHaveTextContent("Ouverte");
    expect(screen.getByRole("button", { name: "Tlemcen : fermée, ouvrir" })).toHaveTextContent("Fermée");
    expect(screen.getByText("Aucun ambassadeur pour l’instant.")).toBeInTheDocument();
  });
  it("ouvre en deux temps : rien n'est envoyé avant « Ouvrir », « Annuler » referme", async () => {
    render(<VillesAdministration villes={villes} ambassadeurs={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tlemcen : fermée, ouvrir" }));
    expect(screen.getByText("Ouvrir Tlemcen ?")).toBeInTheDocument(); expect(screen.getByText(/Ses boutiques validées apparaîtront dans le choix des villes/)).toBeInTheDocument(); expect(ouvrirVille).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" })); expect(screen.queryByText("Ouvrir Tlemcen ?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tlemcen : fermée, ouvrir" })); fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    await waitFor(() => expect(ouvrirVille).toHaveBeenCalledWith("tlemcen", true)); expect(await screen.findByRole("status")).toHaveTextContent("Ville ouverte."); expect(refresh).toHaveBeenCalled();
  });
  it("ferme Oran seulement après confirmation et affiche l'erreur du serveur", async () => {
    ouvrirVille.mockResolvedValue({ succes: false, message: "Action réservée aux administrateurs." });
    render(<VillesAdministration villes={villes} ambassadeurs={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Oran : ouverte, fermer" })); expect(screen.getByText("Fermer Oran ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(ouvrirVille).toHaveBeenCalledWith("oran", false)); expect(await screen.findByRole("alert")).toHaveTextContent("Action réservée aux administrateurs.");
  });
  it("donne une ville à un ambassadeur (vide = toutes les villes)", async () => {
    render(<VillesAdministration villes={villes} ambassadeurs={[{ id: "a", nom: "Karim", telephone: null, ville: null }, { id: "b", nom: null, telephone: "+213555000000", ville: "oran" }]} />);
    const enregistrer = screen.getAllByRole("button", { name: "Enregistrer" }); expect(enregistrer[0]).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Ville de Karim" }), { target: { value: "tlemcen" } }); fireEvent.click(enregistrer[0]);
    await waitFor(() => expect(definirVilleAmbassadeur).toHaveBeenCalledWith("a", "tlemcen"));
    fireEvent.change(screen.getByRole("combobox", { name: "Ville de +213555000000" }), { target: { value: "" } }); fireEvent.click(screen.getAllByRole("button", { name: "Enregistrer" })[1]);
    await waitFor(() => expect(definirVilleAmbassadeur).toHaveBeenCalledWith("b", null));
  });
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoutiquesAdministration from "./BoutiquesAdministration";
import NouvelleBoutique from "./NouvelleBoutique";
import type { Tables } from "@/lib/supabase/types";
import { ZONE_ORAN } from "@/lib/position";
import type { VilleAdmin } from "@/lib/villes-admin";
import { villeInitiale } from "./NouvelleBoutique";
const { ajouterBoutique, modifierStatutBoutique, rattacherCompteBoutique, refresh } = vi.hoisted(() => ({ ajouterBoutique: vi.fn(), modifierStatutBoutique: vi.fn(), rattacherCompteBoutique: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/boutiques/actions", () => ({ ajouterBoutique, modifierStatutBoutique, rattacherCompteBoutique }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const boutique: Tables<"boutiques"> = { id: "boutique", nom: "Étoile", quartier: "Akid Lotfi", statut: "en_attente", slug: "etoile", adresse: "Oran", whatsapp: "+213555123456", latitude: null, longitude: null, horaires: null, instagram: null, facebook: null, cree_le: "2026-10-09T00:00:00Z", bons_acceptes: true, ville: "oran" };
beforeEach(() => { vi.clearAllMocks(); modifierStatutBoutique.mockResolvedValue({ succes: true, message: "Statut enregistré." }); rattacherCompteBoutique.mockResolvedValue({ succes: true, message: "Compte rattaché." }); });
afterEach(cleanup);
const villes: VilleAdmin[] = [
  { ...ZONE_ORAN, code: "oran", nom_ar: "وهران", numero_wilaya: 31, ouverte: true, ordre: 1 },
  { nom: "Tlemcen", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167, code: "tlemcen", nom_ar: "تلمسان", numero_wilaya: 13, ouverte: false, ordre: 4 },
];
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
    render(<NouvelleBoutique villes={villes} />); const champ = screen.getAllByRole("textbox")[0]; expect(champ).toHaveAttribute("name", "nom"); expect(champ).toHaveAttribute("maxLength", "80");
    fireEvent.change(champ, { target: { value: "A".repeat(81) } }); fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" }));
    expect(screen.getByText("Le nom de la boutique doit contenir entre 2 et 80 caractères.")).toBeInTheDocument(); expect(ajouterBoutique).not.toHaveBeenCalled();
  });
  it("affiche la validation sous chaque champ obligatoire", () => { render(<NouvelleBoutique villes={villes} />); fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" })); expect(screen.getAllByRole("alert")).toHaveLength(4); expect(ajouterBoutique).not.toHaveBeenCalled(); });
});
describe("US-29.4 : ville de la boutique", () => {
  it("présélectionne la seule ville ouverte (Oran aujourd'hui), sinon aucune ; l'ambassadeur garde la sienne", () => {
    expect(villeInitiale(villes, null)).toBe("oran"); expect(villeInitiale(villes.map(v => ({ ...v, ouverte: true })), null)).toBe(""); expect(villeInitiale(villes, "tlemcen")).toBe("tlemcen");
  });
  it("affiche le choix des villes (fermées signalées) avec Oran choisie, et exige une ville quand plusieurs sont ouvertes", () => {
    render(<NouvelleBoutique villes={villes} />); const choix = screen.getByRole("combobox", { name: /Ville \(wilaya\)/ });
    expect(choix).toHaveValue("oran"); expect(screen.getByRole("option", { name: "Tlemcen (fermée)" })).toBeInTheDocument(); cleanup();
    render(<NouvelleBoutique villes={villes.map(v => ({ ...v, ouverte: true }))} />); fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" }));
    expect(screen.getByText("Choisissez la ville (wilaya) de la boutique.")).toBeInTheDocument(); expect(ajouterBoutique).not.toHaveBeenCalled();
  });
  it("verrouille la ville de l'ambassadeur et l'envoie avec la saisie", async () => {
    ajouterBoutique.mockResolvedValue({ succes: true, message: "Boutique créée, en attente de validation." });
    render(<NouvelleBoutique villes={villes} villeImposee="tlemcen" />); const choix = screen.getByRole("combobox", { name: /Ville \(wilaya\)/ });
    expect(choix).toBeDisabled(); expect(choix).toHaveValue("tlemcen");
    const [nom, quartier, adresse] = screen.getAllByRole("textbox");
    fireEvent.change(nom, { target: { value: "Boutique Kiffane" } }); fireEvent.change(quartier, { target: { value: "Kiffane" } }); fireEvent.change(adresse, { target: { value: "3 rue de la Paix" } });
    fireEvent.change(screen.getByRole("textbox", { name: /WhatsApp/ }), { target: { value: "0555 12 34 56" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la boutique" }));
    await waitFor(() => expect(ajouterBoutique).toHaveBeenCalledWith(expect.objectContaining({ ville: "tlemcen", nom: "Boutique Kiffane" })));
  });
  it("affiche la ville de chaque boutique et laisse l'admin la changer", () => {
    render(<BoutiquesAdministration boutiques={[boutique]} role="admin" villes={villes} />);
    expect(screen.getByText("Akid Lotfi · Oran")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Changer de ville" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Ville de Étoile" }), { target: { value: "tlemcen" } });
    expect(screen.getByRole("button", { name: "Changer de ville" })).toBeEnabled(); cleanup();
    render(<BoutiquesAdministration boutiques={[boutique]} role="ambassadeur" villes={villes} />); expect(screen.queryByRole("combobox")).toBeNull();
  });
});

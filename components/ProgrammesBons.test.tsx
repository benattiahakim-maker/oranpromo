// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProgrammesBons from "./ProgrammesBons";
import NouvelleCampagne from "./NouvelleCampagne";
import type { ProgrammeAdmin, SignalBoutique } from "@/lib/bons-admin";
const { arreterProgrammeAdmin, creerCampagneAdmin, refresh } = vi.hoisted(() => ({ arreterProgrammeAdmin: vi.fn(), creerCampagneAdmin: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/bons/actions", () => ({ arreterProgrammeAdmin, creerCampagneAdmin }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const prog: ProgrammeAdmin = { id: "p1", type: "campagne", nom_fr: "Aïd 2026", nom_ar: "عيد 2026", code: "AID26", montant: 500, minimum_achat: 4000, univers: null, villes: [],
  debut: "2026-05-24T23:00:00Z", fin: "2026-06-05T23:00:00Z", validite_jours: 10, budget: 200000, plafond_par_boutique: 30, actif: true, ouvert: true, emis: 412, utilises: 233, rembourse: 116500, restant: 93500 };
const signal: SignalBoutique = { boutique_id: "b", boutique: "Boutique Nour", slug: "boutique-nour", servis: 30, prix: 0, prix_le: null, nouveaux: 0, plafond: 30, plafond_jours: 2, comptes_recents: 0, remises_rapides: 0 };
beforeEach(() => { vi.clearAllMocks(); arreterProgrammeAdmin.mockResolvedValue({ succes: true, message: "Arrêté." }); creerCampagneAdmin.mockResolvedValue({ succes: true, message: "Campagne Aïd 2026 créée (code AID26)." }); });
afterEach(cleanup);
describe("US-33.5 : programmes", () => {
  it("chiffres, état, conditions, signaux et lien vers les remboursements", () => {
    render(<ProgrammesBons programmes={[prog, { ...prog, id: "p2", type: "bienvenue", nom_fr: "Bon de bienvenue", code: null, actif: false }]} signaux={{ p1: [signal] }} maintenant="2026-05-30T10:00:00Z" />);
    expect(screen.getByText("Aïd 2026 · AID26")).toBeInTheDocument(); expect(screen.getByText("Active")).toBeInTheDocument(); expect(screen.getByText("Arrêtée")).toBeInTheDocument();
    expect(screen.getAllByText("412 émis · 233 utilisés · 116 500 DA remboursés · reste 93 500 DA")).toHaveLength(2);
    expect(screen.getByText("Boutique Nour : 30 / 30 bons en 2 jours.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "remboursements" })).toHaveAttribute("href", "/admin/remboursements");
    expect(screen.getAllByRole("button", { name: "Arrêter" })).toHaveLength(1);
  });
  it("arrête en deux temps", async () => {
    render(<ProgrammesBons programmes={[prog]} signaux={{}} maintenant="2026-05-30T10:00:00Z" />);
    expect(screen.getByText("Aucun signal.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Arrêter" })); expect(arreterProgrammeAdmin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" })); expect(screen.queryByText(/Plus aucun nouveau bon/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Arrêter" })); expect(screen.getByText(/Arrêter « Aïd 2026 » \?/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Arrêter" })[0]);
    await waitFor(() => expect(arreterProgrammeAdmin).toHaveBeenCalledWith("p1")); expect(await screen.findByRole("status")).toHaveTextContent("Arrêté."); expect(refresh).toHaveBeenCalled();
  });
  it("aucun programme", () => { render(<ProgrammesBons programmes={[]} signaux={{}} maintenant="2026-05-30T10:00:00Z" />); expect(screen.getByText("Aucun programme.")).toBeInTheDocument(); });
});
describe("US-33.5 : nouvelle campagne", () => {
  it("valeurs par défaut 500 DA / plafond 30, envoie la saisie, vide après succès", async () => {
    render(<NouvelleCampagne villes={[{ code: "oran", nom: "Oran" }]} />);
    expect(screen.getByLabelText("Montant (DA)")).toHaveValue("500"); expect(screen.getByLabelText("Plafond par boutique (bons)")).toHaveValue("30");
    fireEvent.change(screen.getByLabelText("Nom (français)"), { target: { value: "Aïd 2026" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "aid26" } }); expect(screen.getByLabelText("Code")).toHaveValue("AID26");
    fireEvent.click(screen.getByRole("checkbox", { name: "Oran" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer la campagne" }));
    await waitFor(() => expect(creerCampagneAdmin).toHaveBeenCalledWith(expect.objectContaining({ nom_fr: "Aïd 2026", code: "AID26", villes: ["oran"], montant: "500", plafond: "30" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Campagne Aïd 2026 créée (code AID26)."); expect(screen.getByLabelText("Nom (français)")).toHaveValue(""); expect(refresh).toHaveBeenCalled();
  });
  it("erreur affichée, saisie gardée", async () => {
    creerCampagneAdmin.mockResolvedValue({ succes: false, message: "Ce code existe déjà." });
    render(<NouvelleCampagne villes={[]} />);
    fireEvent.change(screen.getByLabelText("Nom (français)"), { target: { value: "Aïd" } }); fireEvent.click(screen.getByRole("button", { name: "Créer la campagne" }));
    expect((await screen.findAllByText("Ce code existe déjà.")).length).toBe(1); expect(screen.getByLabelText("Nom (français)")).toHaveValue("Aïd"); expect(refresh).not.toHaveBeenCalled();
  });
});

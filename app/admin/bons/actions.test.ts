import { beforeEach, describe, expect, it, vi } from "vitest";
import { arreterProgrammeAdmin, creerCampagneAdmin } from "./actions";
const { admin, creer, arreter, villes } = vi.hoisted(() => ({ admin: vi.fn(), creer: vi.fn(), arreter: vi.fn(), villes: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: admin }));
vi.mock("@/lib/villes-admin", () => ({ listerVilles: villes }));
vi.mock("@/lib/bons-admin", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/bons-admin")>()), creerCampagne: creer, arreterProgramme: arreter }));
const UUID = "8f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const saisie = { nom_fr: "Aïd 2026", nom_ar: "عيد 2026", code: "aid26", montant: "500", minimum: "4000", univers: "", villes: ["oran"], debut: "2026-05-25", fin: "2026-06-05", validite: "10", budget: "200000", plafond: "30" };
beforeEach(() => { vi.clearAllMocks(); admin.mockResolvedValue("u"); creer.mockResolvedValue("id"); arreter.mockResolvedValue(true); villes.mockResolvedValue([{ code: "oran" }]); });
describe("US-33.5 : actions /admin/bons", () => {
  it("crée la campagne (code en majuscules)", async () => {
    expect(await creerCampagneAdmin(saisie)).toEqual({ succes: true, message: "Campagne Aïd 2026 créée (code AID26)." });
    expect(creer).toHaveBeenCalledWith({}, expect.objectContaining({ code: "AID26", montant: 500, plafond_par_boutique: 30, villes: ["oran"] }));
  });
  it("saisie fausse : message, rien d'envoyé", async () => {
    expect(await creerCampagneAdmin({ ...saisie, villes: ["paris"] })).toEqual({ succes: false, message: "Ville inconnue." }); expect(creer).not.toHaveBeenCalled();
    expect((await creerCampagneAdmin(null as never)).succes).toBe(false); expect(creer).not.toHaveBeenCalled();
  });
  it("non admin : refusé avant toute écriture", async () => {
    admin.mockRejectedValue(new Error("Accès réservé"));
    expect(await creerCampagneAdmin(saisie)).toEqual({ succes: false, message: "Accès réservé" }); expect(creer).not.toHaveBeenCalled();
    expect(await arreterProgrammeAdmin(UUID)).toEqual({ succes: false, message: "Accès réservé" }); expect(arreter).not.toHaveBeenCalled();
  });
  it("erreur de la base affichée", async () => {
    creer.mockRejectedValue(new Error("Ce code existe déjà.")); expect(await creerCampagneAdmin(saisie)).toEqual({ succes: false, message: "Ce code existe déjà." });
  });
  it("arrête : identifiant vérifié, déjà arrêté", async () => {
    expect(await arreterProgrammeAdmin("x")).toEqual({ succes: false, message: "Programme invalide." }); expect(arreter).not.toHaveBeenCalled();
    expect((await arreterProgrammeAdmin(UUID)).message).toBe("Arrêté : plus aucun nouveau bon. Les bons déjà donnés restent valables jusqu’à leur échéance.");
    arreter.mockResolvedValue(false); expect(await arreterProgrammeAdmin(UUID)).toEqual({ succes: false, message: "Ce programme est déjà arrêté." });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { creerBoutique, messageErreurPosition, modifierPositionBoutiqueAdmin, modifierPositionMaBoutique, validerBoutique } from "./boutique";
import { MESSAGE_HORS_ORAN, MESSAGE_POSITION_INCOMPLETE, MESSAGE_POSITION_PUBLIEE, ZONE_ORAN } from "./position";

const saisie = { nom: "Boutique Étoile", quartier: "Akid Lotfi", adresse: "12 rue des Oliviers", latitude: "", longitude: "", horaires: "", whatsapp: "0555 12 34 56", instagram: "", facebook: "", ville: "oran" };

// Faux client Supabase : profil (rôle, boutique), boutique (statut) et mise à jour de la position.
function simulation({ role = "admin", boutiqueId = "boutique" as string | null, statut = "en_attente", resultat = { data: { id: "boutique" } as unknown, error: null as unknown } } = {}) {
  const updateEq = vi.fn(), update = vi.fn(), insert = vi.fn();
  const fin = { select: () => ({ maybeSingle: async () => resultat, single: async () => resultat }) };
  updateEq.mockReturnValue(fin); update.mockReturnValue({ eq: updateEq }); insert.mockReturnValue(fin);
  const lectureProfil = { eq: () => ({ maybeSingle: async () => ({ data: { role, boutique_id: boutiqueId }, error: null }) }) };
  // US-29.4 : la ville choisie (Oran) et ses bornes, lues avant la création.
  const lectureVille = { eq: () => ({ maybeSingle: async () => ({ data: ZONE_ORAN, error: null }) }) };
  const lectureBoutique = vi.fn(() => ({ eq: () => ({ maybeSingle: async () => ({ data: { statut }, error: null }) }) }));
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "compte" } }, error: null }) },
    from: vi.fn((table: string) => table === "profils" ? { select: () => lectureProfil } : table === "villes" ? { select: () => lectureVille } : { select: lectureBoutique, update, insert }),
  } as unknown as SupabaseClient<Database>;
  return { client, update, updateEq, insert };
}

describe("US-24.2 : validation du formulaire de création", () => {
  it("position dans Oran acceptée, hors d'Oran refusée avec le message de la base", () => {
    expect(validerBoutique({ ...saisie, latitude: "35,697120", longitude: "−0,633750" })).toEqual({});
    expect(validerBoutique({ ...saisie, latitude: "36.7538", longitude: "3.0588" })).toEqual({ latitude: MESSAGE_HORS_ORAN });
    expect(validerBoutique({ ...saisie, latitude: "35°41", longitude: "-0.6" }).latitude).toContain("degrés décimaux");
  });
  it("création : coordonnées arrondies à 6 décimales ; refus de la base sur la position traduit en message du champ", async () => {
    const test = simulation({ role: "ambassadeur" });
    await creerBoutique(test.client, { ...saisie, latitude: "35.69712345", longitude: "-0.63375" });
    expect(test.insert).toHaveBeenCalledWith(expect.objectContaining({ latitude: 35.697123, longitude: -0.63375 }));
    const refus = simulation({ role: "admin", resultat: { data: null, error: { code: "23514", message: "La position doit être dans la wilaya d'Oran." } } });
    await expect(creerBoutique(refus.client, { ...saisie, latitude: "35.7", longitude: "-0.6" })).rejects.toMatchObject({ champs: { latitude: MESSAGE_HORS_ORAN } });
  });
});

describe("US-24.2 : position enregistrée par l'admin", () => {
  it("enregistre deux nombres arrondis sur la boutique choisie", async () => {
    const test = simulation();
    await modifierPositionBoutiqueAdmin(test.client, "boutique", 35.6971234, -0.6337549);
    expect(test.update).toHaveBeenCalledWith({ latitude: 35.697123, longitude: -0.633755 });
    expect(test.updateEq).toHaveBeenCalledWith("id", "boutique");
  });
  it("retire la position avec deux null", async () => {
    const test = simulation();
    await modifierPositionBoutiqueAdmin(test.client, "boutique", null, null);
    expect(test.update).toHaveBeenCalledWith({ latitude: null, longitude: null });
  });
  it("refuse avant la base : une seule coordonnée, hors d'Oran, texte au lieu d'un nombre", async () => {
    const test = simulation();
    await expect(modifierPositionBoutiqueAdmin(test.client, "boutique", 35.7, null)).rejects.toThrow(MESSAGE_POSITION_INCOMPLETE);
    await expect(modifierPositionBoutiqueAdmin(test.client, "boutique", 36.75, 3.05)).rejects.toThrow(MESSAGE_HORS_ORAN);
    await expect(modifierPositionBoutiqueAdmin(test.client, "boutique", "https://maps.app.goo.gl/x", "y")).rejects.toThrow(MESSAGE_HORS_ORAN);
    expect(test.update).not.toHaveBeenCalled();
  });
  it("réservé à l'admin (ambassadeur et commerçant refusés)", async () => {
    for (const role of ["ambassadeur", "commercant"]) {
      const test = simulation({ role });
      await expect(modifierPositionBoutiqueAdmin(test.client, "boutique", 35.7, -0.6)).rejects.toThrow();
      expect(test.update).not.toHaveBeenCalled();
    }
  });
  it("refus de la base traduit en message", async () => {
    const test = simulation({ resultat: { data: null, error: { code: "23514", message: "La position doit être dans la wilaya d'Oran." } } });
    await expect(modifierPositionBoutiqueAdmin(test.client, "boutique", 35.7, -0.6)).rejects.toThrow(MESSAGE_HORS_ORAN);
    expect(messageErreurPosition({ code: "23514", message: "Saisissez la latitude et la longitude, ou aucune des deux." })).toBe(MESSAGE_POSITION_INCOMPLETE);
    expect(messageErreurPosition({ code: "42501", message: "Boutique publiée : …" })).toBe(MESSAGE_POSITION_PUBLIEE);
    expect(messageErreurPosition(null)).toBe("Impossible d’enregistrer la position. Réessayez.");
  });
});

describe("US-24.2 : position de ma boutique (commerçant)", () => {
  it("boutique en attente : enregistre sur la boutique du profil (jamais un identifiant envoyé par le navigateur)", async () => {
    const test = simulation({ role: "commercant", boutiqueId: "ma-boutique" });
    await modifierPositionMaBoutique(test.client, 35.7303, -0.5784);
    expect(test.updateEq).toHaveBeenCalledWith("id", "ma-boutique");
    expect(test.update).toHaveBeenCalledWith({ latitude: 35.7303, longitude: -0.5784 });
  });
  it.each(["validee", "suspendue"])("boutique %s : refusée avec « contactez BleDeal », sans écriture", async statut => {
    const test = simulation({ role: "commercant", statut });
    await expect(modifierPositionMaBoutique(test.client, 35.7303, -0.5784)).rejects.toThrow(MESSAGE_POSITION_PUBLIEE);
    expect(test.update).not.toHaveBeenCalled();
  });
  it("refus de la base (boutique publiée entre-temps) traduit en « contactez BleDeal »", async () => {
    const test = simulation({ role: "commercant", resultat: { data: null, error: { code: "42501", message: "Boutique publiée" } } });
    await expect(modifierPositionMaBoutique(test.client, 35.7303, -0.5784)).rejects.toThrow(MESSAGE_POSITION_PUBLIEE);
  });
  it("compte sans boutique : refusé", async () => {
    const test = simulation({ role: "client", boutiqueId: null });
    await expect(modifierPositionMaBoutique(test.client, 35.7303, -0.5784)).rejects.toThrow("aucune boutique");
    expect(test.update).not.toHaveBeenCalled();
  });
  it("aucune ligne modifiée (RLS) : message d'erreur", async () => {
    const test = simulation({ role: "commercant", resultat: { data: null, error: null } });
    await expect(modifierPositionMaBoutique(test.client, 35.7303, -0.5784)).rejects.toThrow("Impossible d’enregistrer la position");
  });
});

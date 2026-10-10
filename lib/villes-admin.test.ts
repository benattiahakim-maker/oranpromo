import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { changerOuvertureVille, changerVilleAmbassadeur, compterParVille, listerAmbassadeurs, listerVilles, resumeVille, texteConfirmationVille, type VilleAdmin } from "./villes-admin";
import { ZONE_ORAN } from "./position";

const oran: VilleAdmin = { ...ZONE_ORAN, code: "oran", nom_ar: "وهران", numero_wilaya: 31, ouverte: true, ordre: 1 };
const tlemcen: VilleAdmin = { nom: "Tlemcen", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167, code: "tlemcen", nom_ar: "تلمسان", numero_wilaya: 13, ouverte: false, ordre: 4 };

function simulation(role = "admin", resultat: { data: unknown; error: unknown } = { data: { code: "x" }, error: null }) {
  const requete: Record<string, ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>> = {};
  for (const m of ["select", "eq", "order", "update"]) requete[m] = vi.fn<(...args: unknown[]) => unknown>(() => requete);
  requete.maybeSingle = vi.fn<(...args: unknown[]) => unknown>(async () => resultat);
  (requete as unknown as { then: unknown }).then = (ok: (v: unknown) => void) => ok({ data: [oran, tlemcen], error: null });
  const profil = { eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }) };
  // Lecture du rôle (select("role") sur profils) ; tout le reste passe par la même requête simulée.
  const from = vi.fn((table: string) => table === "profils" ? { ...requete, select: (colonnes: string) => colonnes === "role" ? profil : requete.select(colonnes) } : requete);
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "compte" } }, error: null }) }, from } as unknown as SupabaseClient<Database>;
  return { client, requete, from };
}

describe("US-29.4 : /admin/villes", () => {
  it("compte les boutiques validées et en attente par ville", () => {
    const comptes = compterParVille([oran, tlemcen], [{ ville: "oran", statut: "validee" }, { ville: "oran", statut: "validee" }, { ville: "oran", statut: "en_attente" }, { ville: "oran", statut: "suspendue" }, { ville: "tlemcen", statut: "en_attente" }]);
    expect(comptes.map(v => [v.code, v.validees, v.enAttente])).toEqual([["oran", 2, 1], ["tlemcen", 0, 1]]);
  });
  it("résume comme la maquette : wilaya, validées, en attente (omis à zéro)", () => {
    expect(resumeVille({ numero_wilaya: 31, validees: 12, enAttente: 2 })).toBe("Wilaya 31 · 12 validées · 2 en attente");
    expect(resumeVille({ numero_wilaya: 27, validees: 5, enAttente: 0 })).toBe("Wilaya 27 · 5 validées");
    expect(resumeVille({ numero_wilaya: 13, validees: 1, enAttente: 0 })).toBe("Wilaya 13 · 1 validée");
    expect(resumeVille({ numero_wilaya: null, validees: 0, enAttente: 0 })).toBe("0 validée");
  });
  it("confirmation : texte 16 pour ouvrir, et l'inverse pour fermer", () => {
    expect(texteConfirmationVille("Tlemcen", true)).toEqual({ question: "Ouvrir Tlemcen ?", suite: "Ses boutiques validées apparaîtront dans le choix des villes, l’accueil, le catalogue et la carte." });
    expect(texteConfirmationVille("Oran", false).question).toBe("Fermer Oran ?");
  });
  it("lit toutes les villes dans l'ordre de la feuille de route", async () => {
    const test = simulation(); expect(await listerVilles(test.client)).toEqual([oran, tlemcen]); expect(test.requete.order).toHaveBeenCalledWith("ordre");
  });
  it("seul l'admin ouvre ou ferme une ville, et seulement la colonne « ouverte »", async () => {
    const amb = simulation("ambassadeur"); await expect(changerOuvertureVille(amb.client, "tlemcen", true)).rejects.toThrow("administrateurs"); expect(amb.requete.update).not.toHaveBeenCalled();
    const test = simulation(); await changerOuvertureVille(test.client, "tlemcen", true);
    expect(test.requete.update).toHaveBeenCalledWith({ ouverte: true }); expect(test.requete.eq).toHaveBeenCalledWith("code", "tlemcen");
    const refus = simulation("admin", { data: null, error: null }); await expect(changerOuvertureVille(refus.client, "tlemcen", false)).rejects.toThrow("Impossible de changer la ville");
  });
  it("ville d'un ambassadeur : admin seulement, ambassadeurs seulement, null = toutes les villes", async () => {
    const amb = simulation("ambassadeur"); await expect(changerVilleAmbassadeur(amb.client, "a", "oran")).rejects.toThrow("administrateurs"); await expect(listerAmbassadeurs(amb.client)).rejects.toThrow("administrateurs");
    const test = simulation("admin", { data: { id: "a" }, error: null }); await changerVilleAmbassadeur(test.client, "a", null);
    expect(test.requete.update).toHaveBeenCalledWith({ ville: null }); expect(test.requete.eq).toHaveBeenCalledWith("role", "ambassadeur");
    const inconnue = simulation("admin", { data: null, error: { code: "23503" } }); await expect(changerVilleAmbassadeur(inconnue.client, "a", "setif")).rejects.toThrow("Ville inconnue.");
  });
});

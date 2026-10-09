import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { BOUTIQUE_NON_VALIDEE, consommerQuotaIA, QUOTA_IA_ATTEINT, verifierAccesIA } from "./acces-ia";

const messages = { connexion: "Connectez-vous.", indisponible: "IA indisponible" };
function simulation({ user = { id: "compte" } as { id: string } | null, profil = { data: { boutique_id: "boutique" } as { boutique_id: string | null } | null, error: null as unknown }, boutique = { data: { statut: "validee" } as { statut: string } | null, error: null as unknown }, quota = { data: true as unknown, error: null as unknown } } = {}) {
  const eq = vi.fn((colonne: string, valeur: string) => ({ colonne, valeur }));
  const lire = vi.fn((table: string) => ({ select: () => ({ eq: (colonne: string, valeur: string) => { eq(colonne, valeur); return { maybeSingle: async () => table === "profils" ? profil : boutique }; } }) }));
  const rpc = vi.fn().mockResolvedValue(quota);
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: lire, rpc } as unknown as SupabaseClient<Database>;
  return { client, lire, eq, rpc };
}

describe("accès aux routes IA", () => {
  it("autorise un compte rattaché à une boutique validée", async () => {
    const test = simulation();
    expect(await verifierAccesIA(test.client, messages)).toBeNull();
    expect(test.eq).toHaveBeenCalledWith("id", "compte"); expect(test.eq).toHaveBeenCalledWith("id", "boutique");
  });
  it("refuse sans session (401)", async () => { expect(await verifierAccesIA(simulation({ user: null }).client, messages)).toEqual({ message: "Connectez-vous.", statut: 401 }); });
  it("refuse sans boutique rattachée (403) sans lire de boutique", async () => {
    const test = simulation({ profil: { data: { boutique_id: null }, error: null } });
    expect((await verifierAccesIA(test.client, messages))?.statut).toBe(403); expect(test.lire).toHaveBeenCalledTimes(1);
  });
  it.each(["en_attente", "suspendue"])("refuse une boutique %s (403)", async statut => {
    expect(await verifierAccesIA(simulation({ boutique: { data: { statut }, error: null } }).client, messages)).toEqual({ message: BOUTIQUE_NON_VALIDEE, statut: 403 });
  });
  it("refuse une boutique illisible (403) et signale une erreur de lecture (503)", async () => {
    expect((await verifierAccesIA(simulation({ boutique: { data: null, error: null } }).client, messages))?.statut).toBe(403);
    expect(await verifierAccesIA(simulation({ boutique: { data: null, error: { message: "panne" } } }).client, messages)).toEqual({ message: "IA indisponible", statut: 503 });
    expect(await verifierAccesIA(simulation({ profil: { data: null, error: { message: "panne" } } }).client, messages)).toEqual({ message: "IA indisponible", statut: 503 });
  });
  it("consomme le quota dans la base", async () => { const test = simulation(); expect(await consommerQuotaIA(test.client, "IA indisponible")).toBeNull(); expect(test.rpc).toHaveBeenCalledWith("consommer_quota_ia"); });
  it("répond 429 quand le quota est atteint", async () => { expect(await consommerQuotaIA(simulation({ quota: { data: false, error: null } }).client, "IA indisponible")).toEqual({ message: QUOTA_IA_ATTEINT, statut: 429 }); });
  it("répond 503 si le quota ne peut pas être vérifié", async () => {
    expect(await consommerQuotaIA(simulation({ quota: { data: null, error: { message: "panne" } } }).client, "IA indisponible")).toEqual({ message: "IA indisponible", statut: 503 });
    expect(await consommerQuotaIA(simulation({ quota: { data: "oui", error: null } }).client, "IA indisponible")).toEqual({ message: "IA indisponible", statut: 503 });
  });
});

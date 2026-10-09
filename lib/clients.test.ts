import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { debloquerClient, listerClientsSurveilles, enregistrerProfilClient, ErreurValidationProfil, essaisRestants, messageNoShows, profilComplet, telephoneLisible, validerProfilClient } from "./clients";

describe("profil client (US-20.2, US-20.4)", () => {
  it("compte les essais restants avant le blocage au 5e no-show", () => {
    expect([0, 1, 4, 5, 7].map(essaisRestants)).toEqual([5, 4, 1, 0, 0]);
    expect(messageNoShows(0, false)).toBeNull();
    expect(messageNoShows(1, false)).toBe("Attention : 1 commande non récupérée. Il vous reste 4 essais avant le blocage de votre compte.");
    expect(messageNoShows(4, false)).toContain("Il vous reste 1 essai avant");
    expect(messageNoShows(5, true)).toContain("bloqué");
  });
  it("valide le nom et le numéro algérien", () => {
    expect(validerProfilClient({ nom: "Samia", telephone: "0555 12 34 56" })).toEqual({});
    expect(Object.keys(validerProfilClient({ nom: " S ", telephone: "12345" }))).toEqual(["nom", "telephone"]);
    expect(profilComplet({ nom: "Samia", telephone: "+213555123456" })).toBe(true);
    expect(profilComplet({ nom: "Samia", telephone: null })).toBe(false);
    expect(telephoneLisible("+213555123456")).toBe("0555 12 34 56");
  });
  it("enregistre le nom et le numéro normalisé", async () => {
    const update = vi.fn(); const eq = vi.fn();
    const chaine = { update: (v: unknown) => { update(v); return chaine; }, eq: (...a: unknown[]) => { eq(...a); return chaine; }, select: () => chaine, maybeSingle: async () => ({ data: { id: "moi" }, error: null }) };
    const client = { auth: { getUser: async () => ({ data: { user: { id: "moi" } }, error: null }) }, from: () => chaine } as unknown as SupabaseClient<Database>;
    await enregistrerProfilClient(client, { nom: " Samia B. ", telephone: "0555 12 34 56" });
    expect(update).toHaveBeenCalledWith({ nom: "Samia B.", telephone: "+213555123456" });
    expect(eq).toHaveBeenCalledWith("id", "moi");
    await expect(enregistrerProfilClient(client, { nom: "", telephone: "" })).rejects.toBeInstanceOf(ErreurValidationProfil);
  });
});

describe("clients à surveiller (US-20.4)", () => {
  it("sépare les clients bloqués de ceux qui ont des no-shows", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "or", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [{ id: "a", bloque: true, no_shows: 5 }, { id: "b", bloque: false, no_shows: 2 }], error: null });
    const resultat = await listerClientsSurveilles({ from: () => chaine } as unknown as SupabaseClient<Database>);
    expect(resultat.bloques.map(c => c.id)).toEqual(["a"]);
    expect(resultat.avecNoShows.map(c => c.id)).toEqual(["b"]);
    expect(appels).toContainEqual(["or", "bloque.eq.true,no_shows.gt.0"]);
  });
  it("débloque par la fonction de la base et relaie le refus", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1");
    expect(rpc).toHaveBeenCalledWith("debloquer_client", { client: "k1" });
    rpc.mockResolvedValue({ error: { code: "42501", message: "Action réservée aux administrateurs." } });
    await expect(debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1")).rejects.toThrow("Action réservée aux administrateurs.");
    rpc.mockResolvedValue({ error: { code: "XX000", message: "interne" } });
    await expect(debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1")).rejects.toThrow("Impossible de débloquer");
  });
});

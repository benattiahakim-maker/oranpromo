// US-32 (suite) : mots interdits tenus par l'admin (fonctions de la base mots_interdits, ajouter_mot_interdit, retirer_mot_interdit).
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { ajouterMotInterdit, chargerMotsInterdits, retirerMotInterdit } from "./moderation";

const client = (reponse: { data?: unknown; error?: unknown }) => { const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...reponse }); return { rpc, c: { rpc } as unknown as SupabaseClient<Database> }; };

describe("mots interdits", () => {
  it("charge la liste par la fonction réservée à l'admin", async () => {
    const { rpc, c } = client({ data: ["fdp", "zebi"] });
    await expect(chargerMotsInterdits(c)).resolves.toEqual(["fdp", "zebi"]);
    expect(rpc).toHaveBeenCalledWith("mots_interdits");
    await expect(chargerMotsInterdits(client({ error: { code: "42501", message: "Accès réservé" } }).c)).rejects.toThrow("Impossible de charger les mots interdits");
  });
  it("ajoute : la base retourne la forme enregistrée ; mot vide refusé sans appel", async () => {
    const { rpc, c } = client({ data: "arnaque" });
    await expect(ajouterMotInterdit(c, "Arnaqué")).resolves.toBe("arnaque");
    expect(rpc).toHaveBeenCalledWith("ajouter_mot_interdit", { mot: "Arnaqué" });
    const vide = client({});
    await expect(ajouterMotInterdit(vide.c, "   ")).rejects.toThrow("Écrivez un mot.");
    expect(vide.rpc).not.toHaveBeenCalled();
  });
  it("messages de la base (mot invalide, absent, accès) ; autre erreur : message générique", async () => {
    await expect(ajouterMotInterdit(client({ error: { code: "22023", message: "Un seul mot, sans espace." } }).c, "deux mots")).rejects.toThrow("Un seul mot, sans espace.");
    await expect(retirerMotInterdit(client({ error: { code: "P0002", message: "Ce mot n'est pas dans la liste." } }).c, "x")).rejects.toThrow("pas dans la liste");
    await expect(retirerMotInterdit(client({ error: { code: "XX000", message: "détail interne" } }).c, "x")).rejects.toThrow("Impossible de retirer ce mot. Réessayez.");
    const { rpc, c } = client({});
    await retirerMotInterdit(c, "zebi");
    expect(rpc).toHaveBeenCalledWith("retirer_mot_interdit", { mot: "zebi" });
  });
});

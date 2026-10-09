import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { ajusterQuantite, libelleStock, modifierStock, QUANTITE_STOCK_MAX, quantiteValide, stockTotal, tailleEpuisee } from "./stock";

function simulation({ taille = { data: { quantite: 3 } as unknown, error: null as unknown }, article = { data: { statut: "disponible" } as unknown, error: null as unknown } } = {}) {
  const appels: unknown[][] = [];
  const update = vi.fn();
  const chaine = (resultat: unknown) => { const c: Record<string, unknown> = {}; for (const m of ["update", "select", "eq"]) c[m] = (...a: unknown[]) => { appels.push([m, ...a]); if (m === "update") update(...a); return c; }; c.maybeSingle = async () => resultat; return c; };
  const client = { from: (table: string) => chaine(table === "tailles" ? taille : article) } as unknown as SupabaseClient<Database>;
  return { client, appels, update };
}

describe("stock par taille (US-20.1)", () => {
  it("valide une quantité entière entre 0 et 999", () => {
    expect([0, 1, 999].every(quantiteValide)).toBe(true);
    expect([-1, 1000, 1.5, Number.NaN].some(quantiteValide)).toBe(false);
  });
  it("ajuste la quantité sans sortir des bornes", () => {
    expect(ajusterQuantite(0, -1)).toBe(0);
    expect(ajusterQuantite(2, 1)).toBe(3);
    expect(ajusterQuantite(QUANTITE_STOCK_MAX, 1)).toBe(QUANTITE_STOCK_MAX);
  });
  it("calcule le total, l’épuisement et le libellé", () => {
    expect(stockTotal([{ quantite: 2 }, { quantite: 0 }, { quantite: 3 }])).toBe(5);
    expect(tailleEpuisee({ quantite: 0 })).toBe(true);
    expect(tailleEpuisee({ quantite: 1 })).toBe(false);
    expect([libelleStock(0), libelleStock(1), libelleStock(4)]).toEqual(["Épuisé", "1 pièce", "4 pièces"]);
  });
  it("enregistre la quantité de la taille de l’article et relit le statut", async () => {
    const test = simulation({ article: { data: { statut: "vendu" }, error: null } });
    expect(await modifierStock(test.client, "article", "taille", 0)).toEqual({ quantite: 3, statut: "vendu" });
    expect(test.update).toHaveBeenCalledWith({ quantite: 0 });
    expect(test.appels).toContainEqual(["eq", "id", "taille"]);
    expect(test.appels).toContainEqual(["eq", "article_id", "article"]);
  });
  it("refuse une quantité invalide sans appeler la base", async () => {
    const test = simulation();
    await expect(modifierStock(test.client, "article", "taille", -2)).rejects.toThrow("entre 0 et 999");
    expect(test.update).not.toHaveBeenCalled();
  });
  it("signale un échec d’enregistrement ou de relecture", async () => {
    await expect(modifierStock(simulation({ taille: { data: null, error: { message: "refus" } } }).client, "a", "t", 1)).rejects.toThrow("Impossible d’enregistrer le stock");
    await expect(modifierStock(simulation({ article: { data: null, error: { message: "panne" } } }).client, "a", "t", 1)).rejects.toThrow("Rechargez la page");
  });
});

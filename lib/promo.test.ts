import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { arreterPromo, dateFinPromo, datePourChampPromo, enregistrerPromo, pourcentageDepuisPrix, prixDepuisPourcentage, validerPromo } from "./promo";
import { prixAffiche, promoActive } from "./prix";
const { articleDeMaBoutique } = vi.hoisted(() => ({ articleDeMaBoutique: vi.fn() }));
vi.mock("./gestion-articles", async importOriginal => ({ ...await importOriginal<typeof import("./gestion-articles")>(), articleDeMaBoutique }));
const maintenant = new Date("2026-10-09T12:00:00Z");
const saisie = { prixPromo: "3500", dateFin: "2099-10-10T12:30", badge: "reduction" as const };
beforeEach(() => { articleDeMaBoutique.mockReset(); articleDeMaBoutique.mockResolvedValue({ boutique_id: "boutique", prix: 4500 }); });

describe("US-12 : calcul et validation", () => {
  it("calcule le prix entier depuis le pourcentage", () => {
    expect(prixDepuisPourcentage(4500, "20")).toBe(3600); expect(prixDepuisPourcentage(999, "25")).toBe(749); expect(prixDepuisPourcentage(4500, "12,5")).toBe(3938);
  });
  it.each(["", "0", "100", "101", "-5", "abc", "1e2"])("refuse un pourcentage invalide %s", valeur => { expect(prixDepuisPourcentage(4500, valeur)).toBeNull(); });
  it("réutilise le calcul de réduction et refuse un prix invalide", () => {
    expect(pourcentageDepuisPrix(4500, "3500")).toBe(22); expect(pourcentageDepuisPrix(4500, "4500")).toBeNull(); expect(pourcentageDepuisPrix(4500, "3.5")).toBeNull();
  });
  it("accepte une réduction et une date future", () => { expect(validerPromo(4500, saisie, maintenant)).toEqual({}); });
  it.each(["", "0", "-1", "3.5", "1e3"])("refuse un prix promo non entier positif %s", prixPromo => { expect(validerPromo(4500, { ...saisie, prixPromo }, maintenant).prixPromo).toContain("entier"); });
  it.each(["4500", "5000"])("refuse un prix qui ne réduit pas le prix normal", prixPromo => { expect(validerPromo(4500, { ...saisie, prixPromo }, maintenant).prixPromo).toContain("inférieur"); });
  it("exige une date valide, strictement future", () => {
    expect(validerPromo(4500, { ...saisie, dateFin: "" }, maintenant).dateFin).toBe("Choisissez une date de fin.");
    expect(validerPromo(4500, { ...saisie, dateFin: "2026-02-30T12:00" }, maintenant).dateFin).toContain("valide");
    const fin = dateFinPromo(saisie.dateFin)!;
    expect(validerPromo(4500, saisie, fin).dateFin).toContain("futur");
    expect(validerPromo(4500, { ...saisie, dateFin: "2020-01-01T10:00" }, maintenant).dateFin).toContain("futur");
  });
  it("convertit la date locale du formulaire en instant et inversement", () => {
    const date = dateFinPromo(saisie.dateFin)!; expect(datePourChampPromo(date.toISOString())).toBe(saisie.dateFin); expect(dateFinPromo("invalide")).toBeNull();
  });
  it("revient automatiquement au prix normal après la date de fin", () => {
    const promo = { prixPromo: 3500, dateFin: "2026-10-09T12:00:00Z" };
    expect(promoActive(promo, new Date("2026-10-09T12:00:01Z"))).toBe(false); expect(prixAffiche(4500, promo, new Date("2026-10-09T12:00:01Z"))).toBe(4500);
  });
});

function simulation() {
  const single = vi.fn().mockResolvedValue({ data: { id: "article" }, error: null });
  const requete = { eq: vi.fn(), select: vi.fn(), single }; requete.eq.mockReturnValue(requete); requete.select.mockReturnValue(requete);
  const update = vi.fn().mockReturnValue(requete), upsert = vi.fn().mockResolvedValue({ error: null }), supprimer = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const client = { from: vi.fn((table: string) => table === "articles" ? { update } : { upsert, delete: supprimer }) } as unknown as SupabaseClient<Database>;
  return { client, requete, single, update, upsert, supprimer };
}
describe("US-12 : stockage des promos", () => {
  it("upsert une seule promo, sans stocker le badge calculé, et confirme l’article", async () => {
    const test = simulation(); await enregistrerPromo(test.client, "article", saisie);
    expect(articleDeMaBoutique).toHaveBeenCalledWith(test.client, "article"); expect(test.requete.eq).toHaveBeenCalledWith("boutique_id", "boutique");
    expect(test.update).toHaveBeenCalledWith({ derniere_confirmation: expect.any(String) });
    expect(test.upsert).toHaveBeenCalledWith({ article_id: "article", prix_promo: 3500, date_fin: dateFinPromo(saisie.dateFin)!.toISOString(), badge: null }, { onConflict: "article_id" });
  });
  it("stocke seulement le badge Promo flash", async () => { const test = simulation(); await enregistrerPromo(test.client, "article", { ...saisie, badge: "flash" }); expect(test.upsert).toHaveBeenCalledWith(expect.objectContaining({ badge: "Promo flash" }), expect.any(Object)); });
  it("revalide avec le prix réellement enregistré", async () => { const test = simulation(); articleDeMaBoutique.mockResolvedValue({ boutique_id: "boutique", prix: 3000 }); await expect(enregistrerPromo(test.client, "article", saisie)).rejects.toThrow("inférieur"); expect(test.upsert).not.toHaveBeenCalled(); expect(test.update).not.toHaveBeenCalled(); });
  it("refuse tout article d’une autre boutique sans écriture", async () => { const test = simulation(); articleDeMaBoutique.mockRejectedValue(new Error("Introuvable")); await expect(enregistrerPromo(test.client, "autre", saisie)).rejects.toThrow("Introuvable"); await expect(arreterPromo(test.client, "autre")).rejects.toThrow("Introuvable"); expect(test.update).not.toHaveBeenCalled(); expect(test.supprimer).not.toHaveBeenCalled(); });
  it("ne sauvegarde rien si la confirmation de l’article échoue", async () => { const test = simulation(); test.single.mockResolvedValue({ data: null, error: { message: "RLS" } }); await expect(enregistrerPromo(test.client, "article", saisie)).rejects.toThrow("confirmer"); expect(test.upsert).not.toHaveBeenCalled(); });
  it("signale un échec d’enregistrement", async () => { const test = simulation(); test.upsert.mockResolvedValue({ error: { message: "Réseau" } }); await expect(enregistrerPromo(test.client, "article", saisie)).rejects.toThrow("Impossible d’enregistrer"); });
  it("arrête la promo par suppression et confirme l’article", async () => { const test = simulation(); await arreterPromo(test.client, "article"); expect(test.supprimer).toHaveBeenCalled(); expect(test.supprimer.mock.results[0].value.eq).toHaveBeenCalledWith("article_id", "article"); expect(test.update).toHaveBeenCalledWith({ derniere_confirmation: expect.any(String) }); });
});

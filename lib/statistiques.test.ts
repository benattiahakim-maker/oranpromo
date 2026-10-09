import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { bornesStatistiques, calculerStatistiques, chargerStatistiques, dureeStatistiques, type EvenementStatistique } from "./statistiques";
const maintenant = new Date("2026-10-09T12:00:00Z");
const bornes = bornesStatistiques(7, maintenant);
const evenement = (type: EvenementStatistique["type"], article_id: string | null = null, date = "2026-10-08T12:00:00Z", boutique_id = "boutique"): EvenementStatistique => ({ type, article_id, date, boutique_id });
describe("US-13 : calcul des statistiques", () => {
  it("fixe les bornes glissantes de 7 et 30 jours", () => {
    expect(bornes).toEqual({ debut: "2026-10-02T12:00:00.000Z", fin: "2026-10-09T12:00:00.000Z" });
    expect(bornesStatistiques(30, maintenant).debut).toBe("2026-09-09T12:00:00.000Z");
  });
  it("sélectionne seulement les périodes autorisées", () => { expect(dureeStatistiques("30")).toBe(30); for (const valeur of ["7", "365", ["30"], undefined]) expect(dureeStatistiques(valeur)).toBe(7); });
  it("compte chaque type sans confondre les partages et les réservations", () => {
    const resultat = calculerStatistiques([evenement("vue_boutique"), evenement("vue_article", "a"), evenement("vue_article", "a"), evenement("clic_reserver", "a"), evenement("partage", "a")], "boutique", bornes, [{ id: "a", titre: "Polo" }]);
    expect(resultat).toEqual({ vuesBoutique: 1, vuesArticles: 2, clicsReservation: 1, topArticles: [{ id: "a", titre: "Polo", vues: 2, clics: 1 }] });
  });
  it("inclut un événement ancien dans 30 jours mais pas dans 7 jours", () => {
    const donnees = [evenement("vue_article", "a", "2026-09-20T12:00:00Z")];
    expect(calculerStatistiques(donnees, "boutique", bornes).vuesArticles).toBe(0);
    expect(calculerStatistiques(donnees, "boutique", bornesStatistiques(30, maintenant)).vuesArticles).toBe(1);
  });
  it("inclut les bornes et exclut les dates hors période, invalides et les autres boutiques", () => {
    const resultat = calculerStatistiques([evenement("vue_boutique", null, bornes.debut), evenement("vue_boutique", null, bornes.fin), evenement("vue_boutique", null, "2026-10-02T11:59:59Z"), evenement("vue_boutique", null, "2026-10-09T12:00:01Z"), evenement("vue_boutique", null, "invalide"), evenement("vue_boutique", null, bornes.fin, "autre")], "boutique", bornes);
    expect(resultat.vuesBoutique).toBe(2);
  });
  it("classe cinq articles par vues, avec un ordre stable en cas d’égalité", () => {
    const donnees = ["f", "e", "d", "c", "b", "a"].flatMap(id => Array.from({ length: id === "f" ? 3 : 1 }, () => evenement("vue_article", id)));
    const resultat = calculerStatistiques([...donnees, evenement("clic_reserver", "e"), evenement("clic_reserver", "sans-vue")], "boutique", bornes);
    expect(resultat.topArticles.map(a => a.id)).toEqual(["f", "a", "b", "c", "d"]);
    expect(resultat.topArticles[0].vues).toBe(3);
  });
  it("affiche zéro et une liste vide en l’absence d’événements", () => { expect(calculerStatistiques([], "boutique", bornes)).toEqual({ vuesBoutique: 0, vuesArticles: 0, clicsReservation: 0, topArticles: [] }); });
  it("compte les vues sans article sans créer une ligne de classement", () => { const resultat = calculerStatistiques([evenement("vue_article")], "boutique", bornes); expect(resultat.vuesArticles).toBe(1); expect(resultat.topArticles).toEqual([]); });
});

function simulation() {
  const range = vi.fn().mockResolvedValue({ data: [], error: null });
  const titres = vi.fn().mockResolvedValue({ data: [{ id: "a", titre: "Polo" }], error: null });
  const requete = { eq: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range, in: titres };
  for (const methode of [requete.eq, requete.gte, requete.lte, requete.order]) methode.mockReturnValue(requete);
  const client = { from: vi.fn().mockReturnValue({ select: () => requete }) } as unknown as SupabaseClient<Database>;
  return { client, requete, range, titres };
}
describe("US-13 : lecture paginée", () => {
  it("lit toutes les pages de la boutique avec des bornes fixes", async () => {
    const test = simulation(); test.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => evenement("vue_article", "a")), error: null }).mockResolvedValueOnce({ data: [evenement("clic_reserver", "a")], error: null });
    const resultat = await chargerStatistiques(test.client, "boutique", 7, maintenant);
    expect(test.range.mock.calls).toEqual([[0, 499], [500, 999]]); expect(test.requete.eq).toHaveBeenCalledWith("boutique_id", "boutique"); expect(test.requete.gte).toHaveBeenCalledWith("date", bornes.debut); expect(test.requete.lte).toHaveBeenCalledWith("date", bornes.fin);
    expect(resultat.topArticles).toEqual([{ id: "a", titre: "Polo", vues: 500, clics: 1 }]);
  });
  it("ne présente pas des zéros trompeurs si la lecture échoue", async () => { const test = simulation(); test.range.mockResolvedValue({ data: null, error: { message: "RLS" } }); await expect(chargerStatistiques(test.client, "boutique", 7, maintenant)).rejects.toThrow("Impossible de charger"); });
});

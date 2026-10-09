import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { calculerTableauDeBord, chargerTableauDeBord, type ArticleActivite, type BoutiqueActivite, type DonneesActivite } from "./tableau-de-bord";

const maintenant = new Date("2026-10-09T12:00:00Z"), seuil = "2026-09-18T12:00:00Z";
const boutique = (id: string, statut: BoutiqueActivite["statut"] = "validee"): BoutiqueActivite => ({ id, nom: `Boutique ${id}`, quartier: "Centre", whatsapp: "+213555123456", statut });
const article = (id: string, boutique_id: string, derniere_confirmation: string, statut: ArticleActivite["statut"] = "disponible"): ArticleActivite => ({ id, boutique_id, derniere_confirmation, statut });
const vide = (): DonneesActivite => ({ boutiques: [], articles: [], promos: [], evenements: [], signalements: [] });

describe("activité US-19", () => {
  it("compte les boutiques selon leur statut", () => {
    const resultat = calculerTableauDeBord({ ...vide(), boutiques: [boutique("1"), boutique("2", "en_attente"), boutique("3", "suspendue")] }, maintenant);
    expect(resultat.boutiquesValidees).toBe(1); expect(resultat.boutiquesEnAttente).toBe(1);
  });
  it("compte uniquement les disponibles et réservés récents d’une boutique validée, limite 21 jours stricte", () => {
    const resultat = calculerTableauDeBord({ ...vide(), boutiques: [boutique("b"), boutique("s", "suspendue"), boutique("e", "en_attente")], articles: [article("1", "b", "2026-09-18T12:00:00.001Z"), article("2", "b", maintenant.toISOString(), "reserve"), article("3", "b", seuil), article("4", "b", "2026-09-17"), article("5", "b", maintenant.toISOString(), "vendu"), article("6", "b", maintenant.toISOString(), "masque"), article("7", "s", maintenant.toISOString()), article("8", "e", maintenant.toISOString())] }, maintenant);
    expect(resultat.articlesEnLigne).toBe(2);
  });
  it("relance les validées sans article ou dont la dernière confirmation date d’au moins 21 jours", () => {
    const resultat = calculerTableauDeBord({ ...vide(), boutiques: [boutique("vide"), boutique("limite"), boutique("ancien"), boutique("recent"), boutique("attente", "en_attente")], articles: [article("1", "limite", seuil), article("2", "ancien", "2026-09-10"), article("3", "recent", "2026-09-01"), article("4", "recent", "2026-09-18T12:00:00.001Z", "masque")] }, maintenant);
    expect(resultat.aRelancer.map(b => b.id)).toEqual(["vide", "ancien", "limite"]);
    expect(resultat.aRelancer[0].derniereMiseAJour).toBeNull();
    expect(resultat.aRelancer[2].derniereMiseAJour).toBe(seuil);
  });
  it("compte les promos futures strictement et seulement les signalements ouverts", () => {
    const resultat = calculerTableauDeBord({ ...vide(), promos: [{ date_fin: "2026-10-09T12:00:00.001Z" }, { date_fin: maintenant.toISOString() }, { date_fin: "2026-10-08" }], signalements: [{ statut: "ouvert" }, { statut: "traite" }, { statut: "rejete" }] }, maintenant);
    expect(resultat.promosEnCours).toBe(1); expect(resultat.signalementsOuverts).toBe(1);
  });
  it("compte les clics sur 7 et 30 jours avec bornes incluses, sans dates futures ou autres événements", () => {
    const evenement = (date: string, type: DonneesActivite["evenements"][number]["type"] = "clic_reserver") => ({ date, type });
    const resultat = calculerTableauDeBord({ ...vide(), evenements: [evenement("2026-10-02T12:00:00Z"), evenement("2026-09-09T12:00:00Z"), evenement(maintenant.toISOString()), evenement("2026-10-10"), evenement("2026-09-09T11:59:59Z"), evenement(maintenant.toISOString(), "vue_article"), evenement("invalide")] }, maintenant);
    expect(resultat.clics7Jours).toBe(2); expect(resultat.clics30Jours).toBe(3);
  });
  it("retourne des zéros pour une base vide", () => {
    expect(calculerTableauDeBord(vide(), maintenant)).toEqual({ boutiquesValidees: 0, boutiquesEnAttente: 0, articlesEnLigne: 0, promosEnCours: 0, clics7Jours: 0, clics30Jours: 0, signalementsOuverts: 0, aRelancer: [] });
  });
  it("pagine pour ne pas tronquer les compteurs", async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => boutique(String(i))), error: null }).mockResolvedValueOnce({ data: [boutique("501")], error: null });
    const from = (table: string) => {
      const chaine = { select: () => chaine, eq: () => chaine, gt: () => chaine, gte: () => chaine, lte: () => chaine, order: () => chaine, range: table === "boutiques" ? range : async () => ({ data: [], error: null }) };
      return chaine;
    };
    const resultat = await chargerTableauDeBord({ from } as unknown as SupabaseClient<Database>, maintenant);
    expect(resultat.boutiquesValidees).toBe(501);
    expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it("remonte une erreur de lecture au lieu d’afficher des compteurs incomplets", async () => {
    const chaine = { select: () => chaine, eq: () => chaine, gt: () => chaine, gte: () => chaine, lte: () => chaine, order: () => chaine, range: async () => ({ data: null, error: {} }) };
    await expect(chargerTableauDeBord({ from: () => chaine } as unknown as SupabaseClient<Database>, maintenant)).rejects.toThrow("Impossible de charger l’activité");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { annulableParClient, annulerCommandeClient, commandeEnCours, etapesFrise, formaterDateHeure, libelleMotif, lireCommande, listerMesCommandes, messageErreurCommande, passerCommande, quantiteTotale } from "./commandes";

function client({ rpc = { data: "commande" as unknown, error: null as unknown }, lecture = { data: [] as unknown, error: null as unknown }, user = { id: "moi" } as { id: string } | null } = {}) {
  const appels: unknown[][] = [];
  const chaine: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return m === "limit" ? Promise.resolve(lecture) : chaine; };
  chaine.maybeSingle = async () => lecture;
  const appelRpc = vi.fn().mockResolvedValue(rpc);
  return { appels, rpc: appelRpc, client: { rpc: appelRpc, from: (table: string) => { appels.push(["from", table]); return chaine; }, auth: { getUser: async () => ({ data: { user }, error: null }) } } as unknown as SupabaseClient<Database> };
}

describe("commandes (US-20)", () => {
  it("distingue les statuts en cours et annulables par le client", () => {
    expect(["demandee", "confirmee", "prete"].every(s => commandeEnCours(s as never))).toBe(true);
    expect(commandeEnCours("recuperee")).toBe(false);
    expect(annulableParClient("confirmee")).toBe(true);
    expect(annulableParClient("prete")).toBe(false);
    expect(libelleMotif("plus_en_stock")).toBe("Plus en stock");
    expect(libelleMotif("inconnu")).toBeNull();
  });
  it("construit la frise : étapes faites puis étapes restantes grisées", () => {
    const frise = etapesFrise("confirmee", [{ statut: "confirmee", date: "2026-10-09T12:30:00Z", note: null, auteur: "boutique" }, { statut: "demandee", date: "2026-10-09T12:05:00Z", note: "Samedi", auteur: "client" }]);
    expect(frise.map(e => [e.statut, e.faite])).toEqual([["demandee", true], ["confirmee", true], ["prete", false], ["recuperee", false]]);
    expect(frise[0].note).toBe("Samedi");
  });
  it("n’ajoute pas d’étape restante à une commande terminée", () => {
    const frise = etapesFrise("annulee", [{ statut: "demandee", date: "2026-10-09T12:05:00Z", note: null, auteur: "client" }, { statut: "annulee", date: "2026-10-09T13:00:00Z", note: "Plus en stock", auteur: "boutique" }]);
    expect(frise.map(e => e.statut)).toEqual(["demandee", "annulee"]);
  });
  it("affiche la date à l’heure d’Oran", () => {
    expect(formaterDateHeure("2026-10-09T12:05:00Z")).toBe("ven. 9 oct. · 13:05");
  });
  it("garde les messages métier de la base et masque les autres", () => {
    expect(messageErreurCommande({ code: "23514", message: "Il ne reste que 1 pièce(s)." }, "défaut")).toBe("Il ne reste que 1 pièce(s).");
    expect(messageErreurCommande({ code: "XX000", message: "détail interne" }, "défaut")).toBe("défaut");
    expect(messageErreurCommande(null, "défaut")).toBe("défaut");
  });
  it("passe la commande par la fonction de la base", async () => {
    const test = client();
    expect(await passerCommande(test.client, "b1", [{ article_id: "a", taille: "M", quantite: 2 }], "  Samedi  ")).toBe("commande");
    expect(test.rpc).toHaveBeenCalledWith("passer_commande", { boutique: "b1", lignes: [{ article_id: "a", taille: "M", quantite: 2 }], note: "Samedi" });
    await expect(passerCommande(test.client, "b1", [], "")).rejects.toThrow("panier est vide");
    await expect(passerCommande(client({ rpc: { data: null, error: { code: "42501", message: "Votre compte est bloqué." } } }).client, "b1", [{ article_id: "a", taille: "M", quantite: 1 }], "")).rejects.toThrow("Votre compte est bloqué.");
  });
  it("annule une commande côté client avec le motif client", async () => {
    const test = client({ rpc: { data: null, error: null } });
    await annulerCommandeClient(test.client, "c1", " Plus besoin ");
    expect(test.rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: "c1", statut: "annulee", motif: "client_a_annule", note: "Plus besoin" });
    await expect(annulerCommandeClient(test.client, "c1", "x".repeat(301))).rejects.toThrow("300 caractères");
  });
  it("liste les commandes du compte connecté, les plus récentes d’abord", async () => {
    const test = client({ lecture: { data: [{ id: "c1" }], error: null } });
    expect(await listerMesCommandes(test.client)).toEqual([{ id: "c1" }]);
    expect(test.appels).toContainEqual(["eq", "client_id", "moi"]);
    expect(test.appels).toContainEqual(["order", "cree_le", { ascending: false }]);
    await expect(listerMesCommandes(client({ user: null }).client)).rejects.toThrow("session");
  });
  it("lit une commande seulement avec un identifiant valide", async () => {
    const test = client({ lecture: { data: { id: "11111111-1111-1111-1111-111111111111" }, error: null } });
    expect(await lireCommande(test.client, "pas-un-id")).toBeNull();
    expect(await lireCommande(test.client, "11111111-1111-1111-1111-111111111111")).toEqual({ id: "11111111-1111-1111-1111-111111111111" });
    expect(quantiteTotale([{ quantite: 2 }, { quantite: 1 }])).toBe(3);
  });
});

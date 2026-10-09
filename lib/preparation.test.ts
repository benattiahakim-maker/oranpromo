import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CATEGORIES_ARTICLE } from "./article";
import { dateLongue, grouperPreparation, listerAPreparer, type CommandeAPreparer } from "./tableau-commandes";

const l = (article_id: string | null, titre: string, taille: string, quantite: number, categorie: string | null = "Polos") => ({ article_id, titre, taille, quantite, articles: categorie ? { categorie } : null });
const c = (numero: number, client_nom: string, lignes: CommandeAPreparer["lignes_commande"], total = 1000, remise_bon = 0): CommandeAPreparer => ({ id: `c${numero}`, numero, client_nom, total, remise_bon, lignes_commande: lignes });

describe("US-28.3 : regroupement de la liste de préparation", () => {
  const cat = ["T-shirts", "Polos", "Parfums"];
  it("même article en deux tailles, même taille dans deux commandes, quantités additionnées", () => {
    const p = grouperPreparation([
      c(129, "Karim M.", [l("polo", "Polo piqué", "M", 1)]),
      c(131, "Samia B.", [l("polo", "Polo piqué", "M", 2), l("polo", "Polo piqué", "L", 1)]),
    ], cat);
    expect(p.articles).toHaveLength(1);
    expect(p.articles[0]).toMatchObject({ titre: "Polo piqué", total: 4 });
    expect(p.articles[0].tailles).toEqual([
      { taille: "M", quantite: 3, commandes: [{ numero: 129, prenom: "Karim", quantite: 1 }, { numero: 131, prenom: "Samia", quantite: 2 }] },
      { taille: "L", quantite: 1, commandes: [{ numero: 131, prenom: "Samia", quantite: 1 }] },
    ]);
    expect(p.pieces).toBe(4);
  });
  it("article supprimé depuis la commande : regroupé par titre", () => {
    const p = grouperPreparation([c(1, "A", [l(null, "Casquette coton", "Unique", 1, null)]), c(2, "B", [l(null, "casquette coton ", "Unique", 2, null)])], cat);
    expect(p.articles).toHaveLength(1);
    expect(p.articles[0].tailles[0]).toMatchObject({ taille: "Unique", quantite: 3 });
  });
  it("tri : catégorie (ordre des rayons) puis nom ; tailles S < M < L, 50 ml < 100 ml, Unique à la fin", () => {
    const p = grouperPreparation([c(1, "A", [
      l("p2", "Parfum oud", "100 ml", 1, "Parfums"), l("p2", "Parfum oud", "50 ml", 1, "Parfums"),
      l("t", "Tee coton", "XL", 1, "T-shirts"), l("t", "Tee coton", "S", 1, "T-shirts"), l("t", "Tee coton", "Unique", 1, "T-shirts"),
      l("p1", "Ambre", "30 ml", 1, "Parfums"), l("x", "Inconnu", "M", 1, null),
    ])], cat);
    expect(p.articles.map(a => a.titre)).toEqual(["Tee coton", "Ambre", "Parfum oud", "Inconnu"]);
    expect(p.articles[0].tailles.map(t => t.taille)).toEqual(["S", "XL", "Unique"]);
    expect(p.articles[2].tailles.map(t => t.taille)).toEqual(["50 ml", "100 ml"]);
  });
  it("liste par commande : pièces et montant à encaisser (après le bon)", () => {
    const p = grouperPreparation([c(121, "Yacine B.", [l("a", "X", "M", 2)], 3900, 300)], CATEGORIES_ARTICLE);
    expect(p.commandes).toEqual([{ numero: 121, prenom: "Yacine", pieces: 2, montant: 3600 }]);
  });
  it("aucune commande : liste vide", () => {
    expect(grouperPreparation([], cat)).toEqual({ articles: [], commandes: [], pieces: 0 });
  });
  it("date de l’en-tête à l’heure d’Oran", () => {
    expect(dateLongue(Date.parse("2026-10-09T13:05:00Z"))).toBe("vendredi 09/10 à 14 h 05");
  });
  it("lit seulement les commandes confirmées de la boutique, avec la catégorie de l’article", async () => {
    const appels: unknown[][] = [];
    const ch: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) ch[m] = (...a: unknown[]) => { appels.push([m, ...a]); return ch; };
    ch.limit = async () => ({ data: [], error: null });
    await listerAPreparer({ from: () => ch } as unknown as SupabaseClient<Database>, "b1");
    expect(appels).toContainEqual(["eq", "boutique_id", "b1"]);
    expect(appels).toContainEqual(["eq", "statut", "confirmee"]);
    expect(String(appels[0][1])).toContain("articles(categorie)");
  });
});

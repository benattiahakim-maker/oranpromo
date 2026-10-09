import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { articleDansUnivers, trierCategories, chargerCatalogue, chargerOptionsCatalogue, chargerPromos, filtrerCatalogue, limiteConfirmation, LIMITE_CATALOGUE, type CarteArticle } from "./catalogue";

const article: CarteArticle = { id: "1", titre: "PÔLO bleu", description: "Coton léger", categorie: "Hauts", genre: "homme", prix: 3500, cree_le: "2026-10-08", boutique: { nom: "Test", quartier: "Centre" }, photo: null, tailles: ["M"], promo: { prixPromo: 2000, dateFin: "2026-11-01" } };
const maintenant = new Date("2026-10-08");
describe("catalogue (US-05, US-06)", () => {
  it("recherche sans accents ni distinction de casse dans les trois champs", () => {
    for (const q of ["polo", "LEGER", "hauts"]) expect(filtrerCatalogue([article], { q }, maintenant)).toHaveLength(1);
    expect(filtrerCatalogue([article], { q: "jean" }, maintenant)).toHaveLength(0);
  });
  it("combine tous les filtres et utilise le prix promo actif", () => {
    expect(filtrerCatalogue([article], { categorie: "Hauts", taille: "M", genre: "homme", min: 1500, max: 2500, quartier: "Centre", promo: true }, maintenant)).toHaveLength(1);
    expect(filtrerCatalogue([article], { taille: "S" }, maintenant)).toHaveLength(0);
    expect(filtrerCatalogue([article], { max: 2500, promo: true }, new Date("2026-12-01"))).toHaveLength(0);
  });
});


function clientFactice(lignes: unknown[]) {
  const appels: [string, ...unknown[]][] = [];
  const requete: Record<string, unknown> = {};
  for (const methode of ["select", "in", "eq", "gt", "gte", "order"]) requete[methode] = (...args: unknown[]) => { appels.push([methode, ...args]); return requete; };
  requete.range = async (...args: unknown[]) => { appels.push(["range", ...args]); return { data: lignes, error: null }; };
  const client = { from: (table: string) => { appels.push(["from", table]); return requete; } } as unknown as SupabaseClient<Database>;
  return { client, appels };
}
const ligne = { id: "1", titre: "Polo", description: null, categorie: "T-shirts et polos", genre: "homme", prix: 3500, cree_le: "2026-10-08", boutiques: { nom: "Test", quartier: "Centre", statut: "validee" }, photos: [{ adresse: "b", adresse_vignette: null, ordre: 1 }, { adresse: "a", adresse_vignette: "a-v", ordre: 0 }], tailles: [{ libelle: "M", disponible: true }, { libelle: "L", disponible: false }], promos: null };
const jour = new Date("2026-10-09T12:00:00.000Z");

describe("visibilité publique des listes", () => {
  it("calcule la limite des 21 jours", () => { expect(limiteConfirmation(jour)).toBe("2026-09-18T12:00:00.000Z"); });
  it("accueil : filtre boutique validée, statut et confirmation récente, page de 20", async () => {
    const { client, appels } = clientFactice([{ ...ligne, promos: { prix_promo: 2000, date_fin: "2026-11-01" } }]);
    const [carte] = await chargerPromos(client, 1, jour);
    expect(appels).toContainEqual(["in", "statut", ["disponible", "reserve"]]);
    expect(appels).toContainEqual(["eq", "boutiques.statut", "validee"]);
    expect(appels).toContainEqual(["gt", "derniere_confirmation", "2026-09-18T12:00:00.000Z"]);
    expect(appels).toContainEqual(["gte", "promos.date_fin", jour.toISOString()]);
    expect(appels).toContainEqual(["range", 20, 39]);
    expect(carte).toEqual({ id: "1", titre: "Polo", description: null, categorie: "T-shirts et polos", genre: "homme", prix: 3500, cree_le: "2026-10-08", boutique: { nom: "Test", quartier: "Centre" }, photo: "a-v", tailles: ["M"], promo: { prixPromo: 2000, dateFin: "2026-11-01" } });
  });
  it("catalogue : mêmes filtres de visibilité, filtres exacts en base et lecture bornée", async () => {
    const { client, appels } = clientFactice([ligne]);
    const resultats = await chargerCatalogue(client, { categorie: "T-shirts et polos", genre: "homme", quartier: "Centre", taille: "M", promo: false, q: "polo" }, jour);
    expect(resultats).toHaveLength(1);
    expect(appels).toContainEqual(["eq", "boutiques.statut", "validee"]);
    expect(appels).toContainEqual(["gt", "derniere_confirmation", "2026-09-18T12:00:00.000Z"]);
    expect(appels).toContainEqual(["eq", "categorie", "T-shirts et polos"]);
    expect(appels).toContainEqual(["eq", "genre", "homme"]);
    expect(appels).toContainEqual(["eq", "boutiques.quartier", "Centre"]);
    expect(appels).toContainEqual(["eq", "filtre_taille.libelle", "M"]);
    expect(appels).toContainEqual(["range", 0, LIMITE_CATALOGUE - 1]);
    expect(String(appels.find(a => a[0] === "select")?.[1])).toContain("filtre_taille:tailles!inner");
  });
  it("catalogue : la recherche et le prix restent filtrés après lecture", async () => {
    const { client } = clientFactice([ligne]);
    expect(await chargerCatalogue(client, { q: "jean" }, jour)).toHaveLength(0);
  });
  it("options des filtres : valeurs publiques uniques et triées", async () => {
    const { client, appels } = clientFactice([{ categorie: "Robes", boutiques: { quartier: "Gambetta" }, tailles: [{ libelle: "S", disponible: true }] }, { categorie: "T-shirts et polos", boutiques: { quartier: "Centre" }, tailles: [{ libelle: "M", disponible: true }, { libelle: "XL", disponible: false }] }]);
    expect(await chargerOptionsCatalogue(client, jour)).toEqual({ categories: ["T-shirts et polos", "Robes"], tailles: ["M", "S"], quartiers: ["Centre", "Gambetta"] });
    expect(appels).toContainEqual(["eq", "boutiques.statut", "validee"]);
  });
});

describe("univers Femme / Homme / Enfant / Beauté", () => {
  const carte = (categorie: string, genre: string): CarteArticle => ({ ...article, categorie, genre });
  it("Femme et Homme : mode du genre ou mixte ; Enfant : mode enfant ; Beauté : catégories beauté", () => {
    expect(articleDansUnivers(carte("Robes", "femme"), "femme")).toBe(true);
    expect(articleDansUnivers(carte("Chaussures", "mixte"), "homme")).toBe(true);
    expect(articleDansUnivers(carte("Robes", "femme"), "homme")).toBe(false);
    expect(articleDansUnivers(carte("Chaussures", "mixte"), "enfant")).toBe(false);
    expect(articleDansUnivers(carte("Parfums", "femme"), "femme")).toBe(false);
    expect(articleDansUnivers(carte("Parfums", "mixte"), "beaute")).toBe(true);
    expect(filtrerCatalogue([carte("Parfums", "mixte"), carte("Robes", "femme")], { univers: "beaute" }, maintenant).map(a => a.categorie)).toEqual(["Parfums"]);
    expect(filtrerCatalogue([carte("Robes", "femme")], { univers: "inconnu" }, maintenant)).toHaveLength(1);
  });
  it("filtre l’univers dans la base (catégories et genres)", async () => {
    const { client, appels } = clientFactice([]);
    await chargerCatalogue(client, { univers: "femme" }, new Date("2026-10-08"));
    expect(appels).toContainEqual(["in", "genre", ["femme", "mixte"]]);
    expect(appels.find(a => a[0] === "in" && a[1] === "categorie")?.[2]).toContain("Robes");
    const beaute = clientFactice([]);
    await chargerCatalogue(beaute.client, { univers: "beaute" }, new Date("2026-10-08"));
    expect(beaute.appels).toContainEqual(["in", "categorie", ["Parfums", "Maquillage", "Soins visage et corps", "Cheveux", "Hammam et traditionnel"]]);
    expect(beaute.appels.some(a => a[1] === "genre")).toBe(false);
  });
  it("trie les catégories dans l’ordre de la liste, les inconnues à la fin", () => {
    expect(trierCategories(["Parfums", "Zèbre", "Robes", "T-shirts et polos", "Robes"])).toEqual(["T-shirts et polos", "Robes", "Parfums", "Zèbre"]);
  });
});

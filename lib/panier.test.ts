import { beforeEach, describe, expect, it, vi } from "vitest";
import { abonnerPanier, ajouterAuPanier, chargerPanierLocal, changerQuantitePanier, CLE_PANIER, ErreurAutreBoutique, ErreurPanier, lignesCommande, lirePanier, nombreArticlesPanier, noteCommandeValide, retirerDuPanier, sauverPanierLocal, totalPanier, type LignePanier, type Panier } from "./panier";

const boutique = { id: "b1", nom: "Boutique Amine" };
const polo: LignePanier = { articleId: "polo", titre: "Polo", taille: "M", quantite: 1, prix: 3500, photo: null };
const chemise: LignePanier = { articleId: "chemise", titre: "Chemise", taille: "L", quantite: 2, prix: 5200, photo: "https://exemple.fr/c.jpg" };
const panier = (): Panier => ({ boutiqueId: "b1", boutiqueNom: "Boutique Amine", lignes: [polo, chemise] });

beforeEach(() => localStorage.clear());

describe("panier d’une boutique (US-20.2)", () => {
  it("crée le panier au premier ajout et cumule la même taille", () => {
    const un = ajouterAuPanier(null, boutique, polo, 5);
    expect(un).toEqual({ boutiqueId: "b1", boutiqueNom: "Boutique Amine", lignes: [polo] });
    expect(ajouterAuPanier(un, boutique, { ...polo, quantite: 2 }, 5).lignes).toEqual([{ ...polo, quantite: 3 }]);
    expect(ajouterAuPanier(un, boutique, { ...polo, taille: "L" }, 5).lignes).toHaveLength(2);
  });
  it("refuse une autre boutique sauf si on remplace le panier", () => {
    const autre = { id: "b2", nom: "Maison Ilyes" };
    expect(() => ajouterAuPanier(panier(), autre, polo, 3)).toThrow(ErreurAutreBoutique);
    expect(() => ajouterAuPanier(panier(), autre, polo, 3)).toThrow("Boutique Amine");
    expect(ajouterAuPanier(panier(), autre, polo, 3, true)).toEqual({ boutiqueId: "b2", boutiqueNom: "Maison Ilyes", lignes: [polo] });
  });
  it("ne dépasse ni le stock, ni 10 pièces par ligne, ni 10 lignes", () => {
    expect(() => ajouterAuPanier(null, boutique, polo, 0)).toThrow("épuisée");
    expect(() => ajouterAuPanier(null, boutique, { ...polo, quantite: 2 }, 1)).toThrow("qu’une pièce");
    expect(() => ajouterAuPanier(null, boutique, { ...polo, quantite: 10 }, 50)).not.toThrow();
    expect(() => ajouterAuPanier(ajouterAuPanier(null, boutique, { ...polo, quantite: 10 }, 50), boutique, polo, 50)).toThrow("au plus 10 pièces");
    expect(() => ajouterAuPanier(null, boutique, { ...polo, quantite: 0 }, 5)).toThrow(ErreurPanier);
    let plein: Panier | null = null;
    for (let i = 0; i < 10; i++) plein = ajouterAuPanier(plein, boutique, { ...polo, articleId: `a${i}` }, 5);
    expect(() => ajouterAuPanier(plein, boutique, { ...polo, articleId: "a10" }, 5)).toThrow("au plus 10 articles");
  });
  it("modifie une quantité dans les bornes et retire une ligne", () => {
    expect(changerQuantitePanier(panier(), "polo", "M", 4).lignes[0].quantite).toBe(4);
    expect(changerQuantitePanier(panier(), "polo", "M", 0).lignes[0].quantite).toBe(1);
    expect(changerQuantitePanier(panier(), "polo", "M", 99).lignes[0].quantite).toBe(10);
    expect(retirerDuPanier(panier(), "polo", "M")?.lignes).toEqual([chemise]);
    expect(retirerDuPanier({ ...panier(), lignes: [polo] }, "polo", "M")).toBeNull();
  });
  it("calcule le total, le nombre d’articles et les lignes envoyées à la base", () => {
    expect(totalPanier(panier())).toBe(3500 + 2 * 5200);
    expect(totalPanier(null)).toBe(0);
    expect(nombreArticlesPanier(panier())).toBe(3);
    expect(lignesCommande(panier())).toEqual([{ article_id: "polo", taille: "M", quantite: 1 }, { article_id: "chemise", taille: "L", quantite: 2 }]);
  });
  it("vérifie la longueur de la note", () => {
    expect(noteCommandeValide("Je passe samedi")).toBe(true);
    expect(noteCommandeValide("x".repeat(301))).toBe(false);
  });
  it("ignore un panier enregistré invalide", () => {
    expect(lirePanier(null)).toBeNull();
    expect(lirePanier("{pas du json")).toBeNull();
    expect(lirePanier(JSON.stringify({ boutiqueId: "b1", lignes: [] }))).toBeNull();
    expect(lirePanier(JSON.stringify({ ...panier(), lignes: [polo, { ...chemise, quantite: 50 }, { ...polo, prix: "3500" }] }))?.lignes).toEqual([polo]);
  });
  it("enregistre le panier dans le navigateur et prévient les abonnés", () => {
    const rappel = vi.fn(); const desabonner = abonnerPanier(rappel);
    sauverPanierLocal(panier());
    expect(JSON.parse(localStorage.getItem(CLE_PANIER)!)).toEqual(panier());
    expect(chargerPanierLocal()).toEqual(panier());
    sauverPanierLocal(null);
    expect(localStorage.getItem(CLE_PANIER)).toBeNull();
    expect(rappel).toHaveBeenCalledTimes(2);
    desabonner(); sauverPanierLocal(panier()); expect(rappel).toHaveBeenCalledTimes(2);
  });
});

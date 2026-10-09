import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { chargerImagesAccueil, choisirImagesAccueil, lienCategorie, PIECES_PHARES, type LigneAccueil } from "./accueil";
import { CATEGORIES_ARTICLE } from "./article";

const photo = (nom: string, ordre = 0, vignette: string | null = `${nom}-vignette.jpg`) => ({ adresse: `${nom}.jpg`, adresse_vignette: vignette, ordre });
const ligne = (id: string, categorie: string, genre: string, photos = [photo(id)]): LigneAccueil => ({ id, titre: `Article ${id}`, categorie, genre, photos });

describe("images de la page d’accueil", () => {
  it("grande photo = grande photo du dernier article avec photo ; tuiles = miniature du dernier article de chaque univers", () => {
    const images = choisirImagesAccueil([ligne("sans-photo", "Robes", "femme", []), ligne("parfum", "Parfums", "mixte"), ligne("robe", "Robes", "femme"), ligne("chemise", "Chemises", "mixte", [photo("c2", 1), photo("c1", 0, null)])]);
    expect(images.grande).toEqual({ adresse: "parfum.jpg", titre: "Article parfum", articleId: "parfum" });
    expect(images.univers.map(u => [u.nom, u.lien, u.image?.adresse ?? null])).toEqual([
      ["Femme", "/catalogue?univers=femme", "robe-vignette.jpg"],
      ["Homme", "/catalogue?univers=homme", "c1.jpg"],
      ["Enfant", "/catalogue?univers=enfant", null],
      ["Beauté", "/catalogue?univers=beaute", "parfum-vignette.jpg"],
    ]);
  });
  it("pièces phares : catégories de la liste, miniature du dernier article ou tuile unie", () => {
    expect(PIECES_PHARES.every(c => CATEGORIES_ARTICLE.some(x => x === c))).toBe(true);
    const images = choisirImagesAccueil([ligne("robe-recente", "Robes", "femme"), ligne("robe-ancienne", "Robes", "femme")]);
    expect(images.categories).toHaveLength(PIECES_PHARES.length);
    expect(images.categories[0]).toEqual({ nom: "Robes", lien: "/catalogue?categorie=Robes", image: { adresse: "robe-recente-vignette.jpg", titre: "Article robe-recente", articleId: "robe-recente" } });
    expect(images.categories.filter(c => !c.image)).toHaveLength(PIECES_PHARES.length - 1);
    expect(lienCategorie("Abayas, djellabas, kamis")).toBe("/catalogue?categorie=Abayas%2C+djellabas%2C+kamis");
  });
  it("sans article : aucune grande photo, toutes les tuiles unies", () => {
    const images = choisirImagesAccueil([]);
    expect(images.grande).toBeNull();
    expect([...images.univers, ...images.categories].every(t => t.image === null)).toBe(true);
  });
  it("lit uniquement les articles visibles du public, bornés, et ne casse pas l’accueil en cas d’erreur", async () => {
    const appels: unknown[][] = [];
    let resultat: { data: unknown; error: unknown } = { data: [ligne("robe", "Robes", "femme")], error: null };
    const requete: Record<string, unknown> = {};
    for (const m of ["select", "in", "eq", "gt", "order"]) requete[m] = (...args: unknown[]) => { appels.push([m, ...args]); return requete; };
    requete.range = async (...args: unknown[]) => { appels.push(["range", ...args]); return resultat; };
    const client = { from: () => requete } as unknown as SupabaseClient<Database>;
    expect((await chargerImagesAccueil(client, new Date("2026-10-09T12:00:00Z"))).grande?.articleId).toBe("robe");
    expect(appels).toContainEqual(["in", "statut", ["disponible", "reserve"]]);
    expect(appels).toContainEqual(["eq", "boutiques.statut", "validee"]);
    expect(appels).toContainEqual(["gt", "derniere_confirmation", "2026-09-18T12:00:00.000Z"]);
    expect(appels).toContainEqual(["range", 0, 199]);
    resultat = { data: null, error: { message: "réseau" } };
    expect((await chargerImagesAccueil(client)).grande).toBeNull();
  });
});

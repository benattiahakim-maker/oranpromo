import { describe, expect, it, vi } from "vitest";
import { boutiquesSuivies, compterMesBoutiques, compterPromos, erreurAbonnement, estSuivie, lireAbonnesBoutique, listerMesBoutiques, texteAbonnes, uuidValide } from "./abonnements";

const maintenant = new Date("2026-10-10T10:00:00Z");
const demain = "2026-10-11T10:00:00Z";
const hier = "2026-10-09T10:00:00Z";
const boutique = (id: string, statut = "validee", articles: { statut: string; promos: unknown }[] = []) =>
  ({ id, nom: `Boutique ${id}`, slug: `boutique-${id}`, quartier: "Akid Lotfi", statut, villes: [{ nom: "Oran", nom_ar: "وهران" }], articles });

describe("US-31.2 : boutiques suivies", () => {
  it("erreurs de la base → texte affiché", () => {
    expect(erreurAbonnement({ code: "54000" })).toBe("plafond");
    expect(erreurAbonnement({ code: "P0002" })).toBe("introuvable");
    expect(erreurAbonnement({ code: "42501" })).toBe("reserve");
    expect(erreurAbonnement({ code: "XX000" })).toBe("erreur");
    expect(erreurAbonnement(null)).toBe("erreur");
  });

  it("identifiant de boutique : uuid seulement", () => {
    expect(uuidValide("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(uuidValide("x")).toBe(false);
    expect(uuidValide(42)).toBe(false);
  });

  it("promos en cours : article disponible et promo non finie (objet ou tableau)", () => {
    expect(compterPromos([
      { statut: "disponible", promos: { prix_promo: 100, date_fin: demain } },
      { statut: "disponible", promos: [{ prix_promo: 100, date_fin: demain }] },
      { statut: "disponible", promos: { prix_promo: 100, date_fin: hier } },
      { statut: "reserve", promos: { prix_promo: 100, date_fin: demain } },
      { statut: "disponible", promos: null },
    ], maintenant)).toBe(2);
    expect(compterPromos(null, maintenant)).toBe(0);
  });

  it("boutique suspendue ou disparue masquée, plus récente en premier, ville lue", () => {
    const lignes = [
      { cree_le: "2026-10-01T00:00:00Z", boutiques: boutique("a") },
      { cree_le: "2026-10-05T00:00:00Z", boutiques: boutique("b", "validee", [{ statut: "disponible", promos: { prix_promo: 1, date_fin: demain } }]) },
      { cree_le: "2026-10-06T00:00:00Z", boutiques: boutique("c", "suspendue") },
      { cree_le: "2026-10-07T00:00:00Z", boutiques: null },
    ];
    const liste = boutiquesSuivies(lignes as never, maintenant);
    expect(liste.map(b => b.id)).toEqual(["b", "a"]);
    expect(liste[0]).toEqual({ id: "b", nom: "Boutique b", slug: "boutique-b", quartier: "Akid Lotfi", ville: { nom: "Oran", nom_ar: "وهران" }, promos: 1 });
  });

  it("lecture par la base : erreur → message, comptage filtré sur les boutiques validées", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(listerMesBoutiques({ from: () => ({ select }) } as never)).rejects.toThrow("Impossible de charger vos boutiques");
    const eq = vi.fn().mockResolvedValue({ count: 3, error: null });
    const selectCompte = vi.fn(() => ({ eq }));
    expect(await compterMesBoutiques({ from: () => ({ select: selectCompte }) } as never)).toBe(3);
    expect(selectCompte).toHaveBeenCalledWith("boutique_id, boutiques!inner(statut)", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("boutiques.statut", "validee");
    expect(await compterMesBoutiques({} as never)).toBe(0);
    const maybeSingle = vi.fn().mockResolvedValue({ data: { boutique_id: "b" }, error: null });
    expect(await estSuivie({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } as never, "b")).toBe(true);
  });

  it("US-31.3 : compteur de l'espace (un nombre seulement), masqué si la lecture échoue", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total: 12, sept_jours: 3 }, error: null });
    expect(await lireAbonnesBoutique({ rpc } as never)).toEqual({ total: 12, sept_jours: 3 });
    expect(rpc).toHaveBeenCalledWith("abonnes_boutique");
    expect(await lireAbonnesBoutique({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }) } as never)).toBeNull();
    expect(await lireAbonnesBoutique({ rpc: vi.fn().mockResolvedValue({ data: { total: "x" }, error: null }) } as never)).toBeNull();
    expect(await lireAbonnesBoutique({} as never)).toBeNull();
    expect(texteAbonnes({ total: 12, sept_jours: 3 })).toBe("12 clients suivent votre boutique · +3 cette semaine");
    expect(texteAbonnes({ total: 1, sept_jours: 0 })).toBe("1 client suit votre boutique");
    expect(texteAbonnes({ total: 0, sept_jours: 0 })).toBe("Aucun client ne suit encore votre boutique.");
  });
});

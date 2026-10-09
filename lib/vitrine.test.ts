import { describe, expect, it } from "vitest";
import { positionBoutique, trierArticlesVitrine } from "./vitrine";

describe("vitrine (US-01)", () => {
  it("classe les promos actives avant les autres, puis les articles les plus récents", () => {
    const articles = [
      { id: "expiree", cree_le: "2026-10-08", promo: { prixPromo: 10, dateFin: "2026-10-01" } },
      { id: "active", cree_le: "2026-10-01", promo: { prixPromo: 10, dateFin: "2026-11-01" } },
      { id: "normal", cree_le: "2026-10-07", promo: null },
    ];
    expect(trierArticlesVitrine(articles, new Date("2026-10-08")).map(a => a.id)).toEqual(["active", "expiree", "normal"]);
    expect(articles[0].id).toBe("expiree");
  });
  it("préfère les coordonnées et utilise l’adresse en secours", () => {
    expect(positionBoutique(0, 0, null, "Centre")).toBe("0,0");
    expect(positionBoutique(null, null, "1 rue du Port", "Centre")).toBe("1 rue du Port, Centre, Oran, Algérie");
  });
});

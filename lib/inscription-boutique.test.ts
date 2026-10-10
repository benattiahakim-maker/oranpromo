import { describe, expect, it, vi } from "vitest";
import { lienInscription, lireOffre, lireOffreInscription, lireResultatInscription, slugDuLien } from "./inscription-boutique";

describe("US-31.3 : inscription en boutique", () => {
  it("lien de l'affiche sur le site public", () => {
    expect(lienInscription("chez-amine", "https://bledeal.dz/")).toBe("https://bledeal.dz/i/chez-amine");
    expect(lienInscription("chez-amine", "javascript:alert(1)")).toBe("http://localhost:3000/i/chez-amine");
  });
  it("slug lu dans l'adresse", () => {
    expect(slugDuLien("chez-amine")).toBe("chez-amine");
    expect(slugDuLien("CHEZ-AMINE")).toBe("chez-amine");
    expect(slugDuLien("%E0%A4%A")).toBeNull();
    expect(slugDuLien("../x")).toBeNull();
  });
  it("réponse de la base lue prudemment", () => {
    expect(lireResultatInscription({ suivie_nouvelle: true, rattache: true })).toEqual({ suivie_nouvelle: true, rattache: true, bon: null });
    expect(lireResultatInscription(null)).toEqual({ suivie_nouvelle: false, rattache: false, bon: null });
    expect(lireResultatInscription({ rattache: "oui" })).toEqual({ suivie_nouvelle: false, rattache: false, bon: null });
  });
  it("US-31.4 : bon de bienvenue au rattachement (donne, numero, sinon rien)", () => {
    expect(lireResultatInscription({ rattache: true, bon: "donne" }).bon).toBe("donne");
    expect(lireResultatInscription({ rattache: true, bon: "numero" }).bon).toBe("numero");
    expect(lireResultatInscription({ rattache: true, bon: "plafond" }).bon).toBeNull();
  });
  it("US-31.4 : offre du bandeau lue prudemment ; erreur ou offre fermée : rien", async () => {
    expect(lireOffre({ montant: 500, minimum_achat: 4000 })).toEqual({ montant: 500, minimum_achat: 4000 });
    expect(lireOffre(null)).toBeNull();
    expect(lireOffre({ montant: "500", minimum_achat: 4000 })).toBeNull();
    const rpc = vi.fn().mockResolvedValue({ data: { montant: 500, minimum_achat: 4000 }, error: null });
    expect(await lireOffreInscription({ rpc } as never, "chez-amine")).toEqual({ montant: 500, minimum_achat: 4000 });
    expect(rpc).toHaveBeenCalledWith("offre_inscription", { slug_boutique: "chez-amine" });
    expect(await lireOffreInscription({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) } as never, "x")).toBeNull();
    expect(await lireOffreInscription({ rpc: vi.fn().mockRejectedValue(new Error("x")) } as never, "x")).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { ajouterCodeBon, lireCampagnesOuvertes, lireRaisonsBonsPanier, normaliserCodeBon, reponseCode } from "./campagnes";
import { texteBandeau } from "@/components/BandeauCampagne";
import { fr } from "./textes/fr";
import { ar } from "./textes/ar";

const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error })) }) as never;

describe("US-33.3 : campagnes avec code", () => {
  it("code saisi : espaces retirés, majuscules, 4 à 16 lettres ou chiffres", () => {
    expect(normaliserCodeBon(" aid 2026 ")).toBe("AID2026");
    expect([normaliserCodeBon("AB1"), normaliserCodeBon("AID-2026"), normaliserCodeBon(12), normaliserCodeBon("A".repeat(17))]).toEqual([null, null, null, null]);
  });
  it("réponse de la base : états connus seulement", () => {
    expect(reponseCode({ etat: "ajoute", montant: 500 })).toEqual({ etat: "ajoute", montant: 500 });
    expect([reponseCode({ etat: "autre" }), reponseCode(null)]).toEqual([null, null]);
  });
  it("ajouter_code_bon et campagnes_ouvertes appelés avec le code et la ville", async () => {
    const c = client({ etat: "deja" });
    expect(await ajouterCodeBon(c, "AID2026")).toEqual({ etat: "deja" });
    expect((c as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("ajouter_code_bon", { code: "AID2026" });
    const v = client([{ code: "AID2026" }]);
    expect(await lireCampagnesOuvertes(v, "oran")).toEqual([{ code: "AID2026" }]);
    expect((v as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("campagnes_ouvertes", { ville: "oran" });
    await expect(ajouterCodeBon(client(null, { message: "x" }), "AID2026")).rejects.toThrow("Impossible d’ajouter ce code");
  });
  it("raisons du panier : seulement les raisons connues", async () => {
    expect(await lireRaisonsBonsPanier(client([{ id: "a", raison: "univers" }, { id: "b", raison: "ok" }, { id: "c", raison: "piratage" }, { raison: "ok" }]), "b1", []))
      .toEqual({ a: "univers", b: "ok" });
  });
  it("bandeau (texte n° 14), en français et en arabe, avec ou sans date de fin", () => {
    const aid = { nom_fr: "Aïd", nom_ar: "العيد", code: "AID2026", montant: 500, minimum_achat: 4000, univers: null, villes: [], debut: "2026-05-20T10:00:00Z", fin: "2026-06-05T20:00:00Z" };
    expect(texteBandeau(aid, fr.parrainage, "fr")).toMatch(/^Aïd : 500\sDA offerts dès 4\s000\sDA d’achat avec le code AID2026, jusqu’au 5\/6\.$/);
    expect(texteBandeau({ ...aid, fin: null }, fr.parrainage, "fr")).toMatch(/avec le code AID2026\.$/);
    expect(texteBandeau(aid, ar.parrainage, "ar").replace(/[\u2066-\u2069]/g, "")).toMatch(/^العيد : 500\sدج هدية كي تشري 4\s000\sدج ولا كثر بالكود AID2026، حتى 5\/6\.$/);
  });
});

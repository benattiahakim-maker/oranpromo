import { describe, expect, it, vi } from "vitest";
import { bonPourTotal, estBonProgramme, formaterJourMoisNumerique, minimumBon, aEncaisser, bonApplicable, releveDuMois, bonDisponible, etatBon, formaterJourCourt, formaterJourMois, moisAlger, nomMois, premierDuMoisSuivant, raisonBonNonApplique, resultatBon, utiliserBon, type BonClient } from "./bons";

describe("bons de parrainage (US-27)", () => {
  it("montant à encaisser = total − bon", () => {
    expect(aEncaisser(3500, 300)).toBe(3200);
    expect(aEncaisser(3500, 0)).toBe(3500);
    expect(aEncaisser(3500, null)).toBe(3500);
    expect(aEncaisser(200, 300)).toBe(0);
  });

  it("bon utilisable dès 1 000 DA, seulement s'il y en a un", () => {
    expect(bonApplicable(1000, true)).toBe(true);
    expect(bonApplicable(999, true)).toBe(false);
    expect(bonApplicable(5000, false)).toBe(false);
  });

  it("réponses de la base reconnues, le reste rejeté", () => {
    expect(resultatBon("applique")).toBe("applique");
    expect(resultatBon("minimum")).toBe("minimum");
    expect(resultatBon("autre")).toBeNull();
    // US-33.1 : nouvelles raisons des bons de bienvenue et de campagne.
    expect(["univers", "ville", "plafond_boutique"].map(resultatBon)).toEqual(["univers", "ville", "plafond_boutique"]);
    expect(resultatBon(null)).toBeNull();
  });

  it("mois et 1er du mois suivant à l'heure d'Alger", () => {
    // 31 octobre 23 h 30 UTC = 1er novembre 0 h 30 à Alger (UTC+1).
    expect(moisAlger(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(moisAlger(new Date("2026-10-31T22:30:00Z"))).toBe("2026-10-01");
    expect(premierDuMoisSuivant(new Date("2026-10-15T12:00:00Z"))).toBe("2026-11-01");
    expect(premierDuMoisSuivant(new Date("2026-12-15T12:00:00Z"))).toBe("2027-01-01");
  });
});

const bon = (extra: Partial<BonClient> = {}): BonClient => ({ id: "b1", montant: 300, statut: "disponible", origine: "parrainage_filleul", cree_le: "2026-10-12T10:00:00Z",
  expire_le: "2026-12-11T10:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null, ...extra });
const maintenant = new Date("2026-10-20T10:00:00Z");

describe("US-27.3 : « Mes bons »", () => {
  it("dates : « 11 décembre », « 1er novembre », « 12/10 », nom du mois", () => {
    expect(formaterJourMois("2026-12-11T10:00:00Z")).toBe("11 décembre");
    expect(formaterJourMois("2026-11-01")).toBe("1er novembre");
    expect(formaterJourMois("2026-12-11T10:00:00Z", "ar")).toBe("11 ديسمبر");
    expect(formaterJourCourt("2026-10-12T10:00:00Z")).toBe("12/10");
    expect(nomMois("2026-11-01")).toBe("novembre");
  });
  it("états : disponible, réservé, utilisé, expiré, en file, annulé", () => {
    expect(etatBon(bon(), "fr", maintenant)).toEqual({ cle: "disponible", valeurs: { date: "11 décembre" }, actif: true });
    expect(etatBon(bon({ statut: "reserve", numero: 128 }), "fr", maintenant)).toEqual({ cle: "reserve", valeurs: { n: 128 }, actif: true });
    expect(etatBon(bon({ statut: "utilise", utilise_le: "2026-10-12T15:00:00Z", boutique: "Boutique Nour" }), "fr", maintenant)).toEqual({ cle: "utilise", valeurs: { date: "12/10", boutique: "Boutique Nour" }, actif: false });
    expect(etatBon(bon({ statut: "expire" }), "fr", maintenant)).toMatchObject({ cle: "expire", valeurs: { date: "11/12" } });
    expect(etatBon(bon({ statut: "en_file", expire_le: null }), "fr", maintenant)).toEqual({ cle: "enFile", valeurs: { date: "1er novembre" }, actif: true });
    expect(etatBon(bon({ statut: "annule" }), "fr", maintenant).cle).toBe("annule");
    // Disponible mais date passée (la tâche du soir ne l'a pas encore expiré) : affiché expiré.
    expect(etatBon(bon({ expire_le: "2026-10-19T10:00:00Z" }), "fr", maintenant).cle).toBe("expire");
  });
  it("bon utilisable au panier : disponible, non expiré, celui qui finit le plus tôt", () => {
    expect(bonDisponible([], maintenant)).toBeNull();
    expect(bonDisponible([bon({ statut: "reserve" }), bon({ statut: "en_file", expire_le: null })], maintenant)).toBeNull();
    expect(bonDisponible([bon({ expire_le: "2026-10-19T10:00:00Z" })], maintenant)).toBeNull();
    expect(bonDisponible([bon({ id: "tard" }), bon({ id: "tot", expire_le: "2026-11-30T10:00:00Z" })], maintenant)?.id).toBe("tot");
  });
});

describe("US-27.4 : bon posé après la commande", () => {
  it("réponse de utiliser_bon ; erreur ou réponse inconnue → « erreur » (la commande reste au prix plein)", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: "applique", error: null }).mockResolvedValueOnce({ data: "aucun_bon", error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "x" } }).mockResolvedValueOnce({ data: "autre", error: null }).mockRejectedValueOnce(new Error("réseau"));
    const client = { rpc } as never;
    expect(await utiliserBon(client, "c1")).toBe("applique");
    expect(await utiliserBon(client, "c1")).toBe("aucun_bon");
    expect(await utiliserBon(client, "c1")).toBe("erreur");
    expect(await utiliserBon(client, "c1")).toBe("erreur");
    expect(await utiliserBon(client, "c1")).toBe("erreur");
    expect(rpc).toHaveBeenCalledWith("utiliser_bon", { commande: "c1" });
  });
  it("raison affichée sur le suivi : seulement les valeurs connues", () => {
    expect(raisonBonNonApplique("minimum")).toBe("minimum");
    expect(raisonBonNonApplique("erreur")).toBe("erreur");
    expect(raisonBonNonApplique("applique")).toBeNull();
    expect(raisonBonNonApplique("<script>")).toBeNull();
    expect(raisonBonNonApplique(undefined)).toBeNull();
  });
});

describe("US-27.4 : relevé de remboursement nommé pour la boutique", () => {
  it("« relevé de novembre », « relevé d’octobre », « relevé d’août »", () => {
    expect(releveDuMois("2026-11-01")).toBe("relevé de novembre");
    expect(releveDuMois("2026-10-01")).toBe("relevé d’octobre");
    expect(releveDuMois("2026-08-01")).toBe("relevé d’août");
    expect(releveDuMois("2026-04-01")).toBe("relevé d’avril");
  });
});

describe("US-33.2 : bons de programme", () => {
  const b = (id: string, montant: number, minimum: number | undefined, origine: BonClient["origine"], expire = "2026-11-09T10:00:00Z", statut: BonClient["statut"] = "disponible"): BonClient =>
    ({ id, montant, statut, origine, cree_le: "2026-10-10T10:00:00Z", expire_le: expire, utilise_le: null, commande: null, numero: null, boutique: null, minimum_achat: minimum });
  const maintenant = new Date("2026-10-20T10:00:00Z");
  it("minimum : celui du bon, 1 000 DA par défaut (parrainage)", () => {
    expect(minimumBon(b("p", 300, undefined, "parrainage_filleul"))).toBe(1000);
    expect(minimumBon(b("w", 300, 2000, "bienvenue"))).toBe(2000);
    expect([estBonProgramme(b("w", 300, 2000, "bienvenue")), estBonProgramme(b("p", 300, 1000, "parrainage_parrain"))]).toEqual([true, false]);
  });
  it("le plus gros bon utilisable, puis le plus proche de l'échéance ; sinon le plus petit minimum, non applicable", () => {
    const bons = [b("p", 300, 1000, "parrainage_filleul", "2026-11-30T10:00:00Z"), b("w", 300, 2000, "bienvenue", "2026-11-09T10:00:00Z"), b("a", 500, 4000, "campagne")];
    expect(bonPourTotal(bons, 5000, maintenant)).toEqual({ bon: bons[2], applicable: true });
    expect(bonPourTotal(bons, 2500, maintenant)).toEqual({ bon: bons[1], applicable: true });
    expect(bonPourTotal(bons, 1500, maintenant)).toEqual({ bon: bons[0], applicable: true });
    expect(bonPourTotal(bons.slice(1), 1500, maintenant)).toEqual({ bon: bons[1], applicable: false });
    expect(bonPourTotal([b("x", 300, 2000, "bienvenue", "2026-10-19T10:00:00Z"), b("y", 300, 2000, "bienvenue", undefined, "reserve")], 5000, maintenant)).toBeNull();
  });
  it("date courte « 9/11 » (heure d'Alger)", () => {
    expect(formaterJourMoisNumerique("2026-11-09T10:00:00Z")).toBe("9/11");
    expect(formaterJourMoisNumerique("2026-11-30T23:30:00Z")).toBe("1/12");
  });
});

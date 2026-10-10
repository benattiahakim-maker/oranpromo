import { describe, expect, it, vi } from "vitest";
import { arreterProgramme, CAMPAGNE_PAR_DEFAUT, conditionsProgramme, creerCampagne, debutDuJour, etatProgramme, finDuJour, lireSignaux, listerProgrammes, resumeProgramme, textesSignal, validerCampagne, type ProgrammeAdmin, type SaisieCampagne, type SignalBoutique } from "./bons-admin";

const prog = (x: Partial<ProgrammeAdmin> = {}): ProgrammeAdmin => ({ id: "p1", type: "campagne", nom_fr: "Aïd 2026", nom_ar: "عيد 2026", code: "AID26", montant: 500, minimum_achat: 4000,
  univers: "femme", villes: ["oran"], debut: "2026-05-24T23:00:00Z", fin: "2026-06-05T23:00:00Z", validite_jours: 10, budget: 200000, plafond_par_boutique: 30,
  actif: true, ouvert: true, emis: 412, utilises: 233, rembourse: 116500, restant: 93500, ...x });
const saisie = (x: Partial<SaisieCampagne> = {}): SaisieCampagne => ({ nom_fr: " Aïd 2026 ", nom_ar: "عيد 2026", code: "aid 26", montant: "500", minimum: "4 000", univers: "femme",
  villes: ["oran", "oran"], debut: "2026-05-25", fin: "2026-06-05", validite: "10", budget: "200000", plafond: "30", ...x });
const client = (r: { data?: unknown; error?: { message: string } | null }) => { const rpc = vi.fn().mockResolvedValue({ data: r.data ?? null, error: r.error ?? null }); return { rpc, c: { rpc } as never }; };

describe("US-33.5 : décisions par défaut", () => {
  it("500 DA, plafond 30 bons par boutique", () => { expect(CAMPAGNE_PAR_DEFAUT).toMatchObject({ montant: 500, plafond: 30 }); });
});

describe("US-33.5 : dates (Algérie, UTC+1)", () => {
  it("début à 0 h, fin incluse = lendemain 0 h", () => {
    expect(debutDuJour("2026-05-25")).toBe("2026-05-25T00:00:00+01:00");
    expect(finDuJour("2026-06-05")).toBe("2026-06-05T23:00:00.000Z");
    expect(finDuJour("2026-12-31")).toBe("2026-12-31T23:00:00.000Z");
  });
});

describe("US-33.5 : validerCampagne", () => {
  it("normalise : noms, code en majuscules sans espace, montants, villes uniques, dates", () => {
    const r = validerCampagne(saisie(), ["oran", "tlemcen"]);
    expect(r).toEqual({ args: { nom_fr: "Aïd 2026", nom_ar: "عيد 2026", code: "AID26", montant: 500, minimum_achat: 4000, univers: "femme", villes: ["oran"],
      debut: "2026-05-25T00:00:00+01:00", fin: "2026-06-05T23:00:00.000Z", validite_jours: 10, budget: 200000, plafond_par_boutique: 30 } });
  });
  it("refuse chaque champ faux avec un message", () => {
    const v = (x: Partial<SaisieCampagne>) => { const r = validerCampagne(saisie(x), ["oran"]); return "erreur" in r ? r.erreur : "ok"; };
    expect(v({ nom_ar: "" })).toBe("Nom en français et en arabe : 2 à 40 caractères.");
    expect(v({ code: "A-1" })).toBe("Code : 4 à 16 lettres ou chiffres, sans espace.");
    expect(v({ montant: "0" })).toBe("Montant : de 1 à 5 000 DA.");
    expect(v({ montant: "abc" })).toBe("Montant : de 1 à 5 000 DA.");
    expect(v({ minimum: "300" })).toBe("Le minimum d’achat doit être au moins égal au montant du bon.");
    expect(v({ univers: "auto" })).toBe("Univers inconnu.");
    expect(v({ villes: ["paris"] })).toBe("Ville inconnue.");
    expect(v({ fin: "" })).toBe("Indiquez les dates de début et de fin.");
    expect(v({ fin: "2026-05-24" })).toBe("La fin doit être après le début.");
    expect(v({ validite: "0" })).toBe("Validité du bon : de 1 à 365 jours.");
    expect(v({ budget: "100" })).toBe("Le budget doit permettre au moins un bon.");
    expect(v({ plafond: "0" })).toBe("Plafond par boutique : au moins 1 bon.");
    expect(v({ univers: "", villes: [], fin: "2026-05-25" })).toBe("ok");
  });
});

describe("US-33.5 : affichage", () => {
  const maintenant = new Date("2026-05-30T10:00:00Z");
  it("état : Active, Arrêtée, À venir, Terminée", () => {
    expect(etatProgramme(prog(), maintenant)).toBe("Active");
    expect(etatProgramme(prog({ actif: false }), maintenant)).toBe("Arrêtée");
    expect(etatProgramme(prog({ debut: "2026-06-01T00:00:00Z" }), maintenant)).toBe("À venir");
    expect(etatProgramme(prog({ fin: "2026-05-30T09:00:00Z" }), maintenant)).toBe("Terminée");
    expect(etatProgramme(prog({ fin: null }), maintenant)).toBe("Active");
  });
  it("résumé : émis, utilisés, remboursé, reste (jamais négatif)", () => {
    expect(resumeProgramme(prog())).toBe("412 émis · 233 utilisés · 116 500 DA remboursés · reste 93 500 DA");
    expect(resumeProgramme(prog({ emis: 1, utilises: 1, rembourse: 0, restant: -500 }))).toBe("1 émis · 1 utilisé · 0 DA remboursés · reste 0 DA");
  });
  it("conditions : fin incluse, toutes les villes, sans fin", () => {
    expect(conditionsProgramme(prog())).toBe("500 DA dès 4 000 DA · Femme · oran · du 25/05 au 05/06 · bon valable 10 jours · plafond 30 bons par boutique");
    expect(conditionsProgramme(prog({ univers: null, villes: [], fin: null, plafond_par_boutique: null, montant: 300, minimum_achat: 2000 })))
      .toBe("300 DA dès 2 000 DA · toutes les villes · depuis le 25/05 · bon valable 10 jours");
  });
  it("signaux : phrases, rien si tout est à zéro", () => {
    const s: SignalBoutique = { boutique_id: "b", boutique: "Boutique Nour", slug: "boutique-nour", servis: 30, prix: 4, prix_le: "2026-05-21T10:00:00Z", nouveaux: 2,
      plafond: 30, plafond_jours: 2, comptes_recents: 22, remises_rapides: 1 };
    expect(textesSignal(s, prog())).toEqual([
      "Boutique Nour : prix de 4 articles augmentés de plus de 20 % le 21/05 (4 jours avant la campagne).",
      "Boutique Nour : 2 articles créés dans les 14 jours avant la campagne.",
      "Boutique Nour : 30 / 30 bons en 2 jours.",
      "Boutique Nour : 22 bons utilisés par des comptes de moins de 7 jours.",
      "Boutique Nour : 1 commande récupérée moins de 30 minutes après la commande.",
    ]);
    expect(textesSignal({ ...s, prix: 1, prix_le: "2026-05-28T10:00:00Z" }, prog())[0]).toBe("Boutique Nour : prix de 1 article augmenté de plus de 20 % le 28/05 (pendant la campagne).");
    expect(textesSignal({ ...s, prix: 0, nouveaux: 0, plafond: null, plafond_jours: null, comptes_recents: 0, remises_rapides: 0 }, prog())).toEqual([]);
  });
});

describe("US-33.5 : appels à la base", () => {
  it("lit les programmes et les signaux", async () => {
    const a = client({ data: [prog()] }); expect(await listerProgrammes(a.c)).toHaveLength(1); expect(a.rpc).toHaveBeenCalledWith("programmes_admin");
    const b = client({ data: [] }); expect(await lireSignaux(b.c, "p1")).toEqual([]); expect(b.rpc).toHaveBeenCalledWith("signaux_bons", { programme: "p1" });
    await expect(listerProgrammes(client({ error: { message: "x" } }).c)).rejects.toThrow("Impossible de charger les programmes. Réessayez.");
  });
  it("crée : message de la base gardé s'il est connu, sinon message général", async () => {
    const args = (validerCampagne(saisie(), ["oran"]) as { args: never }).args;
    const a = client({ data: "id-1" }); expect(await creerCampagne(a.c, args)).toBe("id-1"); expect(a.rpc).toHaveBeenCalledWith("creer_campagne", args);
    await expect(creerCampagne(client({ error: { message: "Ce code existe déjà." } }).c, args)).rejects.toThrow("Ce code existe déjà.");
    await expect(creerCampagne(client({ error: { message: "violates check constraint" } }).c, args)).rejects.toThrow("Campagne refusée : vérifiez les champs.");
  });
  it("arrête : vrai si arrêté, faux si déjà arrêté", async () => {
    expect(await arreterProgramme(client({ data: true }).c, "p1")).toBe(true);
    expect(await arreterProgramme(client({ data: false }).c, "p1")).toBe(false);
    await expect(arreterProgramme(client({ error: { message: "x" } }).c, "p1")).rejects.toThrow("Impossible d’arrêter ce programme. Réessayez.");
  });
});

describe("US-32.5 : programme à budget mensuel (« avis ») dans /admin/bons", () => {
  const avis = prog({ id: "pa", type: "avis", nom_fr: "Avis", code: null, montant: 150, minimum_achat: 1500, emis: 7, utilises: 2, rembourse: 300, restant: -50 });
  it("reste du mois lu par reste_mois_programmes, affiché « ce mois-ci » ; les autres programmes inchangés", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [prog(), avis], error: null }).mockResolvedValueOnce({ data: [{ id: "pa", restant: 850 }], error: null });
    const liste = await listerProgrammes({ rpc } as never);
    expect(rpc).toHaveBeenLastCalledWith("reste_mois_programmes");
    expect(liste.map(p => resumeProgramme(p))).toEqual([
      "412 émis · 233 utilisés · 116 500 DA remboursés · reste 93 500 DA",
      "7 émis · 2 utilisés · 300 DA remboursés · reste 850 DA ce mois-ci"]);
  });
  it("lecture du mois impossible : « reste du mois indisponible », jamais le reste total ; sans programme mensuel, un seul appel", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [avis], error: null }).mockResolvedValueOnce({ data: null, error: { message: "x" } });
    expect(resumeProgramme((await listerProgrammes({ rpc } as never))[0])).toBe("7 émis · 2 utilisés · 300 DA remboursés · reste du mois indisponible");
    const seul = vi.fn().mockResolvedValue({ data: [prog()], error: null });
    await listerProgrammes({ rpc: seul } as never); expect(seul).toHaveBeenCalledTimes(1);
  });
  it("reste du mois négatif affiché 0 DA", () => {
    expect(resumeProgramme({ ...avis, resteMois: -150 })).toBe("7 émis · 2 utilisés · 300 DA remboursés · reste 0 DA ce mois-ci");
  });
});

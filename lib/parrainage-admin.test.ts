import { describe, expect, it, vi } from "vitest";
import {
  champCsv, csvReleves, dateHeureAlger, derniersMois, etatReleveBoutique, libelleMois, masquerTelephone, moisDepuisParametre, nomFichierCsv,
  resumeBudget, resumeReleve, signalRemiseRapide, signauxParrainages, signauxReleve, validerMontantBudget, lireBudget, reglerBudget, marquerPaye,
  annulerBons, bonsAnnulables, MESSAGE_BUDGET_INVALIDE, type ParrainageAdmin, type ReleveAdmin, type LigneReleveAdmin,
} from "./parrainage-admin";

const maintenant = new Date("2026-10-09T18:00:00Z");

describe("US-27.5 mois et formats", () => {
  it("mois depuis l’URL, sinon mois courant (Alger)", () => {
    expect(moisDepuisParametre("2026-11", maintenant)).toBe("2026-11-01");
    expect(moisDepuisParametre(["2026-09"], maintenant)).toBe("2026-09-01");
    for (const v of ["2026-13", "x", "", undefined, "2025-12", "2026-1"]) expect(moisDepuisParametre(v, maintenant)).toBe("2026-10-01");
    expect(moisDepuisParametre(undefined, new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01"); // déjà le 1er à Alger
  });
  it("12 derniers mois, le plus récent d’abord, passage d’année", () => {
    const m = derniersMois(12, new Date("2026-02-10T12:00:00Z"));
    expect(m).toHaveLength(12); expect(m[0]).toBe("2026-02-01"); expect(m[1]).toBe("2026-01-01"); expect(m[2]).toBe("2025-12-01");
    expect(libelleMois("2026-10-01")).toBe("Octobre 2026");
  });
  it("date d’export JJ/MM/AAAA HH:MM heure d’Alger", () => {
    expect(dateHeureAlger("2026-10-05T13:32:00Z")).toBe("05/10/2026 14:32");
    expect(dateHeureAlger("2026-10-31T23:10:00Z")).toBe("01/11/2026 00:10");
  });
  it("numéro masqué, jamais en entier", () => {
    expect(masquerTelephone("+213555123456")).toBe("0555 •• •• 56");
    expect(masquerTelephone(null)).toBe("Sans numéro");
  });
});

describe("US-27.5 budget", () => {
  it("saisie du budget : entier de 0 à 10 000 000", () => {
    expect(validerMontantBudget("30 000")).toBe(30000);
    expect(validerMontantBudget("0")).toBe(0);
    expect(validerMontantBudget("45000 DA")).toBe(45000);
    for (const v of ["-1", "1,5", "abc", "", "10000001", "1e5"]) expect(() => validerMontantBudget(v)).toThrow(MESSAGE_BUDGET_INVALIDE);
  });
  it("résumé : émis sur budget, utilisés, en file ; 0 = aucun nouveau bon", () => {
    expect(resumeBudget({ mois: "2026-10-01", actif: false, budget: 30000, emis: 9600, utilise: 3600, en_file: 2, restant: 20400 }))
      .toBe("Budget d’octobre : 9 600 DA émis sur 30 000 DA · 3 600 DA utilisés · 2 parrainages en file");
    expect(resumeBudget({ mois: "2026-11-01", actif: true, budget: 0, emis: 0, utilise: 0, en_file: 0, restant: 0 }))
      .toBe("Budget de novembre : 0 DA, aucun nouveau bon · 0 DA émis · 0 DA utilisé");
  });
  it("lecture et réglage par les fonctions de la base ; refus de la base relayé", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { mois: "2026-10-01", actif: false, budget: 30000, emis: 600, utilise: 0, en_file: 0, restant: 29400 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Réservé à l'administrateur." } });
    const client = { rpc } as never;
    expect((await lireBudget(client)).budget).toBe(30000);
    expect(rpc).toHaveBeenCalledWith("budget_parrainage", {});
    await reglerBudget(client, 0);
    expect(rpc).toHaveBeenCalledWith("regler_budget_parrainage", { montant: 0 });
    await expect(reglerBudget(client, 5)).rejects.toThrow("Réservé à l'administrateur.");
  });
  it("erreur inattendue : message générique (pas de détail technique)", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "détail interne" } }) } as never;
    await expect(annulerBons(client, "f", "motif")).rejects.toThrow("Impossible d’annuler les bons. Réessayez.");
  });
  it("« Marquer comme payé » : date au format AAAA-MM-JJ, sinon rien n’est envoyé", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(marquerPaye({ rpc } as never, "r", "CCP 123", "05/10/2026")).rejects.toThrow("Date de paiement invalide.");
    expect(rpc).not.toHaveBeenCalled();
    await marquerPaye({ rpc } as never, "r", "CCP 123", "2026-11-05");
    expect(rpc).toHaveBeenCalledWith("marquer_releve_paye", { releve: "r", reference: "CCP 123", paye_le: "2026-11-05" });
  });
});

function parrainage(id: string, extra: Partial<ParrainageAdmin> = {}): ParrainageAdmin {
  return { filleul_id: id, parrain_id: "P", statut: "valide", cree_le: "2026-10-01T10:00:00Z", valide_le: "2026-10-05T10:00:00Z", motif: null,
    filleul: { id, nom: `Filleul ${id}`, telephone: "+213555000000", cree_le: `2026-10-0${id.length}T10:00:00Z`, parrainage_exclu: false, bloque: false },
    parrain: { id: "P", nom: "Parrain", telephone: "+213661000000", cree_le: "2026-09-01T10:00:00Z", parrainage_exclu: false, bloque: false },
    commande: { numero: 1, total: 3500, mode_remise: "qr", cree_le: "2026-10-04T10:00:00Z", prete_le: "2026-10-04T12:00:00Z", terminee_le: "2026-10-05T10:00:00Z" },
    boutique: { id: "B", nom: "Boutique Nour", bons_acceptes: true }, bons: [], ...extra };
}

describe("US-27.5 signaux de triche (jamais bloquants)", () => {
  it("aucun signal pour un parrainage normal", () => {
    expect(signauxParrainages([parrainage("a")]).get("a")).toEqual([]);
  });
  it("remise rapide : < 15 min après Prête ou < 30 min après la commande", () => {
    expect(signalRemiseRapide({ cree_le: "2026-10-05T09:00:00Z", prete_le: "2026-10-05T09:50:00Z", terminee_le: "2026-10-05T09:59:00Z" })).toBe("Remise 9 min après « Prête »");
    expect(signalRemiseRapide({ cree_le: "2026-10-05T09:40:00Z", prete_le: null, terminee_le: "2026-10-05T09:59:00Z" })).toBe("Remise 19 min après la commande");
    expect(signalRemiseRapide({ cree_le: "2026-10-05T08:00:00Z", prete_le: "2026-10-05T09:00:00Z", terminee_le: "2026-10-05T09:20:00Z" })).toBeNull();
  });
  it("3 filleuls d’un parrain validés chez la même boutique le même mois", () => {
    const s = signauxParrainages([parrainage("a"), parrainage("bb"), parrainage("ccc")]);
    expect(s.get("a")).toContain("3 filleuls du même parrain validés chez Boutique Nour ce mois-là");
    const deux = signauxParrainages([parrainage("a"), parrainage("bb")]);
    expect(deux.get("a")!.some(x => x.includes("validés chez"))).toBe(false);
  });
  it("premières commandes calibrées (2 000 à 2 200 DA) plusieurs fois pour un parrain", () => {
    const c = (t: number) => ({ numero: 1, total: t, mode_remise: "qr", cree_le: "2026-10-04T10:00:00Z", prete_le: "2026-10-04T12:00:00Z", terminee_le: "2026-10-05T10:00:00Z" });
    const s = signauxParrainages([parrainage("a", { commande: c(2050) }), parrainage("bb", { commande: c(2200) }), parrainage("ccc", { commande: c(2300) })]);
    expect(s.get("a")).toContain("Première commande juste au-dessus de 2 000 DA (2 fois pour ce parrain)");
    expect(s.get("ccc")!.some(x => x.includes("2 000 DA"))).toBe(false);
  });
  it("filleuls d’un même parrain inscrits le même jour (heure d’Alger)", () => {
    const f = (id: string, cree: string) => parrainage(id, { filleul: { id, nom: id, telephone: null, cree_le: cree, parrainage_exclu: false, bloque: false } });
    const s = signauxParrainages([f("a", "2026-10-02T08:00:00Z"), f("b", "2026-10-02T21:00:00Z"), f("c", "2026-10-02T23:30:00Z")]);
    expect(s.get("a")).toContain("2 filleuls du même parrain inscrits le même jour");
    expect(s.get("c")!.some(x => x.includes("même jour"))).toBe(false); // 00 h 30 à Alger le 3
  });
  it("parrain au plafond deux mois de suite", () => {
    const liste = [..."abcde"].map(id => parrainage(id, { valide_le: "2026-09-10T10:00:00Z", boutique: null }))
      .concat([..."fghij"].map(id => parrainage(id, { valide_le: "2026-10-10T10:00:00Z", boutique: null })));
    expect(signauxParrainages(liste).get("a")).toContain("Parrain au plafond (5) deux mois de suite");
    expect(signauxParrainages(liste.slice(0, 9)).get("a")!.includes("Parrain au plafond (5) deux mois de suite")).toBe(false);
  });
  it("bons annulables : disponibles ou en file seulement", () => {
    expect(bonsAnnulables({ bons: [{ id: "1", origine: "parrainage_filleul", statut: "utilise" }, { id: "2", origine: "parrainage_parrain", statut: "disponible" }, { id: "3", origine: "x", statut: "reserve" }] })).toBe(1);
  });
});

function ligne(extra: Partial<LigneReleveAdmin> = {}): LigneReleveAdmin {
  return { id: "l1", releve_id: "r1", numero_commande: 128, remise_le: "2026-10-05T13:32:00Z", mode_remise: "qr", client: "Samia B.", total_commande: 3500, montant: 300, statut: "a_rembourser", motif: null,
    commande: { cree_le: "2026-10-04T10:00:00Z", prete_le: "2026-10-04T12:00:00Z", terminee_le: "2026-10-05T13:32:00Z" }, ...extra };
}
function releve(extra: Partial<ReleveAdmin> = {}): ReleveAdmin {
  return { id: "r1", mois: "2026-10-01", nombre: 1, montant: 300, statut: "a_payer", cloture_le: null, paye_le: null, reference_paiement: null,
    boutique: { id: "B", nom: "Boutique Nour", slug: "boutique-nour", bons_acceptes: true }, lignes: [ligne()], ...extra };
}

describe("US-27.5 relevés", () => {
  it("résumé « 4 bons · 1 200 DA »", () => {
    expect(resumeReleve({ nombre: 4, montant: 1200 })).toBe("4 bons · 1 200 DA");
    expect(resumeReleve({ nombre: 1, montant: 300 })).toBe("1 bon · 300 DA");
  });
  it("signaux : > 3 000 DA, toujours par code, remises rapides ; lignes refusées ignorées", () => {
    expect(signauxReleve(releve())).toEqual([]);
    const code = [ligne({ id: "a", mode_remise: "code" }), ligne({ id: "b", mode_remise: "code" }), ligne({ id: "c", mode_remise: "qr", statut: "refuse" })];
    expect(signauxReleve({ montant: 3300, lignes: code })).toEqual(["Relevé au-dessus de 3 000 DA", "Toujours par code à 6 chiffres, jamais par QR code"]);
    expect(signauxReleve({ montant: 3000, lignes: [ligne({ commande: { cree_le: "2026-10-05T13:00:00Z", prete_le: "2026-10-05T13:25:00Z", terminee_le: "2026-10-05T13:32:00Z" } })] }))
      .toEqual(["1 remise très rapide"]);
  });
  it("côté boutique : en cours, à payer avant le 10, payé avec date et référence", () => {
    expect(etatReleveBoutique({ mois: "2026-10-01", montant: 1200, statut: "en_cours", paye_le: null, reference_paiement: null })).toBe("Octobre : 1 200 DA · en cours");
    expect(etatReleveBoutique({ mois: "2026-12-01", montant: 2400, statut: "a_payer", paye_le: null, reference_paiement: null })).toBe("Décembre : 2 400 DA · à payer avant le 10/01");
    expect(etatReleveBoutique({ mois: "2026-09-01", montant: 2400, statut: "paye", paye_le: "2026-10-05", reference_paiement: "CCP-1234" })).toBe("Septembre : 2 400 DA · payé le 05/10, réf. CCP-1234");
  });
});

describe("US-27.5 export CSV", () => {
  it("BOM, séparateur ;, colonnes, montants entiers, ligne TOTAL par boutique ; ligne de côté à 0", () => {
    const csv = csvReleves([releve({ lignes: [ligne(), ligne({ id: "l2", numero_commande: 131, statut: "de_cote", mode_remise: "code" })] }), releve({ boutique: { id: "C", nom: "Chez Amel", slug: "chez-amel", bons_acceptes: true }, statut: "paye", reference_paiement: "CCP 77" })]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lignes = csv.slice(1).trimEnd().split("\r\n");
    expect(lignes[0]).toBe("mois;boutique;slug;numero_commande;date_remise;mode_remise;client;total_commande;bon;a_rembourser;etat_ligne;etat_releve;reference_paiement");
    expect(lignes[1]).toBe("2026-10;Boutique Nour;boutique-nour;128;05/10/2026 14:32;qr;Samia B.;3500;300;300;a_rembourser;a_payer;");
    expect(lignes[2]).toBe("2026-10;Boutique Nour;boutique-nour;131;05/10/2026 14:32;code;Samia B.;3500;300;0;de_cote;a_payer;");
    expect(lignes[3]).toBe("2026-10;Boutique Nour;boutique-nour;TOTAL;;;;;600;300;;a_payer;");
    expect(lignes[5]).toBe("2026-10;Chez Amel;chez-amel;TOTAL;;;;;300;300;;paye;CCP 77");
    expect(lignes).toHaveLength(6);
    expect(csv).not.toMatch(/\+213|0555/);
  });
  it("guillemets si ; \" ou retour à la ligne ; apostrophe devant une formule", () => {
    expect(champCsv("Nour; Fils")).toBe('"Nour; Fils"');
    expect(champCsv('Le "Chic"')).toBe('"Le ""Chic"""');
    expect(champCsv("a\nb")).toBe('"a\nb"');
    for (const f of ["=HYPERLINK(1)", "+1", "-2", "@x"]) expect(champCsv(f)).toBe(`'${f}`);
    expect(champCsv(-5)).toBe("-5");
    expect(champCsv(null)).toBe("");
    const csv = csvReleves([releve({ boutique: { id: "B", nom: "=1+1", slug: "x", bons_acceptes: true } })]);
    expect(csv).toContain(";'=1+1;");
  });
  it("nom du fichier", () => { expect(nomFichierCsv("2026-11-01")).toBe("bledeal-bons-2026-11.csv"); });
});

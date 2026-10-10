import { describe, expect, it, vi } from "vitest";
import { avecNomBon, lireBonParLien, lireBonsDesCommandes, lireNomsProgrammesReleve, lirePlafondsBoutique, nomBon, origineLigne, textePlafond, totauxParOrigine } from "./bons-boutique";
import { ar } from "./textes/ar";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

const client = (data: unknown, error: unknown = null) => { const rpc = vi.fn(async () => ({ data, error })); return { rpc, c: { rpc } as unknown as SupabaseClient<Database> }; };
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";

describe("US-33.4 : nom du bon", () => {
  it("campagne, bienvenue, parrainage ; sans information : « Bon parrainage » (comme avant)", () => {
    expect(nomBon({ origine: "campagne", nom_fr: "Aïd 2026", nom_ar: "العيد 2026" })).toBe("Bon Aïd 2026");
    expect(nomBon({ origine: "campagne", nom_fr: "Aïd 2026", nom_ar: "العيد 2026" }, ar.parrainage, "ar")).toBe("بون العيد 2026");
    expect(nomBon({ origine: "bienvenue", nom_fr: null, nom_ar: null })).toBe("Bon de bienvenue");
    expect(nomBon({ origine: "parrainage_filleul", nom_fr: null, nom_ar: null })).toBe("Bon parrainage");
    expect(nomBon(null)).toBe("Bon parrainage"); expect(nomBon(undefined)).toBe("Bon parrainage");
  });
  it("lireBonsDesCommandes : une lecture, ids sans doublon, réponses inconnues ignorées ; aucune lecture sans commande", async () => {
    const { rpc, c } = client([{ commande: "c1", origine: "campagne", nom_fr: "Aïd 2026", nom_ar: "العيد 2026" }, { commande: "c2", origine: "autre" }, { origine: "bienvenue" }]);
    const noms = await lireBonsDesCommandes(c, ["c1", "c1", "c2"]);
    expect(rpc).toHaveBeenCalledWith("bons_des_commandes", { commandes: ["c1", "c2"] });
    expect([...noms.keys()]).toEqual(["c1"]); expect(noms.get("c1")?.nom_fr).toBe("Aïd 2026");
    const vide = client([]); expect((await lireBonsDesCommandes(vide.c, [])).size).toBe(0); expect(vide.rpc).not.toHaveBeenCalled();
    await expect(lireBonsDesCommandes(client(null, { message: "x" }).c, ["c1"])).rejects.toThrow();
  });
  it("lireBonParLien : jeton faux sans lecture ; réponse vide : null", async () => {
    const faux = client(null); expect(await lireBonParLien(faux.c, "abc")).toBeNull(); expect(faux.rpc).not.toHaveBeenCalled();
    const { rpc, c } = client({ origine: "bienvenue", nom_fr: null, nom_ar: null });
    expect(await lireBonParLien(c, JETON)).toEqual({ origine: "bienvenue", nom_fr: null, nom_ar: null });
    expect(rpc).toHaveBeenCalledWith("bon_par_lien", { jeton: JETON });
    expect(await lireBonParLien(client(null).c, JETON)).toBeNull();
  });
  it("avecNomBon : lecture seulement si un bon est posé ; erreur : résumé sans nom (« Bon parrainage »)", async () => {
    const sans = client([]); const r = { etat: "ok" as const, commande: "c1", remise_bon: 0 };
    expect(await avecNomBon(sans.c, r)).toBe(r); expect(sans.rpc).not.toHaveBeenCalled();
    const avec = client([{ commande: "c1", origine: "campagne", nom_fr: "Aïd 2026", nom_ar: "العيد 2026" }]);
    expect((await avecNomBon(avec.c, { ...r, remise_bon: 500 })).bon?.nom_fr).toBe("Aïd 2026");
    expect((await avecNomBon(client(null, { message: "x" }).c, { ...r, remise_bon: 500 })).bon).toBeNull();
  });
});

describe("US-33.4 : relevé par origine et plafond", () => {
  const noms = new Map([["p1", "Aïd 2026"]]);
  it("origine d'une ligne : nom de la campagne, Bienvenue, Parrainage (aussi les lignes d'avant US-33)", () => {
    expect(origineLigne({ origine: "campagne", programme_id: "p1" }, noms)).toBe("Aïd 2026");
    expect(origineLigne({ origine: "campagne", programme_id: "p9" }, noms)).toBe("Campagne");
    expect(origineLigne({ origine: "bienvenue", programme_id: "pb" }, noms)).toBe("Bienvenue");
    expect(origineLigne({ origine: "parrainage_parrain" }, noms)).toBe("Parrainage");
    expect(origineLigne({ origine: null }, noms)).toBe("Parrainage");
    expect(origineLigne({ origine: "avis", programme_id: "p9" }, noms)).toBe("Avis");
  });
  it("totaux : lignes à rembourser seulement, la plus grosse origine d'abord", () => {
    expect(totauxParOrigine([
      { origine: "parrainage_filleul", montant: 300, statut: "a_rembourser" }, { origine: "campagne", programme_id: "p1", montant: 500, statut: "a_rembourser" },
      { origine: "campagne", programme_id: "p1", montant: 500, statut: "de_cote" }, { origine: "bienvenue", montant: 300, statut: "a_rembourser" },
      { origine: "bienvenue", montant: 300, statut: "a_rembourser" }], noms)).toEqual([
      { origine: "Bienvenue", nombre: 2, montant: 600 }, { origine: "Aïd 2026", nombre: 1, montant: 500 }, { origine: "Parrainage", nombre: 1, montant: 300 }]);
  });
  it("plafond : texte, lecture filtrée ; noms du relevé", async () => {
    expect(textePlafond({ nom_fr: "Aïd 2026", nom_ar: "", plafond: 30, utilises: 14 })).toBe("Plafond Aïd 2026 : 14 / 30 bons dans votre boutique.");
    expect(await lirePlafondsBoutique(client([{ nom_fr: "Aïd 2026", nom_ar: "x", plafond: 30, utilises: 2 }, { nom_fr: "X" }]).c)).toHaveLength(1);
    expect([...(await lireNomsProgrammesReleve(client([{ id: "p1", type: "campagne", nom_fr: "Aïd 2026" }, { id: 3 }]).c))]).toEqual([["p1", "Aïd 2026"]]);
    // US-35 : en arabe, le nom arabe de la campagne (nom_ar) ; le nom français s'il manque ou s'il est vide ; en français, toujours le nom français
    const lignes = [{ id: "p1", type: "campagne", nom_fr: "Aïd 2026", nom_ar: "العيد 2026" }, { id: "p2", type: "campagne", nom_fr: "Rentrée", nom_ar: "  " }, { id: "p3", type: "campagne", nom_fr: "Soldes" }];
    expect([...(await lireNomsProgrammesReleve(client(lignes).c, "ar"))]).toEqual([["p1", "العيد 2026"], ["p2", "Rentrée"], ["p3", "Soldes"]]);
    expect([...(await lireNomsProgrammesReleve(client(lignes).c, "fr"))]).toEqual([["p1", "Aïd 2026"], ["p2", "Rentrée"], ["p3", "Soldes"]]);
    expect([...(await lireNomsProgrammesReleve(client(lignes).c))]).toEqual([["p1", "Aïd 2026"], ["p2", "Rentrée"], ["p3", "Soldes"]]);
  });
});

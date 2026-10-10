// US-31.4 : bon de bienvenue de l'inscription en boutique (affichage, relevés, signaux, compteur de l'espace).
import { describe, expect, it } from "vitest";
import { choixBons, estBonProgramme, raisonBonNonApplique, resultatBon, type BonClient } from "./bons";
import { detailInscription, libelleUtiliserBon, nomDuBon, texteRaisonBon } from "./bons-affichage";
import { aRembourserLigne, origineLigne, totauxParOrigine } from "./bons-boutique";
import { conditionsProgramme, type ProgrammeAdmin } from "./bons-admin";
import { signauxInscriptions, type InscriptionsBoutique } from "./inscriptions-admin";
import { texteBonsInscription } from "./abonnements";
import { fr } from "./textes/fr";
import { ar } from "./textes/ar";

const bon: BonClient = { id: "i", montant: 500, statut: "disponible", origine: "inscription_boutique", cree_le: "2026-10-10T09:00:00Z",
  expire_le: "2026-11-09T09:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null, minimum_achat: 4000, univers: null, villes: [],
  nom_fr: "Bienvenue en boutique", nom_ar: "مرحبا في الحانوت", utilisable_des: "2026-10-10T23:00:00Z", boutique_origine: "Boutique Nour" };

describe("US-31.4 : bon d'inscription côté client", () => {
  it("c'est un bon de bienvenue (nom, case du panier) et un bon de programme (minimum copié)", () => {
    expect(nomDuBon(bon, fr.parrainage, "fr")).toBe("Bon de bienvenue");
    expect(nomDuBon(bon, ar.parrainage, "ar")).toBe("بون مرحبا");
    expect(libelleUtiliserBon(bon, fr.parrainage, "fr")).toBe("Utiliser mon bon de bienvenue (−500\u00a0DA)");
    expect(estBonProgramme(bon)).toBe(true);
  });
  it("« Chez Boutique Nour : dès le 11/10. Ailleurs : tout de suite. » jusqu'au lendemain (heure d'Alger), plus rien ensuite", () => {
    expect(detailInscription(bon, fr.parrainage, new Date("2026-10-10T12:00:00Z"))).toBe("Chez Boutique Nour : dès le 11/10. Ailleurs : tout de suite.");
    expect(detailInscription(bon, ar.parrainage, new Date("2026-10-10T12:00:00Z"))).toContain("Boutique Nour");
    expect(detailInscription(bon, fr.parrainage, new Date("2026-10-10T23:00:01Z"))).toBeNull();
    expect(detailInscription({ ...bon, origine: "bienvenue" }, fr.parrainage, new Date("2026-10-10T12:00:00Z"))).toBeNull();
    expect(detailInscription({ ...bon, statut: "reserve" }, fr.parrainage, new Date("2026-10-10T12:00:00Z"))).toBeNull();
  });
  it("raison « pas_aujourdhui » : lue de la base, texte du panier et du suivi (FR et AR)", () => {
    expect(resultatBon("pas_aujourdhui")).toBe("pas_aujourdhui");
    expect(raisonBonNonApplique("pas_aujourdhui")).toBe("pas_aujourdhui");
    expect(texteRaisonBon(bon, "pas_aujourdhui", fr.parrainage, "fr")).toBe("Dans cette boutique, dès demain");
    expect(texteRaisonBon(bon, "pas_aujourdhui", ar.parrainage, "ar")).toBe(ar.parrainage.raisonPasAujourdhui);
    expect(fr.parrainage.bonNonApplique.pas_aujourdhui).toContain("dès demain");
    const { options, retenu } = choixBons([bon], 4500, { i: "pas_aujourdhui" }, null, new Date("2026-10-10T12:00:00Z"));
    expect(options[0].raison).toBe("pas_aujourdhui");
    expect(retenu).toEqual({ bon, applicable: false });
    expect(choixBons([bon], 4500, { i: "ok" }, null, new Date("2026-10-10T12:00:00Z")).retenu).toEqual({ bon, applicable: true });
  });
});

describe("US-31.4 : relevés (part de la boutique d'origine non remboursée)", () => {
  it("à rembourser = bon − part ; origine « Inscription en boutique »", () => {
    expect(aRembourserLigne({ montant: 500, part_boutique: 250 })).toBe(250);
    expect(aRembourserLigne({ montant: 300 })).toBe(300);
    expect(aRembourserLigne({ montant: 300, part_boutique: null })).toBe(300);
    expect(origineLigne({ origine: "inscription_boutique", programme_id: "p" }, new Map([["p", "Bienvenue en boutique"]]))).toBe("Inscription en boutique");
  });
  it("totaux par origine de la boutique : montants remboursés", () => {
    const totaux = totauxParOrigine([
      { origine: "inscription_boutique", montant: 500, part_boutique: 250, statut: "a_rembourser" },
      { origine: "inscription_boutique", montant: 500, part_boutique: 0, statut: "a_rembourser" },
      { origine: "bienvenue", montant: 300, statut: "a_rembourser" },
    ], new Map());
    expect(totaux).toEqual([{ origine: "Inscription en boutique", nombre: 2, montant: 750 }, { origine: "Bienvenue", nombre: 1, montant: 300 }]);
  });
});

describe("US-31.4 : administration et espace", () => {
  it("conditions du programme : part de la boutique et plafond par mois", () => {
    const p = { id: "p", type: "inscription_boutique", nom_fr: "Bienvenue en boutique", nom_ar: "x", code: null, montant: 500, minimum_achat: 4000, univers: null,
      villes: [], debut: "2026-10-10T09:00:00Z", fin: null, validite_jours: 30, budget: 0, plafond_par_boutique: null, actif: false, ouvert: false,
      emis: 0, utilises: 0, rembourse: 0, restant: 0, part_boutique: 250, plafond_inscriptions_mois: 20 } satisfies ProgrammeAdmin;
    expect(conditionsProgramme(p)).toContain("part de la boutique d’origine 250 DA · 20 inscriptions récompensées par boutique et par mois");
  });
  it("signaux des inscriptions : seuils (jamais bloquants)", () => {
    const b: InscriptionsBoutique = { boutique_id: "b", boutique: "Boutique Nour", slug: "nour", inscrits: 8, sans_commande: 5, jamais_ailleurs: 3, remises_rapides: 1, meme_minute: 4 };
    expect(signauxInscriptions(b)).toEqual([
      "5 inscrits sans aucune commande après 7 jours",
      "3 inscrits n’achètent que dans cette boutique",
      "1 commande avec bon d’inscription remise moins de 30 min après la commande",
      "4 inscriptions groupées (3 ou plus dans la même minute)",
    ]);
    expect(signauxInscriptions({ ...b, inscrits: 20, sans_commande: 5, jamais_ailleurs: 2, remises_rapides: 0, meme_minute: 0 })).toEqual([]);
  });
  it("espace : bons de bienvenue des inscrits du mois, plafond et part ; rien si le programme est fermé", () => {
    expect(texteBonsInscription({ total: 12, sept_jours: 3, inscrits: 9, bons_inscription_mois: 3, plafond_inscriptions_mois: 20, montant_bon_inscription: 500, part_boutique: 250 }))
      .toBe("Bons de bienvenue des inscrits ce mois : 3 / 20. Votre part : 250\u00a0DA par bon utilisé chez vous (déduite du remboursement).");
    expect(texteBonsInscription({ total: 12, sept_jours: 3, inscrits: 9, bons_inscription_mois: null })).toBeNull();
  });
});

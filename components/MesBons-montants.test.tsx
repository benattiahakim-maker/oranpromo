// Demande de BOLOSS du 10/10 : la phrase d'aide de « Mes bons » et la case du panier montrent le montant RÉEL du bon
// (150 DA, 300 DA, 500 DA…), en français et en arabe ; plus aucun « 300 DA » écrit en dur.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import FournisseurTextes from "./FournisseurTextes";
import MesBons from "./MesBons";
import BonPanier from "./BonPanier";
import { aideMesBons, libelleUtiliserBon } from "@/lib/bons-affichage";
import { fr } from "@/lib/textes/fr";
import { ar } from "@/lib/textes/ar";
import type { BonClient } from "@/lib/bons";

afterEach(cleanup);
const NB = "\u00a0";
const bon = (x: Partial<BonClient>): BonClient => ({ id: "b", montant: 300, statut: "disponible", origine: "parrainage_parrain", cree_le: "2026-10-12T10:00:00Z",
  expire_le: "2099-12-11T10:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null, ...x } as BonClient);
const avis = bon({ id: "a", montant: 150, origine: "avis", minimum_achat: 1500, nom_fr: "Avis", nom_ar: "راي" } as Partial<BonClient>);
const campagne = bon({ id: "c", montant: 500, origine: "campagne", minimum_achat: 4000, nom_fr: "Aïd 2026", nom_ar: "عيد 2026" } as Partial<BonClient>);

const inscription = bon({ id: "i", montant: 500, origine: "inscription_boutique", minimum_achat: 3000, nom_fr: "Bienvenue boutique", nom_ar: "مرحبا" } as Partial<BonClient>);
const bienvenue = bon({ id: "w", montant: 300, origine: "bienvenue", minimum_achat: 2000, nom_fr: "Bienvenue", nom_ar: "مرحبا" } as Partial<BonClient>);
const MAINTENANT = new Date("2026-10-20T10:00:00Z");

describe("aideMesBons : bon par bon, montant réel et qui paie", () => {
  it("parrainage, bienvenue, campagne, avis : « payé par BleDeal » ; du plus petit au plus grand ; doublons une fois", () => {
    expect(aideMesBons([campagne, bon({}), avis, bienvenue, avis], fr.parrainage, "fr")).toBe(
      `À utiliser au panier. Bon Avis : 150${NB}DA de moins, payé par BleDeal. Bon parrainage : 300${NB}DA de moins, payé par BleDeal. `
      + `Bon de bienvenue : 300${NB}DA de moins, payé par BleDeal. Bon Aïd 2026 : 500${NB}DA de moins, payé par BleDeal.`);
  });
  it("bon de l'inscription en boutique (US-31.4) : « payé par BleDeal et la boutique où vous vous êtes inscrit »", () => {
    expect(aideMesBons([inscription], fr.parrainage, "fr")).toBe(
      `À utiliser au panier. Bon de bienvenue : 500${NB}DA de moins, payé par BleDeal et la boutique où vous vous êtes inscrit.`);
    expect(aideMesBons([], fr.parrainage, "fr")).toBeNull();
  });
  it("en arabe : mêmes règles, montants en دج, aucun {champ} oublié", () => {
    const t = aideMesBons([avis, inscription], ar.parrainage, "ar")!;
    expect(t).toMatch(/^تخدم بيهم في السلة\. بون راي: .*150.*\u00a0دج أقل، تخلّصو BleDeal\. بون مرحبا: .*500.*\u00a0دج أقل، تخلّصو BleDeal والحانوت اللي تسجّلت فيه\.$/);
    expect(t).not.toMatch(/[{}]/);
  });
});

describe("« Mes bons » : phrase d'aide bon par bon", () => {
  it("bon « avis » seul : 150 DA, payé par BleDeal (plus aucun 300 DA)", () => {
    render(<MesBons bons={[avis]} maintenant={MAINTENANT} />);
    expect(screen.getByText(/^À utiliser au panier\. Bon Avis : 150\sDA de moins, payé par BleDeal\.$/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/300\sDA/);
  });
  it("avis, parrainage, inscription ; un bon utilisé n'entre pas dans la phrase", () => {
    render(<MesBons bons={[inscription, avis, bon({ id: "p" }), bon({ id: "u", montant: 1000, statut: "utilise", commande: "d", numero: 3, utilise_le: "2026-10-12T10:00:00Z", boutique: "X" })]} maintenant={MAINTENANT} />);
    const aide = screen.getByText(/^À utiliser au panier\./);
    expect(aide.textContent).toMatch(/Bon Avis : 150\sDA de moins, payé par BleDeal\. Bon parrainage : 300\sDA de moins, payé par BleDeal\. Bon de bienvenue : 500\sDA de moins, payé par BleDeal et la boutique où vous vous êtes inscrit\.$/);
    expect(aide.textContent).not.toMatch(/1\s000/);
  });
  it("aucun bon utilisable : pas de phrase", () => {
    render(<MesBons bons={[bon({ statut: "utilise", commande: "d", numero: 3, utilise_le: "2026-10-12T10:00:00Z", boutique: "X" })]} maintenant={MAINTENANT} />);
    expect(screen.queryByText(/À utiliser au panier/)).toBeNull();
  });
  it("en arabe", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><MesBons bons={[inscription]} maintenant={MAINTENANT} /></FournisseurTextes>);
    expect(screen.getByText(/^تخدم بيهم في السلة/).textContent).toMatch(/500.*دج أقل، تخلّصو BleDeal والحانوت اللي تسجّلت فيه\.$/);
  });
});

describe("panier : case « Utiliser mon bon » avec le montant réel", () => {
  it("bon parrainage : montant du bon (300 DA aujourd'hui, autre montant si la base en donne un autre)", () => {
    expect(libelleUtiliserBon(bon({}), fr.parrainage, "fr")).toBe(`Utiliser mon bon parrainage (−300${NB}DA)`);
    expect(libelleUtiliserBon(bon({ montant: 250 }), fr.parrainage, "fr")).toBe(`Utiliser mon bon parrainage (−250${NB}DA)`);
    expect(libelleUtiliserBon(bon({ montant: 250 }), ar.parrainage, "ar")).toMatch(/^خدم بالبون نتاعي \(−.*250.*\u00a0دج\)$/);
  });
  it("bon « avis » au panier : −150 DA partout (case, ligne, à payer)", () => {
    render(<BonPanier total={2000} utiliser onChange={() => {}} bon={avis} applicable />);
    expect(screen.getByRole("checkbox", { name: /^Utiliser mon bon Avis \(−150\sDA\)$/ })).toBeChecked();
    expect(document.body.textContent).not.toMatch(/300/);
    expect(document.body.textContent).toMatch(/1\s850\sDA/);
  });
  it("ancien appel sans bon précis : montant du bon parrainage, jamais « {montant} »", () => {
    render(<BonPanier total={2000} utiliser={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: /^Utiliser mon bon parrainage \(−300\sDA\)$/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("{montant}");
  });
});

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

describe("aideMesBons", () => {
  it("un montant, plusieurs montants (sans doublon, du plus petit au plus grand), aucun", () => {
    expect(aideMesBons([150], fr.parrainage, "fr")).toBe(`À utiliser au panier : 150${NB}DA de moins, payés par BleDeal à la boutique.`);
    expect(aideMesBons([500, 150, 300, 150], fr.parrainage, "fr")).toBe(`À utiliser au panier : 150${NB}DA ou 300${NB}DA ou 500${NB}DA de moins, payés par BleDeal à la boutique.`);
    expect(aideMesBons([], fr.parrainage, "fr")).toBeNull();
  });
  it("en arabe : montants en دج", () => {
    const t = aideMesBons([150, 300], ar.parrainage, "ar")!;
    expect(t).toMatch(/^تخدم بيه في السلة: .*150.*\u00a0دج ولا .*300.*\u00a0دج أقل، BleDeal تخلّصها للحانوت\.$/);
    expect(t).not.toContain("{montant}");
  });
});

describe("« Mes bons » : phrase d'aide avec le montant réel", () => {
  it("bon « avis » seul : 150 DA (et plus 300 DA)", () => {
    render(<MesBons bons={[avis]} maintenant={new Date("2026-10-20T10:00:00Z")} />);
    expect(screen.getByText(/^À utiliser au panier : 150\sDA de moins, payés par BleDeal à la boutique\.$/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/300\sDA/);
  });
  it("150, 300 et 500 DA ; un bon utilisé ou expiré n'entre pas dans la phrase", () => {
    render(<MesBons bons={[avis, bon({ id: "p" }), campagne, bon({ id: "u", montant: 1000, statut: "utilise", commande: "d", numero: 3, utilise_le: "2026-10-12T10:00:00Z", boutique: "X" })]} maintenant={new Date("2026-10-20T10:00:00Z")} />);
    expect(screen.getByText(/^À utiliser au panier : 150\sDA ou 300\sDA ou 500\sDA de moins, payés par BleDeal à la boutique\.$/)).toBeInTheDocument();
  });
  it("aucun bon utilisable : pas de phrase « à utiliser au panier »", () => {
    render(<MesBons bons={[bon({ statut: "utilise", commande: "d", numero: 3, utilise_le: "2026-10-12T10:00:00Z", boutique: "X" })]} maintenant={new Date("2026-10-20T10:00:00Z")} />);
    expect(screen.queryByText(/À utiliser au panier/)).toBeNull();
  });
  it("en arabe : 150 دج", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><MesBons bons={[avis]} maintenant={new Date("2026-10-20T10:00:00Z")} /></FournisseurTextes>);
    const aide = screen.getByText(/^تخدم بيه في السلة/);
    expect(aide.textContent).toMatch(/150.*دج أقل/);
    expect(aide.textContent).not.toMatch(/300/);
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

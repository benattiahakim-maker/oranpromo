import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { chercherCommandes, compterEtapes, debutJourOran, empreinteEtat, heureOran, lireEtatCommandes, echapperMotif, ETAPES, etapeDeStatut, etapeParDefaut, formaterDuree, heureCourte, heureEtape, lireEtape, lireRecherche, listerEtape, prenom, urgence } from "./tableau-commandes";

// Référence : vendredi 9/10/2026, 14 h 05 à Oran (13 h 05 UTC).
const MAINTENANT = Date.parse("2026-10-09T13:05:00Z");
const ilYa = (min: number) => new Date(MAINTENANT - min * 60_000).toISOString();
const dans = (min: number) => new Date(MAINTENANT + min * 60_000).toISOString();
const c = (statut: string, extra: Record<string, string | null> = {}) => ({ statut, cree_le: ilYa(5), confirmee_le: null, prete_le: null, terminee_le: null, expire_le: null, ...extra }) as never;

function client(resultat: unknown = { data: [{ id: "c1" }], error: null }) {
  const appels: unknown[][] = [];
  const chaine: Record<string, unknown> = { then: (ok: (v: unknown) => void) => ok(resultat) };
  for (const m of ["select", "eq", "in", "gte", "order", "ilike"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
  chaine.limit = (...a: unknown[]) => { appels.push(["limit", ...a]); return Promise.resolve(resultat); };
  return { appels, client: { from: (t: string) => { appels.push(["from", t]); return chaine; } } as unknown as SupabaseClient<Database> };
}

describe("US-28.1 : étapes", () => {
  it("répartit les 6 statuts dans les 4 étapes", () => {
    expect(["demandee", "confirmee", "prete", "recuperee", "annulee", "expiree"].map(s => etapeDeStatut(s as never))).toEqual(["a_confirmer", "a_preparer", "pretes", "terminees", "terminees", "terminees"]);
    expect(Object.values(ETAPES).map(e => e.libelle)).toEqual(["À confirmer", "À préparer", "Prêtes", "Terminées"]);
  });
  it("lit ?etape=, accepte l’ancienne adresse ?vue= et ignore le reste", () => {
    expect(lireEtape({ etape: "pretes" })).toBe("pretes");
    expect(lireEtape({ vue: "terminees" })).toBe("terminees");
    expect(lireEtape({ vue: "en_cours" })).toBeNull();
    expect(lireEtape({ etape: "n’importe" })).toBeNull();
    expect(lireEtape({ etape: ["pretes", "terminees"] })).toBeNull();
  });
  it("décision 10 : ouvre la première étape non vide, sinon « À confirmer »", () => {
    expect(etapeParDefaut({ a_confirmer: 0, a_preparer: 2, pretes: 1, terminees: 9 })).toBe("a_preparer");
    expect(etapeParDefaut({ a_confirmer: 0, a_preparer: 0, pretes: 1, terminees: 0 })).toBe("pretes");
    expect(etapeParDefaut({ a_confirmer: 0, a_preparer: 0, pretes: 0, terminees: 5 })).toBe("a_confirmer");
  });
});

describe("US-28.1 : urgence (seuils validés : 30 min, 2 h, 3 h)", () => {
  it("formate les durées", () => {
    expect([0.5, 1, 42, 60, 130, 125].map(m => formaterDuree(m))).toEqual(["moins d’1 min", "1 min", "42 min", "1 h", "2 h 10", "2 h 05"]);
  });
  it("à confirmer : rouge à partir de 30 min d’attente", () => {
    expect(urgence(c("demandee", { cree_le: ilYa(29) }), MAINTENANT)).toEqual({ texte: "attend depuis 29 min", rouge: false });
    expect(urgence(c("demandee", { cree_le: ilYa(30) }), MAINTENANT)).toEqual({ texte: "attend depuis 30 min", rouge: true });
  });
  it("à préparer : rouge à partir de 2 h après la confirmation", () => {
    expect(urgence(c("confirmee", { confirmee_le: ilYa(119) }), MAINTENANT)).toEqual({ texte: "confirmée il y a 1 h 59", rouge: false });
    expect(urgence(c("confirmee", { confirmee_le: ilYa(130) }), MAINTENANT)).toEqual({ texte: "confirmée il y a 2 h 10", rouge: true });
  });
  it("prêtes : rouge à moins de 3 h de l’expiration, « expirée, en attente » après", () => {
    expect(urgence(c("prete", { expire_le: dans(180) }), MAINTENANT)).toEqual({ texte: "expire dans 3 h", rouge: false });
    expect(urgence(c("prete", { expire_le: dans(80) }), MAINTENANT)).toEqual({ texte: "expire dans 1 h 20", rouge: true });
    expect(urgence(c("prete", { expire_le: ilYa(3) }), MAINTENANT)).toEqual({ texte: "expirée, en attente", rouge: true });
  });
  it("terminées : le statut, jamais rouge", () => {
    expect(urgence(c("annulee"), MAINTENANT)).toEqual({ texte: "Annulée", rouge: false });
  });
  it("heures d’Oran : aujourd’hui, hier, avant", () => {
    expect(heureCourte("2026-10-09T12:23:00Z", MAINTENANT)).toBe("13 h 23");
    expect(heureCourte("2026-10-08T23:30:00Z", MAINTENANT)).toBe("0 h 30"); // déjà le 9 à Oran
    expect(heureCourte("2026-10-08T14:25:00Z", MAINTENANT)).toBe("hier 15 h 25");
    expect(heureCourte("2026-10-02T08:00:00Z", MAINTENANT)).toBe("02/10 9 h 00");
    expect(debutJourOran(MAINTENANT)).toBe("2026-10-08T23:00:00.000Z");
  });
  it("heure de la ligne selon l’étape", () => {
    expect(heureEtape(c("confirmee", { confirmee_le: "X" }))).toBe("X");
    expect(heureEtape(c("prete", { prete_le: "P" }))).toBe("P");
    expect(heureEtape(c("recuperee", { terminee_le: "T" }))).toBe("T");
  });
  it("prénom = premier mot du nom", () => {
    expect(prenom("  Samia   B. ")).toBe("Samia");
    expect(prenom("")).toBe("Client");
  });
});

describe("US-28.1 : recherche", () => {
  it("un nombre cherche le numéro exact, sinon le début du nom (2 caractères au moins, 40 au plus)", () => {
    expect(lireRecherche("131")).toEqual({ numero: 131 });
    expect(lireRecherche(" n° 131 ")).toEqual({ numero: 131 });
    expect(lireRecherche("#7")).toEqual({ numero: 7 });
    expect(lireRecherche("sam")).toEqual({ prefixe: "sam" });
    expect(lireRecherche("s")).toBeNull();
    expect(lireRecherche(undefined)).toBeNull();
    expect(lireRecherche(["a", "b"])).toBeNull();
    expect((lireRecherche("x".repeat(80)) as { prefixe: string }).prefixe).toHaveLength(40);
  });
  it("neutralise % _ et \\", () => {
    expect(echapperMotif("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
  it("cherche dans toutes les étapes de la boutique, 50 au plus", async () => {
    const { appels, client: cl } = client();
    await chercherCommandes(cl, "b1", { prefixe: "sa%" });
    expect(appels).toContainEqual(["eq", "boutique_id", "b1"]);
    expect(appels).toContainEqual(["ilike", "client_nom", "sa\\%%"]);
    expect(appels).not.toContainEqual(expect.arrayContaining(["in"]));
    expect(appels).toContainEqual(["limit", 50]);
    appels.length = 0;
    await chercherCommandes(cl, "b1", { numero: 131 });
    expect(appels).toContainEqual(["eq", "numero", 131]);
  });
});

describe("US-28.1 : lectures (client de la session, RLS inchangée)", () => {
  it("trie chaque étape par urgence", async () => {
    const { appels, client: cl } = client();
    await listerEtape(cl, "b1", "a_confirmer", MAINTENANT);
    expect(appels).toContainEqual(["in", "statut", ["demandee"]]);
    expect(appels).toContainEqual(["order", "cree_le", { ascending: true }]);
    appels.length = 0;
    await listerEtape(cl, "b1", "a_preparer", MAINTENANT);
    expect(appels.find(a => a[0] === "order")).toEqual(["order", "confirmee_le", { ascending: true }]);
    appels.length = 0;
    await listerEtape(cl, "b1", "pretes", MAINTENANT);
    expect(appels).toContainEqual(["order", "expire_le", { ascending: true }]);
    appels.length = 0;
    await listerEtape(cl, "b1", "terminees", MAINTENANT);
    expect(appels).toContainEqual(["in", "statut", ["recuperee", "annulee", "expiree"]]);
    expect(appels).toContainEqual(["gte", "terminee_le", "2026-10-02T13:05:00.000Z"]);
    expect(appels).toContainEqual(["order", "terminee_le", { ascending: false }]);
    expect(appels).toContainEqual(["limit", 100]);
  });
  it("une erreur de lecture donne un message clair", async () => {
    const { client: cl } = client({ data: null, error: { message: "x" } });
    await expect(listerEtape(cl, "b1", "pretes", MAINTENANT)).rejects.toThrow("Impossible de charger les commandes. Réessayez.");
  });
  it("compte les 4 étapes sans lire les lignes ; « Terminées » = aujourd’hui à Oran", async () => {
    const { appels, client: cl } = client({ count: 2, error: null });
    expect(await compterEtapes(cl, "b1", MAINTENANT)).toEqual({ a_confirmer: 2, a_preparer: 2, pretes: 2, terminees: 2 });
    expect(appels.filter(a => a[0] === "select").every(a => (a[2] as { head: boolean }).head)).toBe(true);
    expect(appels).toContainEqual(["gte", "terminee_le", "2026-10-08T23:00:00.000Z"]);
  });
});

describe("US-28.4 : état pour la mise à jour automatique", () => {
  it("compteurs + dernier numéro ; empreinte qui change à chaque changement de statut ou nouvelle commande", async () => {
    const { appels, client: cl } = client({ count: 1, error: null, data: [{ numero: 134 }] });
    const etat = await lireEtatCommandes(cl, "b1", MAINTENANT);
    expect(etat).toEqual({ a_confirmer: 1, a_preparer: 1, pretes: 1, terminees: 1, derniere: 134 });
    expect(appels).toContainEqual(["select", "numero"]);
    const e = empreinteEtat(etat);
    expect(empreinteEtat({ ...etat, a_confirmer: 0, a_preparer: 2 })).not.toBe(e); // confirmée ailleurs
    expect(empreinteEtat({ ...etat, derniere: 135 })).not.toBe(e);
    expect(empreinteEtat({ ...etat })).toBe(e);
    expect(heureOran(MAINTENANT)).toBe("14 h 05");
  });
});

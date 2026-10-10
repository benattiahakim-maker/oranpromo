import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { avisPossible, donnerAvis, lireMesNotes, messageErreurAvis, verifierSaisieAvis, MESSAGES_AVIS } from "./avis";

const JOUR = 24 * 3600 * 1000;
const MAINTENANT = Date.parse("2026-10-20T12:00:00Z");
const il_y_a = (ms: number) => new Date(MAINTENANT - ms).toISOString();
const ID = "11111111-1111-1111-1111-111111111111";

describe("US-32.2 : quand proposer « Donner mon avis »", () => {
  it("récupérée par QR code depuis 14 jours au plus : oui", () => {
    expect(avisPossible({ statut: "recuperee", mode_remise: "qr", terminee_le: il_y_a(2 * JOUR) }, MAINTENANT)).toBe(true);
    expect(avisPossible({ statut: "recuperee", mode_remise: "qr", terminee_le: il_y_a(14 * JOUR) }, MAINTENANT)).toBe(true);
  });
  it("plus de 14 jours : non", () => {
    expect(avisPossible({ statut: "recuperee", mode_remise: "qr", terminee_le: il_y_a(14 * JOUR + 60_000) }, MAINTENANT)).toBe(false);
  });
  it("remise par code à 6 chiffres ou « sans QR code », ou pas encore récupérée : non", () => {
    expect(avisPossible({ statut: "recuperee", mode_remise: "code", terminee_le: il_y_a(JOUR) }, MAINTENANT)).toBe(false);
    expect(avisPossible({ statut: "recuperee", mode_remise: "manuel", terminee_le: il_y_a(JOUR) }, MAINTENANT)).toBe(false);
    expect(avisPossible({ statut: "recuperee", mode_remise: null, terminee_le: il_y_a(JOUR) }, MAINTENANT)).toBe(false);
    expect(avisPossible({ statut: "prete", mode_remise: null, terminee_le: null }, MAINTENANT)).toBe(false);
    expect(avisPossible({ statut: "recuperee", mode_remise: "qr", terminee_le: null }, MAINTENANT)).toBe(false);
    expect(avisPossible({ statut: "recuperee", mode_remise: "qr", terminee_le: "pas une date" }, MAINTENANT)).toBe(false);
  });
});

describe("US-32.2 : saisie de l'avis", () => {
  it("note obligatoire, entière, de 1 à 5", () => {
    for (const note of [0, 6, 2.5, Number.NaN, "5", undefined]) expect(() => verifierSaisieAvis({ note, criteres: [], commentaire: "" }), String(note)).toThrow(MESSAGES_AVIS.note);
    expect(() => verifierSaisieAvis(null)).toThrow(MESSAGES_AVIS.note);
  });
  it("critères connus, sans doublon, rangés ; commentaire sans espaces autour, vide = aucun", () => {
    expect(verifierSaisieAvis({ note: 4, criteres: ["rapidite", "accueil"], commentaire: "  Très bien.  " })).toEqual({ note: 4, criteres: ["accueil", "rapidite"], commentaire: "Très bien." });
    expect(verifierSaisieAvis({ note: 5, criteres: [], commentaire: "   " })).toEqual({ note: 5, criteres: [], commentaire: null });
    expect(verifierSaisieAvis({ note: 5 })).toEqual({ note: 5, criteres: [], commentaire: null });
    expect(() => verifierSaisieAvis({ note: 5, criteres: ["prix"] })).toThrow(MESSAGES_AVIS.critere);
    expect(() => verifierSaisieAvis({ note: 5, criteres: ["accueil", "accueil"] })).toThrow(MESSAGES_AVIS.critere);
    expect(() => verifierSaisieAvis({ note: 5, criteres: "accueil" })).toThrow(MESSAGES_AVIS.critere);
  });
  it("commentaire de 300 caractères au plus", () => {
    expect(verifierSaisieAvis({ note: 3, criteres: [], commentaire: "a".repeat(300) }).commentaire).toHaveLength(300);
    expect(() => verifierSaisieAvis({ note: 3, criteres: [], commentaire: "a".repeat(301) })).toThrow(MESSAGES_AVIS.commentaire);
    expect(() => verifierSaisieAvis({ note: 3, criteres: [], commentaire: 12 })).toThrow(MESSAGES_AVIS.commentaire);
  });
});

function client(rpc: { data: unknown; error: unknown }, lecture: { data: unknown; error: unknown } = { data: [], error: null }) {
  const appels: unknown[][] = [];
  const appelRpc = vi.fn().mockResolvedValue(rpc);
  const chaine = { select: (...a: unknown[]) => { appels.push(["select", ...a]); return chaine; }, in: async (...a: unknown[]) => { appels.push(["in", ...a]); return lecture; } };
  return { appels, rpc: appelRpc, client: { rpc: appelRpc, from: (t: string) => { appels.push(["from", t]); return chaine; } } as unknown as SupabaseClient<Database> };
}

describe("US-32.2 : envoi à la base", () => {
  it("donner_avis reçoit la saisie vérifiée ; renvoie l'avis", async () => {
    const test = client({ data: { avis: "a1" }, error: null });
    expect(await donnerAvis(test.client, ID, { note: 5, criteres: ["rapidite", "accueil"], commentaire: " Top " })).toBe("a1");
    expect(test.rpc).toHaveBeenCalledWith("donner_avis", { commande: ID, note: 5, criteres: ["accueil", "rapidite"], commentaire: "Top" });
    await donnerAvis(test.client, ID, { note: 2, criteres: [], commentaire: "" });
    expect(test.rpc).toHaveBeenLastCalledWith("donner_avis", { commande: ID, note: 2, criteres: [], commentaire: undefined });
  });
  it("saisie ou commande invalide : rien n'est envoyé", async () => {
    const test = client({ data: { avis: "a1" }, error: null });
    await expect(donnerAvis(test.client, "pas-un-id", { note: 5 })).rejects.toThrow("Commande introuvable.");
    await expect(donnerAvis(test.client, ID, { note: 0 })).rejects.toThrow(MESSAGES_AVIS.note);
    expect(test.rpc).not.toHaveBeenCalled();
  });
  it("erreurs voulues de la base (filtre, délai, déjà donné) : message de la base ; autre erreur : message général", async () => {
    const filtre = "Votre commentaire ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.";
    await expect(donnerAvis(client({ data: null, error: { code: "22023", message: filtre } }).client, ID, { note: 5, commentaire: "0555 12 34 56" })).rejects.toThrow(filtre);
    await expect(donnerAvis(client({ data: null, error: { code: "23505", message: "Vous avez déjà donné votre avis sur cette commande." } }).client, ID, { note: 5 })).rejects.toThrow("déjà donné");
    await expect(donnerAvis(client({ data: null, error: { code: "XX000", message: "détail interne" } }).client, ID, { note: 5 })).rejects.toThrow(MESSAGES_AVIS.impossible);
    await expect(donnerAvis(client({ data: {}, error: null }).client, ID, { note: 5 })).rejects.toThrow(MESSAGES_AVIS.impossible);
    expect(messageErreurAvis({ code: "42501", message: "" })).toBe(MESSAGES_AVIS.impossible);
  });
  it("notes déjà données : lues dans la table (la base ne montre que les avis du client)", async () => {
    const test = client({ data: null, error: null }, { data: [{ commande_id: ID, note: 4 }], error: null });
    expect(await lireMesNotes(test.client, [ID, "x"])).toEqual(new Map([[ID, 4]]));
    expect(test.appels).toContainEqual(["from", "avis"]);
    expect(test.appels).toContainEqual(["in", "commande_id", [ID]]);
    expect(await lireMesNotes(client({ data: null, error: null }).client, ["x"])).toEqual(new Map());
    await expect(lireMesNotes(client({ data: null, error: null }, { data: null, error: { message: "x" } }).client, [ID])).rejects.toThrow("Impossible de charger vos avis");
  });
});

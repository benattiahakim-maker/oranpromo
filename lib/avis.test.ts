import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { avisPossible, criteresCites, donnerAvis, etoiles, formaterMois, formaterMoyenne, lireAvisBoutique, lireMesNotes, lireResumes, messageErreurAvis, trierMieuxNotees, verifierSaisieAvis, MESSAGES_AVIS } from "./avis";

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

describe("US-32.3 : lectures publiques", () => {
  const B1 = "22222222-2222-2222-2222-222222222222", B2 = "33333333-3333-3333-3333-333333333333";
  it("resume_avis : une requête pour toutes les boutiques (sans doublon, identifiants valides), moyenne vide sous le seuil", async () => {
    const test = client({ data: [{ boutique_id: B1, nombre: 18, moyenne: 4.6, criteres: { accueil: 12, article_conforme: 9, rapidite: 6 } }, { boutique_id: B2, nombre: 2, moyenne: null, criteres: null }], error: null });
    const resumes = await lireResumes(test.client, [B1, B2, B1, "x"]);
    expect(test.rpc).toHaveBeenCalledTimes(1);
    expect(test.rpc).toHaveBeenCalledWith("resume_avis", { boutiques: [B1, B2] });
    expect(resumes.get(B1)).toEqual({ nombre: 18, moyenne: 4.6, criteres: { accueil: 12, article_conforme: 9, rapidite: 6 } });
    expect(resumes.get(B2)).toEqual({ nombre: 2, moyenne: null, criteres: { accueil: 0, article_conforme: 0, rapidite: 0 } });
    const vide = client({ data: [], error: null });
    expect(await lireResumes(vide.client, ["x"])).toEqual(new Map()); expect(vide.rpc).not.toHaveBeenCalled();
    await expect(lireResumes(client({ data: null, error: { message: "x" } }).client, [B1])).rejects.toThrow("Impossible de charger les avis.");
  });
  it("avis_boutique : derniers avis (critères inconnus ignorés) ; boutique invalide : rien", async () => {
    const test = client({ data: [{ id: "a1", auteur: "Amine B.", note: 5, criteres: ["accueil", "x"], commentaire: "Top", mois: "2026-10-01", reponse: null }], error: null });
    expect(await lireAvisBoutique(test.client, B1)).toEqual([{ id: "a1", auteur: "Amine B.", note: 5, criteres: ["accueil"], commentaire: "Top", mois: "2026-10-01", reponse: null }]);
    expect(test.rpc).toHaveBeenCalledWith("avis_boutique", { boutique: B1, limite: 5, decalage: 0 });
    expect(await lireAvisBoutique(test.client, "x")).toEqual([]);
    await expect(lireAvisBoutique(client({ data: null, error: { message: "x" } }).client, B1)).rejects.toThrow("Impossible de charger les avis.");
  });
});

describe("US-32.3 : format", () => {
  it("moyenne « 4,6 », étoiles, mois en français et en arabe", () => {
    expect(formaterMoyenne(4.6)).toBe("4,6"); expect(formaterMoyenne(4)).toBe("4,0");
    expect(etoiles(4)).toBe("★★★★☆"); expect(etoiles(5)).toBe("★★★★★"); expect(etoiles(9)).toBe("★★★★★");
    expect(formaterMois("2026-10-01", "fr")).toBe("octobre 2026");
    expect(formaterMois("2026-10-01", "ar")).toBe("أكتوبر 2026");
    expect(formaterMois("pas une date", "fr")).toBe("");
  });
  it("critères les plus cités d'abord, jamais ceux à 0", () => {
    expect(criteresCites({ criteres: { accueil: 6, article_conforme: 12, rapidite: 0 } })).toEqual([{ critere: "article_conforme", nombre: 12 }, { critere: "accueil", nombre: 6 }]);
  });
  it("« Mieux notées » : moyenne décroissante, puis nombre d'avis ; sous le seuil (sans moyenne) ou sans avis à la fin, ordre gardé", () => {
    const r = (moyenne: number | null, nombre: number) => ({ moyenne, nombre, criteres: { accueil: 0, article_conforme: 0, rapidite: 0 } });
    const resumes = new Map([["nour", r(4.6, 18)], ["dar", r(4.2, 7)], ["kids", r(null, 1)], ["egal", r(4.6, 3)]]);
    const liste = ["sans", "kids", "dar", "egal", "nour"];
    expect(trierMieuxNotees(liste, x => x, resumes)).toEqual(["nour", "egal", "dar", "sans", "kids"]);
  });
});

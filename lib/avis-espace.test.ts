// US-32.4 : réponse de la boutique et avis dans l'espace commerçant.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { formaterJourMois, lireAvisMaBoutique, lireResumeMaBoutique, MESSAGES_REPONSE, repondreAvis, texteResumeEspace, verifierReponse } from "./avis";

const ID = "f3240000-0000-0000-0000-000000000001";
const client = (resultat: { data: unknown; error: unknown }) => {
  const rpc = vi.fn().mockResolvedValue(resultat);
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
};

describe("réponse de la boutique (une seule, 300 caractères, même filtre)", () => {
  it("vérifie la réponse avant l'envoi : non vide, 300 caractères au plus, sans espaces autour", () => {
    expect(verifierReponse("  Merci Sara  ")).toBe("Merci Sara");
    expect(() => verifierReponse("   ")).toThrow(MESSAGES_REPONSE.vide);
    expect(() => verifierReponse(undefined)).toThrow(MESSAGES_REPONSE.vide);
    expect(verifierReponse("é".repeat(300))).toHaveLength(300);
    expect(() => verifierReponse("a".repeat(301))).toThrow("300 caractères au plus");
  });
  it("appelle repondre_avis avec le texte nettoyé", async () => {
    const t = client({ data: null, error: null });
    await repondreAvis(t.client, ID, "  Désolés pour l’attente, merci Sara.  ");
    expect(t.rpc).toHaveBeenCalledWith("repondre_avis", { avis: ID, texte: "Désolés pour l’attente, merci Sara." });
  });
  it("refuse un identifiant invalide ou une réponse vide sans appeler la base", async () => {
    const t = client({ data: null, error: null });
    await expect(repondreAvis(t.client, "x", "Merci")).rejects.toThrow("Avis introuvable.");
    await expect(repondreAvis(t.client, ID, " ")).rejects.toThrow(MESSAGES_REPONSE.vide);
    expect(t.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["23505", "Vous avez déjà répondu à cet avis."],
    ["22023", "Votre réponse ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier."],
    ["42501", "Réservé à la boutique."],
    ["P0002", "Avis introuvable."],
  ])("relaie le refus %s de la base", async (code, message) => {
    await expect(repondreAvis(client({ data: null, error: { code, message } }).client, ID, "Merci")).rejects.toThrow(message);
  });
  it("erreur inattendue : message générique (jamais le détail technique)", async () => {
    await expect(repondreAvis(client({ data: null, error: { code: "XX000", message: "détail interne" } }).client, ID, "Merci")).rejects.toThrow(MESSAGES_REPONSE.impossible);
  });
});

describe("avis dans l'espace", () => {
  it("lit les avis de la boutique (critères connus seulement, réponse masquée signalée)", async () => {
    const t = client({ data: [{ id: ID, auteur: "Sara K.", note: 3, criteres: ["accueil", "inconnu"], commentaire: "Attente", cree_le: "2026-10-02T09:00:00Z", reponse: null, reponse_le: null, reponse_masquee: false },
      { id: "2", auteur: "Amine B.", note: 5, criteres: [], commentaire: null, cree_le: "2026-10-01T09:00:00Z", reponse: "Merci", reponse_le: "2026-10-01T10:00:00Z", reponse_masquee: true }], error: null });
    const avis = await lireAvisMaBoutique(t.client);
    expect(t.rpc).toHaveBeenCalledWith("avis_ma_boutique", { limite: 50 });
    expect(avis[0]).toEqual({ id: ID, auteur: "Sara K.", note: 3, criteres: ["accueil"], commentaire: "Attente", creeLe: "2026-10-02T09:00:00Z", reponse: null, reponseLe: null, reponseMasquee: false });
    expect(avis[1].reponseMasquee).toBe(true);
    await expect(lireAvisMaBoutique(client({ data: null, error: { message: "x" } }).client)).rejects.toThrow(MESSAGES_REPONSE.chargement);
  });
  it("lit le résumé (moyenne vide sous le seuil)", async () => {
    expect(await lireResumeMaBoutique(client({ data: [{ nombre: 18, moyenne: "4.6", sans_reponse: 2 }], error: null }).client)).toEqual({ nombre: 18, moyenne: 4.6, sansReponse: 2 });
    expect(await lireResumeMaBoutique(client({ data: [{ nombre: 2, moyenne: null, sans_reponse: 1 }], error: null }).client)).toEqual({ nombre: 2, moyenne: null, sansReponse: 1 });
    await expect(lireResumeMaBoutique(client({ data: [], error: null }).client)).rejects.toThrow(MESSAGES_REPONSE.chargement);
  });
  it("« ★ 4,6 · 18 avis · 2 sans réponse » (maquette ⑦)", () => {
    expect(texteResumeEspace({ nombre: 18, moyenne: 4.6, sansReponse: 2 })).toBe("★ 4,6 · 18 avis · 2 sans réponse");
    expect(texteResumeEspace({ nombre: 18, moyenne: 4.6, sansReponse: 0 })).toBe("★ 4,6 · 18 avis");
    expect(texteResumeEspace({ nombre: 2, moyenne: null, sansReponse: 1 })).toBe("2 avis · 1 sans réponse");
    expect(texteResumeEspace({ nombre: 0, moyenne: null, sansReponse: 0 })).toBe("Pas encore d’avis");
  });
  it("date courte « 2/10 » à l'heure d'Alger", () => {
    expect(formaterJourMois("2026-10-02T09:00:00Z")).toBe("2/10");
    expect(formaterJourMois("2026-10-01T23:30:00Z")).toBe("2/10");
    expect(formaterJourMois("x")).toBe("");
  });
});

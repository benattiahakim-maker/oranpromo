import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { adresseIp, cleVisiteur, evenementValide, MESSAGE_SIGNALEMENT_ECHEC, MESSAGE_SIGNALEMENT_INDISPONIBLE, mesurerEvenement, signalerArticle, signalerAvis } from "./visiteurs";

const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient<Database>;
const SECRET = "secret-visiteurs-0123456789";
const BOUTIQUE = "d8000000-0000-0000-0000-000000000001";
const ARTICLE = "e8000000-0000-0000-0000-000000000001";
const entetes = (valeurs: Record<string, string> = { "x-real-ip": "105.98.1.2" }) => new Headers(valeurs);

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VISITEURS_SECRET", SECRET); vi.stubEnv("VERCEL", "1"); rpc.mockResolvedValue({ data: true, error: null }); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("limites par visiteur : clé du visiteur anonyme", () => {
  it("lit l’adresse IP donnée par l’hébergeur (x-real-ip, sinon la première de x-forwarded-for)", () => {
    expect(adresseIp(entetes())).toBe("105.98.1.2");
    expect(adresseIp(entetes({ "x-forwarded-for": "41.200.3.4, 10.0.0.1" }))).toBe("41.200.3.4");
    expect(adresseIp(entetes({}))).toBe("inconnue");
  });
  it("relecture n°6, point 7 : hors de Vercel (VERCEL absent), x-real-ip et x-forwarded-for ne sont pas lus (falsifiables)", async () => {
    vi.stubEnv("VERCEL", "");
    expect(adresseIp(entetes())).toBe("inconnue");
    expect(adresseIp(entetes({ "x-forwarded-for": "41.200.3.4" }))).toBe("inconnue");
    expect(adresseIp(entetes({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("inconnue");
    await mesurerEvenement(client, entetes({ "x-real-ip": "9.9.9.9" }), { type: "vue_boutique", boutiqueId: BOUTIQUE });
    expect(rpc).toHaveBeenLastCalledWith("enregistrer_evenement", expect.objectContaining({ visiteur: cleVisiteur("inconnue", SECRET) }));
  });
  it("transforme l’IP en empreinte HMAC-SHA256 : jamais l’IP en clair, impossible à fabriquer sans le secret", () => {
    const cle = cleVisiteur("105.98.1.2", SECRET);
    expect(cle).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(cle).not.toContain("105.98");
    expect(cleVisiteur("105.98.1.2", SECRET)).toBe(cle);
    expect(cleVisiteur("105.98.1.3", SECRET)).not.toBe(cle);
    expect(cleVisiteur("105.98.1.2", "un-autre-secret-0123456")).not.toBe(cle);
  });
});

describe("limites par visiteur : mesures (vues, clics « Ajouter au panier », partages)", () => {
  it("passe par la fonction de la base avec le secret serveur et l’empreinte du visiteur", async () => {
    expect(await mesurerEvenement(client, entetes(), { type: "clic_reserver", boutiqueId: BOUTIQUE, articleId: ARTICLE, taille: "M" })).toBe(true);
    expect(rpc).toHaveBeenCalledWith("enregistrer_evenement", { jeton: SECRET, visiteur: cleVisiteur("105.98.1.2", SECRET), type: "clic_reserver", boutique: BOUTIQUE, article: ARTICLE, taille: "M" });
  });
  it("vue de boutique : sans article ni taille", async () => {
    await mesurerEvenement(client, entetes(), { type: "vue_boutique", boutiqueId: BOUTIQUE });
    expect(rpc).toHaveBeenCalledWith("enregistrer_evenement", { jeton: SECRET, visiteur: expect.stringMatching(/^ip:/), type: "vue_boutique", boutique: BOUTIQUE });
  });
  it("doublon ou limite atteinte (la base répond false) : mesure ignorée sans erreur", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await mesurerEvenement(client, entetes(), { type: "vue_article", boutiqueId: BOUTIQUE, articleId: ARTICLE })).toBe(false);
  });
  it("erreur de la base ou réseau : ignorée, la page continue", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "Trop d'événements" } });
    expect(await mesurerEvenement(client, entetes(), { type: "partage", boutiqueId: BOUTIQUE, articleId: ARTICLE })).toBe(false);
    rpc.mockRejectedValue(new Error("réseau"));
    expect(await mesurerEvenement(client, entetes(), { type: "partage", boutiqueId: BOUTIQUE, articleId: ARTICLE })).toBe(false);
  });
  it("sans VISITEURS_SECRET : rien n’est envoyé", async () => {
    vi.stubEnv("VISITEURS_SECRET", "");
    expect(await mesurerEvenement(client, entetes(), { type: "vue_boutique", boutiqueId: BOUTIQUE })).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuse une saisie invalide avant la base", async () => {
    expect(evenementValide({ type: "vue_boutique", boutiqueId: "pas-un-uuid" })).toBe(false);
    expect(evenementValide({ type: "inconnu" as never, boutiqueId: BOUTIQUE })).toBe(false);
    expect(evenementValide({ type: "clic_reserver", boutiqueId: BOUTIQUE, articleId: ARTICLE, taille: "x".repeat(21) })).toBe(false);
    expect(await mesurerEvenement(client, entetes(), { type: "vue_article", boutiqueId: BOUTIQUE, articleId: "1234" })).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("limites par visiteur : signalements", () => {
  it("passe par la fonction de la base avec le secret, l’empreinte et le commentaire nettoyé", async () => {
    await signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "arnaque", commentaire: "  À vérifier  " });
    expect(rpc).toHaveBeenCalledWith("signaler_article", { jeton: SECRET, visiteur: cleVisiteur("105.98.1.2", SECRET), article: ARTICLE, motif: "arnaque", commentaire: "À vérifier" });
  });
  it("refuse un motif inconnu ou un commentaire trop long avant la base", async () => {
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "spam" })).rejects.toThrow("Choisissez un motif.");
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre", commentaire: "a".repeat(1001) })).rejects.toThrow("1000 caractères au plus");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("relaie les refus de la base en français (déjà signalé, trop de signalements)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "Vous avez déjà signalé cet article, merci. Il sera examiné rapidement." } });
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre" })).rejects.toThrow("Vous avez déjà signalé cet article");
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "Trop de signalements envoyés : réessayez dans une heure." } });
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre" })).rejects.toThrow("Trop de signalements envoyés");
  });
  it("secret absent ou refusé par la base : message « pas disponible » ; autre erreur : message générique", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Accès refusé." } });
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre" })).rejects.toThrow(MESSAGE_SIGNALEMENT_INDISPONIBLE);
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "détail interne" } });
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre" })).rejects.toThrow(MESSAGE_SIGNALEMENT_ECHEC);
    vi.stubEnv("VISITEURS_SECRET", "");
    rpc.mockClear();
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "autre" })).rejects.toThrow(MESSAGE_SIGNALEMENT_INDISPONIBLE);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("US-32.4 : signaler un avis (mêmes limites que les articles)", () => {
  const AVIS = "f3240000-0000-0000-0000-000000000002";
  it("passe par signaler_avis avec le secret, l’empreinte et le commentaire nettoyé", async () => {
    await signalerAvis(client, entetes(), { avisId: AVIS, motif: "faux_avis", commentaire: "  Pas une cliente  " });
    expect(rpc).toHaveBeenCalledWith("signaler_avis", { jeton: SECRET, visiteur: cleVisiteur("105.98.1.2", SECRET), avis: AVIS, motif: "faux_avis", commentaire: "Pas une cliente" });
  });
  it("motifs des avis seulement (un motif d’article est refusé avant la base)", async () => {
    await expect(signalerAvis(client, entetes(), { avisId: AVIS, motif: "arnaque" })).rejects.toThrow("Choisissez un motif.");
    await expect(signalerAvis(client, entetes(), { avisId: AVIS, motif: "autre", commentaire: "a".repeat(1001) })).rejects.toThrow("1000 caractères au plus");
    await expect(signalerAvis(client, entetes(), { avisId: "x", motif: "autre" })).rejects.toThrow(MESSAGE_SIGNALEMENT_ECHEC);
    await expect(signalerArticle(client, entetes(), { articleId: ARTICLE, motif: "faux_avis" })).rejects.toThrow("Choisissez un motif.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["faux_avis", "insulte", "informations_personnelles", "autre"])("accepte le motif %s", async motif => {
    await signalerAvis(client, entetes(), { avisId: AVIS, motif });
    expect(rpc).toHaveBeenCalledWith("signaler_avis", expect.objectContaining({ motif }));
  });
  it("relaie les refus de la base ; secret absent : « pas disponible »", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "Vous avez déjà signalé cet avis, merci. Il sera examiné rapidement." } });
    await expect(signalerAvis(client, entetes(), { avisId: AVIS, motif: "autre" })).rejects.toThrow("déjà signalé cet avis");
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Cet avis n'est plus en ligne." } });
    await expect(signalerAvis(client, entetes(), { avisId: AVIS, motif: "autre" })).rejects.toThrow("plus en ligne");
    vi.stubEnv("VISITEURS_SECRET", ""); rpc.mockClear();
    await expect(signalerAvis(client, entetes(), { avisId: AVIS, motif: "autre" })).rejects.toThrow(MESSAGE_SIGNALEMENT_INDISPONIBLE);
    expect(rpc).not.toHaveBeenCalled();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Moderation from "./page";
const { verifier, charger, historique, chargerAvis, signaux, mots } = vi.hoisted(() => ({ verifier: vi.fn(), charger: vi.fn(), historique: vi.fn(), chargerAvis: vi.fn(), signaux: vi.fn(), mots: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/moderation")>(), verifierAdministrateur: verifier, chargerSignalements: charger, chargerHistoriqueModeration: historique, chargerSignalementsAvis: chargerAvis, chargerSignauxAvis: signaux, chargerMotsInterdits: mots }));
vi.mock("@/components/MotsInterdits", () => ({ default: ({ mots }: { mots: string[] }) => <p>Mots {mots.join(",")}</p> }));
vi.mock("@/components/SignalementsAvisModeration", () => ({ default: ({ groupes, signaux }: { groupes: unknown[]; signaux: unknown[] }) => <p>File avis {groupes.length} / signaux {signaux.length}</p> }));
vi.mock("@/components/SignalementsModeration", () => ({ default: () => <p>File ouverte</p> }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); charger.mockResolvedValue([]); historique.mockResolvedValue([]); chargerAvis.mockResolvedValue([]); signaux.mockResolvedValue([]); mots.mockResolvedValue([]); });
describe("accès et historique US-18", () => {
  it("refuse un ambassadeur avant de charger des données privées", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({}) }))).toContain("Accès réservé");
    expect(charger).not.toHaveBeenCalled();
    expect(historique).not.toHaveBeenCalled();
  });
  it("affiche la date, l’action et l’article dans l’onglet Historique", async () => {
    historique.mockResolvedValue([{ id: "d1", date: "2026-10-09T10:00:00Z", action: "masquer", titre: "Polo bleu", articleId: "a1" }]);
    const html = renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "historique" }) }));
    expect(html).toContain("Polo bleu");
    expect(html).toContain("Masquer l’article");
    expect(html).toContain('dateTime="2026-10-09T10:00:00Z"');
    expect(charger).not.toHaveBeenCalled();
  });
  it("signale une erreur de chargement", async () => {
    charger.mockRejectedValue(new Error("réseau"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({}) }))).toContain("Impossible de charger la modération");
  });
});

describe("US-32.4 : onglet Avis", () => {
  it("trois onglets ; l’onglet Avis charge les avis signalés et le signal, pas les articles", async () => {
    chargerAvis.mockResolvedValue([{ avisId: "v1" }]); signaux.mockResolvedValue([{ boutique: "Dar Lebsa" }]);
    const html = renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "avis" }) }));
    expect(html).toContain("File avis 1 / signaux 1");
    expect(html).toMatch(/aria-current="page"[^>]*>Avis</);
    expect(html).toContain("Signalements ouverts"); expect(html).toContain("Historique");
    expect(charger).not.toHaveBeenCalled();
  });
  it("le signal en échec ne bloque pas la file ; la file en échec affiche l’erreur", async () => {
    signaux.mockRejectedValue(new Error("x"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "avis" }) }))).toContain("File avis 0 / signaux 0");
    chargerAvis.mockRejectedValue(new Error("x"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "avis" }) }))).toContain("Impossible de charger la modération");
  });
  it("historique : libellé des décisions sur les avis", async () => {
    historique.mockResolvedValue([{ id: "d1", date: "2026-10-09T10:00:00Z", action: "masquer_reponse", titre: "Avis de Amine B. · Boutique Nour", articleId: null }]);
    const html = renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "historique" }) }));
    expect(html).toContain("Avis de Amine B. · Boutique Nour"); expect(html).toContain("Masquer la réponse");
  });
});

describe("US-32 : onglet Mots interdits", () => {
  it("quatre onglets ; l’onglet Mots interdits charge la liste, rien d’autre", async () => {
    mots.mockResolvedValue(["fdp", "zebi"]);
    const html = renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "mots" }) }));
    expect(html).toContain("Mots fdp,zebi");
    expect(html).toMatch(/aria-current="page"[^>]*>Mots interdits</);
    expect(html).toContain('href="/admin/moderation?onglet=mots"');
    expect(charger).not.toHaveBeenCalled(); expect(chargerAvis).not.toHaveBeenCalled(); expect(historique).not.toHaveBeenCalled();
  });
  it("liste en échec : message d’erreur", async () => {
    mots.mockRejectedValue(new Error("x"));
    expect(renderToStaticMarkup(await Moderation({ searchParams: Promise.resolve({ onglet: "mots" }) }))).toContain("Impossible de charger la modération");
  });
});

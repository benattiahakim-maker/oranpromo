import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AvisEspacePage from "./page";

const { getUser, redirect, maybeSingle, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn((chemin: string): never => { throw new Error(`redirection:${chemin}`); }), maybeSingle: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }), rpc }) }));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/espace/avis/actions", () => ({ publierReponse: vi.fn() }));
vi.mock("@/app/visiteurs/actions", () => ({ envoyerSignalementAvis: vi.fn() }));

const avis = [
  { id: "v2", auteur: "Sara K.", note: 3, criteres: [], commentaire: "Un peu d’attente au retrait.", cree_le: "2026-10-02T09:00:00Z", reponse: null, reponse_le: null, reponse_masquee: false },
  { id: "v1", auteur: "Amine B.", note: 5, criteres: ["accueil"], commentaire: "Très bon accueil.", cree_le: "2026-10-01T09:00:00Z", reponse: "Merci Amine", reponse_le: "2026-10-01T10:00:00Z", reponse_masquee: true },
];
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "commercant" } }, error: null });
  maybeSingle.mockResolvedValue({ data: { boutique_id: "b1" }, error: null });
  rpc.mockImplementation(async (fn: string) => fn === "resume_ma_boutique" ? { data: [{ nombre: 18, moyenne: 4.6, sans_reponse: 2 }], error: null } : { data: avis, error: null });
});

describe("US-32.4 : /espace/avis", () => {
  it("protège la page sans session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(AvisEspacePage()).rejects.toThrow("redirection:/espace/connexion");
  });
  it("résumé, avis sans réponse avec le formulaire, réponse donnée sans formulaire, « Signaler » et rappel « pas de suppression »", async () => {
    const html = renderToStaticMarkup(await AvisEspacePage());
    expect(html).toContain("★ 4,6 · 18 avis · 2 sans réponse");
    expect(html).toContain("Sara K.");
    expect(html).toContain("2/10");
    expect(html.match(/Votre réponse publique \(une seule fois\)/g)).toHaveLength(1);
    expect(html).toContain("Votre réponse : Merci Amine");
    expect(html).toContain("Masquée par la modération");
    expect(html).toContain("Bon accueil");
    expect(html.match(/>Signaler</g)).toHaveLength(2);
    expect(html).toContain("Vous ne pouvez pas supprimer un avis. Un avis faux ou insultant : « Signaler ».");
    expect(html).not.toMatch(/Supprimer|Modifier/);
    expect(rpc).toHaveBeenCalledWith("avis_ma_boutique", { limite: 50 });
  });
  it("aucun avis ; sous le seuil, rappel que la note s'affiche à partir de 3 avis", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "resume_ma_boutique" ? { data: [{ nombre: 0, moyenne: null, sans_reponse: 0 }], error: null } : { data: [], error: null });
    expect(renderToStaticMarkup(await AvisEspacePage())).toContain("Pas encore d’avis");
    rpc.mockImplementation(async (fn: string) => fn === "resume_ma_boutique" ? { data: [{ nombre: 2, moyenne: null, sans_reponse: 2 }], error: null } : { data: avis.slice(0, 1), error: null });
    expect(renderToStaticMarkup(await AvisEspacePage())).toContain("à partir de 3 avis");
  });
  it("erreur de chargement ; compte sans boutique", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(renderToStaticMarkup(await AvisEspacePage())).toContain("Impossible de charger vos avis. Réessayez.");
    maybeSingle.mockResolvedValue({ data: { boutique_id: null }, error: null }); rpc.mockClear();
    expect(renderToStaticMarkup(await AvisEspacePage())).toContain("rattaché à aucune boutique");
    expect(rpc).not.toHaveBeenCalled();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const etat = vi.hoisted(() => ({ compteurs: {} as Record<string, number>, lignes: [] as unknown[], appels: [] as unknown[][] }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/form", () => ({ default: ({ children, ...p }: { children: React.ReactNode }) => <form {...p}>{children}</form> }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique: vi.fn(), declarerClientPasVenu: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
  from: (table: string) => {
    if (table === "profils") { const c: Record<string, unknown> = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: { boutique_id: "b1", boutiques: { nom: "Parfumerie Démo" } }, error: null }) }; return c; }
    let head = false, statuts: string[] = [];
    const c: Record<string, unknown> = {
      select: (_: string, o?: { head?: boolean }) => { head = Boolean(o?.head); return c; },
      eq: (...a: unknown[]) => { etat.appels.push(["eq", ...a]); return c; }, ilike: (...a: unknown[]) => { etat.appels.push(["ilike", ...a]); return c; },
      in: (_: string, s: string[]) => { statuts = s; etat.appels.push(["in", s.join(",")]); return c; }, gte: () => c, order: () => c,
      limit: async () => ({ data: etat.lignes, error: null }),
      then: (ok: (v: unknown) => void) => ok(head ? { count: etat.compteurs[statuts[0]] ?? 0, error: null } : { data: [], error: null }),
    };
    return c;
  },
}) }));
const afficher = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
beforeEach(() => { etat.compteurs = { demandee: 0, confirmee: 2, prete: 1, recuperee: 4 }; etat.lignes = []; etat.appels = []; });

describe("US-28.1 : page /espace/commandes", () => {
  it("compteurs des 4 étapes ; ouvre la première étape non vide (décision 10)", async () => {
    const html = await afficher({});
    expect(html).toMatch(/aria-current="page"[^>]*><span[^>]*>À préparer<\/span><span[^>]*>2</);
    expect(html).toContain("Terminées</span><span class=\"text-[17px] \">4</span>");
    expect(etat.appels).toContainEqual(["in", "confirmee"]);
    expect(html).toContain("Aucune commande à préparer.");
  });
  it("l’ancienne adresse ?vue=terminees mène à « Terminées »", async () => {
    const html = await afficher({ vue: "terminees" });
    expect(html).toMatch(/aria-current="page"[^>]*><span[^>]*>Terminées/);
  });
  it("garde le bouton « Scanner un QR code client » et la recherche", async () => {
    const html = await afficher({ etape: "pretes" });
    expect(html).toContain('href="/espace/scanner"');
    expect(html).toContain('aria-label="Scanner un QR code client"');
    expect(html).toContain('placeholder="N° ou prénom"');
    expect(html).toContain('name="etape" value="pretes"');
  });
  it("recherche : toutes les étapes, sans onglets, nombre de résultats", async () => {
    const html = await afficher({ q: "ami" });
    expect(html).toContain("0 résultat pour « ami » · toutes les étapes");
    expect(html).toContain("Aucune commande ne correspond.");
    expect(html).not.toContain('aria-label="Étapes"');
    expect(etat.appels).toContainEqual(["ilike", "client_nom", "ami%"]);
    expect(html).toContain('aria-label="Effacer la recherche"');
  });
});

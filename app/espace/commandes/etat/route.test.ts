import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const etat = vi.hoisted(() => ({ boutique: "b1" as string | null, erreur: false, appels: [] as unknown[][] }));
vi.mock("@/lib/gestion-articles", () => ({ boutiqueDuCompte: async () => { if (!etat.boutique) throw new Error("Votre compte n’est rattaché à aucune boutique"); return etat.boutique; } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ from: () => {
  let head = false; let statuts: string[] = [];
  const c: Record<string, unknown> = {
    select: (...a: unknown[]) => { etat.appels.push(["select", ...a]); head = Boolean((a[1] as { head?: boolean } | undefined)?.head); return c; },
    eq: (...a: unknown[]) => { etat.appels.push(["eq", ...a]); return c; }, in: (_: string, s: string[]) => { statuts = s; return c; }, gte: () => c, order: () => c,
    limit: async () => etat.erreur ? { data: null, error: { message: "x" } } : { data: [{ numero: 134 }], error: null },
    then: (ok: (v: unknown) => void) => ok(head ? { count: { demandee: 3, confirmee: 2, prete: 1, recuperee: 5 }[statuts[0]] ?? 0, error: null } : { data: [], error: null }),
  };
  return c;
} }) }));
beforeEach(() => { etat.boutique = "b1"; etat.erreur = false; etat.appels = []; });

describe("US-28.4 : GET /espace/commandes/etat", () => {
  it("renvoie les compteurs et le dernier numéro, sans donnée personnelle, jamais mis en cache", async () => {
    const reponse = await GET();
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Cache-Control")).toBe("private, no-store");
    const corps = await reponse.json();
    expect(corps).toEqual({ a_confirmer: 3, a_preparer: 2, pretes: 1, terminees: 5, derniere: 134 });
    expect(JSON.stringify(corps)).not.toMatch(/nom|telephone|client|total/);
    // Seulement des compteurs (head) et le numéro : aucune colonne personnelle n’est lue.
    expect(etat.appels.filter(a => a[0] === "select").map(a => a[1])).toEqual(["id", "id", "id", "id", "numero"]);
    expect(etat.appels).toContainEqual(["eq", "boutique_id", "b1"]);
  });
  it("401 sans boutique (client, visiteur ou session expirée)", async () => {
    etat.boutique = null;
    const reponse = await GET();
    expect(reponse.status).toBe(401);
    expect(etat.appels).toEqual([]);
  });
  it("503 si la base ne répond pas", async () => {
    etat.erreur = true;
    expect((await GET()).status).toBe(503);
  });
});

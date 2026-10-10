import { describe, expect, it, vi } from "vitest";
import { formaterDate, lireMesDonnees } from "./donnees-compte";
import { chercherAcceptations, compterAcceptations, nettoyerRecherche } from "./acceptations-admin";

// Faux client Supabase : chaque table rend la réponse donnée, quelle que soit la chaîne de filtres.
function faux(tables: Record<string, unknown>, rpc: unknown = { data: [], error: null }, user: unknown = { id: "u1" }) {
  const appels: { table: string; filtres: unknown[][] }[] = [];
  const from = vi.fn((table: string) => {
    const filtres: unknown[][] = [];
    appels.push({ table, filtres });
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "in", "or"]) chaine[m] = (...a: unknown[]) => { filtres.push([m, ...a]); return chaine; };
    chaine.maybeSingle = () => Promise.resolve(tables[table]);
    chaine.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(tables[table]).then(ok, ko);
    return chaine;
  });
  return { client: { auth: { getUser: async () => ({ data: { user }, error: null }) }, from, rpc: vi.fn(async () => rpc) } as never, appels };
}

describe("US-34.4 : lireMesDonnees", () => {
  const tables = {
    profils: { data: { nom: "Lina Amrani", telephone: "+213555123456", telephone_verifie_le: "2026-10-02T10:00:00Z", cree_le: "2026-10-01T10:00:00Z" }, error: null },
    commandes: { data: [{ cree_le: "2026-10-09T10:00:00Z" }], count: 4, error: null },
    avis: { data: [], count: 0, error: null },
    abonnements_boutique: { data: [{ cree_le: "2026-10-03T10:00:00Z", boutiques: { nom: "Boutique Nour" } }], error: null },
    acceptations: { data: [{ document: "conditions", version: "2026-10-10", accepte_le: "2026-10-10T09:00:00Z", contexte: "inscription" }, { document: "autre", version: "2026-10-10", accepte_le: "2026-10-10T09:00:00Z", contexte: "x" }], error: null },
  };
  it("rassemble numéro, nom, compte, commandes, bons, avis, boutiques suivies et accords, seulement pour le compte connecté", async () => {
    const { client, appels } = faux(tables, { data: [{ cree_le: "2026-10-05T10:00:00Z" }, { cree_le: "2026-10-08T10:00:00Z" }], error: null });
    const d = (await lireMesDonnees(client))!;
    expect(d).toMatchObject({ nom: "Lina Amrani", telephone: "+213555123456", commandes: { nombre: 4, dernier: "2026-10-09T10:00:00Z" },
      bons: { nombre: 2, dernier: "2026-10-08T10:00:00Z" }, avis: { nombre: 0, dernier: null }, boutiques: [{ nom: "Boutique Nour", depuis: "2026-10-03T10:00:00Z" }] });
    expect(d.accords).toEqual([{ document: "conditions", version: "2026-10-10", accepteLe: "2026-10-10T09:00:00Z", contexte: "inscription" }]);
    // Chaque lecture est filtrée sur le compte connecté (en plus des règles d'accès de la base).
    for (const [table, colonne] of [["profils", "id"], ["commandes", "client_id"], ["avis", "client_id"], ["abonnements_boutique", "profil_id"], ["acceptations", "profil_id"]]) {
      expect(appels.find(a => a.table === table)!.filtres).toContainEqual(["eq", colonne, "u1"]);
    }
  });
  it("pas connecté : null ; une lecture impossible : erreur (jamais une page à moitié vide)", async () => {
    expect(await lireMesDonnees(faux(tables, undefined, null).client)).toBeNull();
    await expect(lireMesDonnees(faux({ ...tables, avis: { data: null, error: { message: "x" } } }).client)).rejects.toThrow("Impossible de charger vos données. Réessayez.");
  });
  it("dates à l'heure d'Alger", () => {
    expect(formaterDate("2026-10-09T23:30:00Z")).toBe("10/10/2026");
  });
});

describe("US-34.4 : registre des acceptations (admin)", () => {
  it("nettoyerRecherche : numéro sans indicatif ni 0, nom, trop court, caractères du filtre retirés", () => {
    expect(nettoyerRecherche("+213 555 12 34 56")).toBe("555123456");
    expect(nettoyerRecherche("0555123456")).toBe("555123456");
    expect(nettoyerRecherche(" Amrani ")).toBe("Amrani");
    expect(nettoyerRecherche("ab")).toBeNull();
    expect(nettoyerRecherche(undefined)).toBeNull();
    expect(nettoyerRecherche("a,b),id.eq.x*")).toBe("a b id.eq.x");
  });
  it("compterAcceptations : un nombre par version", async () => {
    const { client } = faux({ versions_documents: { data: [{ document: "conditions", version: "2026-10-10", en_vigueur_le: "2026-10-10T00:00:00Z" }], error: null },
      acceptations: { count: 12, error: null } });
    expect(await compterAcceptations(client)).toEqual([{ document: "conditions", version: "2026-10-10", enVigueurLe: "2026-10-10T00:00:00Z", nombre: 12 }]);
  });
  it("chercherAcceptations : comptes trouvés et leurs accords ; numéro → filtre sur le téléphone seulement", async () => {
    const { client, appels } = faux({ profils: { data: [{ id: "p1", nom: "Lina", telephone: "+213555123456", role: "client" }], error: null },
      acceptations: { data: [{ profil_id: "p1", document: "confidentialite", version: "2026-10-10", accepte_le: "2026-10-10T09:00:00Z", contexte: "commande" }], error: null } });
    expect(await chercherAcceptations(client, "0555 12")).toEqual([{ id: "p1", nom: "Lina", telephone: "+213555123456", role: "client",
      accords: [{ document: "confidentialite", version: "2026-10-10", accepteLe: "2026-10-10T09:00:00Z", contexte: "commande" }] }]);
    expect(appels[0].filtres).toContainEqual(["or", "telephone.ilike.*55512*"]);
    expect(await chercherAcceptations(client, "ab")).toBeNull();
  });
});

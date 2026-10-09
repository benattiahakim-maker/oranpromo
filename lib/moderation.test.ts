import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { chargerHistoriqueModeration, chargerSignalements, modererArticle, regrouperSignalements, verifierAdministrateur, type ActionModeration, type SignalementModeration } from "./moderation";

const signalement = (id: string, article_id = "a", cree_le = "2026-10-09T10:00:00Z", motif = "autre"): SignalementModeration => ({ id, article_id, cree_le, motif, commentaire: "Description trompeuse", statut: "ouvert", articles: null });
describe("chargement de la file et de l’historique", () => {
  it("pagine tous les ouverts avant de compter et trier les articles", async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => signalement(String(i))), error: null }).mockResolvedValueOnce({ data: [signalement("501")], error: null });
    const eq = vi.fn(() => ({ order: () => ({ range }) }));
    const client = { from: () => ({ select: () => ({ eq }) }) } as unknown as SupabaseClient<Database>;
    expect((await chargerSignalements(client))[0].nombre).toBe(501);
    expect(eq).toHaveBeenCalledWith("statut", "ouvert");
    expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it("limite l’historique aux 50 dernières décisions et conserve l’article", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "d1", date: "2026-10-09", action: "avertir", signalements: { article_id: "a", articles: { titre: "Polo" } } }], error: null });
    const order = vi.fn(); order.mockReturnValue({ order, limit });
    const client = { from: () => ({ select: () => ({ order }) }) } as unknown as SupabaseClient<Database>;
    expect(await chargerHistoriqueModeration(client)).toEqual([{ id: "d1", date: "2026-10-09", action: "avertir", articleId: "a", titre: "Polo" }]);
    expect(order).toHaveBeenCalledWith("date", { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
  });
});
describe("regrouperSignalements", () => {
  it("regroupe les ouverts, compte les motifs et conserve les commentaires sans modifier l’entrée", () => {
    const entree = [signalement("1"), signalement("2"), { ...signalement("3"), statut: "traite" as const }, { ...signalement("4"), statut: "rejete" as const }];
    const [groupe] = regrouperSignalements(entree);
    expect(groupe.nombre).toBe(2);
    expect(groupe.motifs).toEqual([{ motif: "autre", nombre: 2 }]);
    expect(groupe.signalements[0].commentaire).toBe("Description trompeuse");
    expect(entree).toHaveLength(4);
  });
  it("trie par nombre puis date récente et trie les signalements du plus récent au plus ancien", () => {
    const groupes = regrouperSignalements([signalement("1", "a", "2026-10-01"), signalement("2", "b", "2026-10-09"), signalement("3", "a", "2026-10-02"), signalement("4", "c", "2026-10-08"), signalement("5", "c", "2026-10-07")]);
    expect(groupes.map(g => g.articleId)).toEqual(["c", "a", "b"]);
    expect(groupes[0].derniereDate).toBe("2026-10-08");
    expect(groupes[0].signalements.map(s => s.id)).toEqual(["4", "5"]);
  });
  it("départage les égalités de façon stable et accepte une liste vide", () => {
    expect(regrouperSignalements([signalement("2", "b"), signalement("1", "a")]).map(g => g.articleId)).toEqual(["a", "b"]);
    expect(regrouperSignalements([])).toEqual([]);
  });
});

function clientTest(options: { role?: string; session?: boolean; stale?: boolean; decisionError?: boolean; targetError?: boolean; closeError?: boolean } = {}) {
  const decision = vi.fn().mockResolvedValue({ error: options.decisionError ? { message: "refus" } : null });
  const cible = vi.fn().mockResolvedValue({ data: options.targetError ? null : { id: "a" }, error: options.targetError ? {} : null });
  const cloture = vi.fn().mockResolvedValue({ data: options.closeError ? [] : [{ id: "1" }, { id: "2" }], error: null });
  const updateArticle = vi.fn(() => ({ eq: () => ({ select: () => ({ single: cible }) }) }));
  const updateBoutique = vi.fn(() => ({ eq: () => ({ select: () => ({ single: cible }) }) }));
  const filtre = vi.fn().mockResolvedValue({ data: options.stale ? [] : [{ id: "1", article_id: "a" }, { id: "2", article_id: "a" }], error: null });
  const filtreCloture = vi.fn(() => ({ select: cloture }));
  const updateSignalements = vi.fn(() => ({ eq: () => ({ eq: () => ({ in: filtreCloture }) }) }));
  const from = vi.fn((table: string) => {
    if (table === "profils") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: options.role ?? "admin" }, error: null }) }) }) };
    if (table === "signalements") return { select: () => ({ eq: () => ({ eq: () => ({ in: filtre }) }) }), update: updateSignalements };
    if (table === "articles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "a", boutique_id: "boutique" }, error: null }) }) }), update: updateArticle };
    if (table === "boutiques") return { update: updateBoutique };
    if (table === "decisions") return { insert: decision };
    throw new Error(table);
  });
  const client = { auth: { getUser: async () => ({ data: { user: options.session === false ? null : { id: "admin-connecte" } }, error: null }) }, from } as unknown as SupabaseClient<Database>;
  return { client, from, decision, updateArticle, updateBoutique, updateSignalements, filtre, filtreCloture };
}
describe("modération et droits administrateur", () => {
  it.each(["ambassadeur", "commercant"])("refuse %s avant toute lecture des signalements ou écriture", async role => {
    const m = clientTest({ role });
    await expect(modererArticle(m.client, "a", ["1", "2"], "masquer")).rejects.toThrow("Accès réservé");
    expect(m.from.mock.calls.map(c => c[0])).toEqual(["profils"]);
  });
  it("refuse une session absente", async () => {
    await expect(verifierAdministrateur(clientTest({ session: false }).client)).rejects.toThrow("Reconnectez-vous");
  });
  it.each<ActionModeration>(["masquer", "avertir", "suspendre", "classer"])("%s : une décision par signalement avec l’auteur connecté, puis clôture ciblée", async action => {
    const m = clientTest();
    await modererArticle(m.client, "a", ["1", "2", "1"], action);
    expect(m.decision).toHaveBeenCalledWith(["1", "2"].map(signalement_id => ({ signalement_id, action, auteur_id: "admin-connecte" })));
    expect(m.updateSignalements).toHaveBeenCalledWith({ statut: action === "classer" ? "rejete" : "traite" });
    expect(m.filtreCloture).toHaveBeenCalledWith("id", ["1", "2"]);
    expect(m.updateArticle).toHaveBeenCalledTimes(action === "masquer" ? 1 : 0);
    expect(m.updateBoutique).toHaveBeenCalledTimes(action === "suspendre" ? 1 : 0);
    if (action === "masquer") expect(m.updateArticle).toHaveBeenCalledWith({ statut: "masque", masque_par_moderation: true });
    if (action === "suspendre") expect(m.updateBoutique).toHaveBeenCalledWith({ statut: "suspendue" });
  });
  it("refuse une sélection périmée avant d’appliquer une action", async () => {
    const m = clientTest({ stale: true });
    await expect(modererArticle(m.client, "a", ["1", "2"], "masquer")).rejects.toThrow("ont changé");
    expect(m.updateArticle).not.toHaveBeenCalled();
    expect(m.decision).not.toHaveBeenCalled();
  });
  it("ne clôture jamais sans décision et explique un effet déjà appliqué", async () => {
    const m = clientTest({ decisionError: true });
    await expect(modererArticle(m.client, "a", ["1", "2"], "masquer")).rejects.toThrow("L’action a été appliquée");
    expect(m.updateSignalements).not.toHaveBeenCalled();
  });
  it("ne journalise pas une action refusée par la base", async () => {
    const m = clientTest({ targetError: true });
    await expect(modererArticle(m.client, "a", ["1", "2"], "suspendre")).rejects.toThrow("restent ouverts");
    expect(m.decision).not.toHaveBeenCalled();
  });
  it("signale une clôture incomplète sans annoncer un succès", async () => {
    await expect(modererArticle(clientTest({ closeError: true }).client, "a", ["1", "2"], "classer")).rejects.toThrow("n’ont pas été clôturés");
  });
});

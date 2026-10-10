// US-32.4 : signalements d'avis dans /admin/moderation (onglet « Avis »).
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { chargerHistoriqueModeration, chargerSignalementsAvis, chargerSignauxAvis, LIBELLES_DECISIONS, modererAvis, prenomInitiale, regrouperSignalementsAvis, type SignalementAvisModeration } from "./moderation";

const avis = { id: "v1", note: 5, commentaire: "Très bon accueil", reponse: null, reponse_masquee: false, statut: "publie", cree_le: "2026-10-08T10:00:00Z", boutiques: { nom: "Boutique Nour" }, profils: { nom: "Amine Benali" } };
const s = (id: string, avis_id = "v1", motif = "faux_avis", cree_le = "2026-10-09T10:00:00Z", statut: SignalementAvisModeration["statut"] = "ouvert"): SignalementAvisModeration =>
  ({ id, avis_id, motif, cree_le, statut, commentaire: null, avis: avis_id === "v1" ? avis : null });

describe("file des avis signalés", () => {
  it("regroupe par avis (ouverts seulement), compte les motifs, plus signalés d'abord", () => {
    const groupes = regrouperSignalementsAvis([s("1"), s("2", "v1", "insulte", "2026-10-09T12:00:00Z"), s("3", "v2"), s("4", "v1", "faux_avis", "2026-10-09T13:00:00Z", "traite"), s("5")]);
    expect(groupes.map(g => [g.avisId, g.nombre])).toEqual([["v1", 3], ["v2", 1]]);
    expect(groupes[0].motifs).toEqual([{ motif: "faux_avis", nombre: 2 }, { motif: "insulte", nombre: 1 }]);
    expect(groupes[0].derniereDate).toBe("2026-10-09T12:00:00Z");
    expect(groupes[0].auteur).toBe("Amine B.");
    expect(groupes[1].avis).toBeNull();
  });
  it("« Amine B. » comme dans la base (prenom_initiale)", () => {
    expect(prenomInitiale("  amine   benali  ")).toBe("amine B.");
    expect(prenomInitiale("Sara")).toBe("Sara");
    expect(prenomInitiale("")).toBe("Client");
    expect(prenomInitiale(null)).toBe("Client");
  });
  it("pagine les signalements ouverts", async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => s(String(i))), error: null }).mockResolvedValueOnce({ data: [s("x")], error: null });
    const eq = vi.fn(() => ({ order: () => ({ range }) }));
    const from = vi.fn(() => ({ select: () => ({ eq }) }));
    const groupes = await chargerSignalementsAvis({ from } as unknown as SupabaseClient<Database>);
    expect(from).toHaveBeenCalledWith("signalements_avis");
    expect(groupes[0].nombre).toBe(501);
    expect(eq).toHaveBeenCalledWith("statut", "ouvert");
  });
  it("signal de fraude lu par la fonction de la base (admin)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ boutique_id: "b", boutique: "Dar Lebsa", cinq_etoiles_comptes_recents: 6 }], error: null });
    expect(await chargerSignauxAvis({ rpc } as unknown as SupabaseClient<Database>)).toEqual([{ boutiqueId: "b", boutique: "Dar Lebsa", nombre: 6 }]);
    expect(rpc).toHaveBeenCalledWith("signaux_avis");
  });
  it("historique : décision sur un avis (« Avis de Amine B. · Boutique Nour ») ou sur un article", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [
      { id: "d1", date: "2026-10-09", action: "masquer_avis", signalements: null, signalements_avis: { avis_id: "v1", avis: { boutiques: { nom: "Boutique Nour" }, profils: { nom: "Amine Benali" } } } },
      { id: "d2", date: "2026-10-08", action: "classer_signalement_avis", signalements: null, signalements_avis: { avis_id: "v2", avis: null } },
      { id: "d3", date: "2026-10-07", action: "masquer", signalements: { article_id: "a", articles: { titre: "Polo" } }, signalements_avis: null },
    ], error: null });
    const order = vi.fn(); order.mockReturnValue({ order, limit });
    const client = { from: () => ({ select: () => ({ order }) }) } as unknown as SupabaseClient<Database>;
    expect((await chargerHistoriqueModeration(client)).map(d => d.titre)).toEqual(["Avis de Amine B. · Boutique Nour", "Avis indisponible", "Polo"]);
    expect(LIBELLES_DECISIONS.masquer_avis).toBe("Masquer l’avis");
    expect(LIBELLES_DECISIONS.masquer_reponse).toBe("Masquer la réponse");
    expect(LIBELLES_DECISIONS.masquer).toBe("Masquer l’article");
  });
});

function clientAdmin(role = "admin", erreur: { code?: string; message?: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: erreur });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { role }, error: null });
  const client = { auth: { getUser: async () => ({ data: { user: { id: "admin-connecte" } }, error: null }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }), rpc } as unknown as SupabaseClient<Database>;
  return { rpc, client };
}

describe("modération d'un avis", () => {
  it.each(["masquer_avis", "masquer_reponse", "classer_signalement_avis"] as const)("%s : une seule transaction dans la base avec les signalements vus (sans doublon)", async action => {
    const m = clientAdmin();
    await modererAvis(m.client, "v1", ["1", "2", "1"], action);
    expect(m.rpc).toHaveBeenCalledWith("moderer_avis", { avis: "v1", action, signalements: ["1", "2"] });
  });
  it.each(["commercant", "ambassadeur", "client"])("refuse %s avant d'appeler la base", async role => {
    const m = clientAdmin(role);
    await expect(modererAvis(m.client, "v1", ["1"], "masquer_avis")).rejects.toThrow("Accès réservé");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("refuse une action inconnue ou une sélection vide", async () => {
    const m = clientAdmin();
    await expect(modererAvis(m.client, "v1", ["1"], "supprimer" as never)).rejects.toThrow("Choisissez une action valide.");
    await expect(modererAvis(m.client, "v1", [], "masquer_avis")).rejects.toThrow("Aucun signalement à traiter.");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("relaie les refus de la base (sélection périmée), message générique sinon", async () => {
    await expect(modererAvis(clientAdmin("admin", { code: "22023", message: "Ces signalements ont changé. Actualisez la page avant de continuer." }).client, "v1", ["1"], "masquer_avis")).rejects.toThrow("ont changé");
    await expect(modererAvis(clientAdmin("admin", { code: "XX000", message: "interne" }).client, "v1", ["1"], "masquer_avis")).rejects.toThrow("Impossible de traiter les signalements. Réessayez.");
  });
});

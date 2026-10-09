import { beforeEach, describe, expect, it, vi } from "vitest";
import { changerStatutCommandesBoutique } from "./actions";
import { compteRendu, lireDemandeGroupee } from "@/lib/tableau-commandes";

// US-28.2 : actions groupées. La base est simulée : `rpc` reçoit chaque appel de changer_statut_commande.
const { rpc, lignes, boutique, lectures } = vi.hoisted(() => ({ rpc: vi.fn(), lignes: { valeur: [] as Record<string, unknown>[] }, boutique: { valeur: "b1" }, lectures: [] as unknown[][] }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, from: (t: string) => { const c: Record<string, unknown> = { select: (...a: unknown[]) => { lectures.push([t, "select", ...a]); return c; }, in: async (...a: unknown[]) => { lectures.push([t, "in", ...a]); return { data: lignes.valeur.filter(l => (a[1] as string[]).includes(l.id as string)), error: null }; } }; return c; } }) }));
const { after, envoyer } = vi.hoisted(() => ({ after: vi.fn(async (tache: () => Promise<unknown>) => { await tache(); }), envoyer: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
vi.mock("@/lib/gestion-articles", () => ({ boutiqueDuCompte: async () => boutique.valeur }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cmd = (n: number, statut: string, cree: string, boutique_id = "b1") => ({ id: id(n), numero: n, boutique_id, statut, cree_le: `2026-10-09T${cree}:00Z` });
const STOCK = "Stock insuffisant pour « Polo piqué » en taille M : il reste 1 pièce(s), la commande en demande 2. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».";
beforeEach(() => { vi.clearAllMocks(); lectures.length = 0; boutique.valeur = "b1"; rpc.mockResolvedValue({ error: null }); });

describe("US-28.2 : demande", () => {
  it("1 à 20 identifiants valides, doublons retirés, confirmee ou prete seulement", () => {
    expect(lireDemandeGroupee([id(1), id(1), id(2)], "confirmee")).toEqual({ ids: [id(1), id(2)], statut: "confirmee" });
    expect(lireDemandeGroupee(Array.from({ length: 21 }, (_, i) => id(i + 1)), "prete")).toEqual({ refus: "20 au plus à la fois." });
    expect(lireDemandeGroupee([], "prete")).toEqual({ refus: "Cochez au moins une commande." });
    expect(lireDemandeGroupee(["x"], "prete")).toEqual({ refus: "Demande invalide." });
    expect(lireDemandeGroupee("abc", "prete")).toEqual({ refus: "Demande invalide." });
    expect(lireDemandeGroupee([id(1)], "annulee")).toEqual({ refus: "Action impossible." });
    expect(lireDemandeGroupee([id(1)], "recuperee")).toEqual({ refus: "Action impossible." });
  });
});

describe("US-28.2 : action serveur", () => {
  it("3 confirmées + 1 refusée pour stock : compte rendu exact, les 3 vraiment confirmées, ordre du plus ancien au plus récent", async () => {
    lignes.valeur = [cmd(131, "demandee", "13:02"), cmd(127, "demandee", "12:23"), cmd(129, "demandee", "12:51"), cmd(133, "demandee", "13:04")];
    rpc.mockImplementation(async (_: string, a: { commande: string }) => a.commande === id(131) ? { error: { message: STOCK, code: "23514" } } : { error: null });
    const r = await changerStatutCommandesBoutique([id(131), id(127), id(133), id(129)], "confirmee");
    expect(rpc.mock.calls.map(c => c[1].commande)).toEqual([id(127), id(129), id(131), id(133)]);
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id(127), statut: "confirmee", motif: undefined, note: undefined });
    expect(r.reussies.map(x => x.numero)).toEqual([127, 129, 133]);
    expect(r.echecs).toEqual([{ id: id(131), numero: 131, message: STOCK, deja: false }]);
    expect(compteRendu(r, "confirmee")).toEqual({ titre: "3 commandes confirmées.", lignes: [{ id: id(131), texte: `N° 131 non confirmée : ${STOCK}` }] });
    expect(after).not.toHaveBeenCalled(); // pas de WhatsApp pour une confirmation
  });
  it("commande d’une autre boutique ou inconnue : refusée sans appel à la base", async () => {
    lignes.valeur = [cmd(127, "demandee", "12:23", "b2")];
    const r = await changerStatutCommandesBoutique([id(127), id(999)], "confirmee");
    expect(rpc).not.toHaveBeenCalled();
    expect(r.echecs.map(e => [e.numero, e.message])).toEqual([[127, "Commande introuvable."], [null, "Commande introuvable."]]);
  });
  it("changée entre-temps : « déjà confirmée », « la commande est annulée. », sans appel", async () => {
    lignes.valeur = [cmd(129, "confirmee", "12:51"), cmd(130, "prete", "12:52"), cmd(132, "annulee", "12:53")];
    const r = await changerStatutCommandesBoutique([id(129), id(130), id(132)], "confirmee");
    expect(rpc).not.toHaveBeenCalled();
    expect(compteRendu(r, "confirmee").lignes.map(l => l.texte)).toEqual(["N° 129 : déjà confirmée.", "N° 130 : déjà confirmée.", "N° 132 non confirmée : la commande est annulée."]);
    expect(compteRendu(r, "confirmee").titre).toBe("Aucune commande modifiée.");
  });
  it("étape sautée refusée (une commande demandée ne passe pas directement « prête »)", async () => {
    lignes.valeur = [cmd(127, "demandee", "12:23")];
    const r = await changerStatutCommandesBoutique([id(127)], "prete");
    expect(rpc).not.toHaveBeenCalled();
    expect(r.echecs[0].message).toBe("Changement de statut impossible.");
  });
  it("plus de 20 : refusé sans lecture ni appel", async () => {
    const r = await changerStatutCommandesBoutique(Array.from({ length: 21 }, (_, i) => id(i + 1)), "confirmee");
    expect(r).toEqual({ succes: false, message: "20 au plus à la fois.", reussies: [], echecs: [] });
    expect(lectures).toEqual([]); expect(rpc).not.toHaveBeenCalled();
  });
  it("« Marquer prêtes » : WhatsApp seulement pour les commandes devenues prêtes, après la réponse", async () => {
    lignes.valeur = [cmd(118, "confirmee", "10:00"), cmd(121, "confirmee", "11:00"), cmd(124, "demandee", "12:00")];
    rpc.mockImplementation(async (_: string, a: { commande: string }) => a.commande === id(121) ? { error: { message: "Changement de statut impossible.", code: "P0001" } } : { error: null });
    const r = await changerStatutCommandesBoutique([id(118), id(121), id(124)], "prete");
    expect(r.reussies.map(x => x.numero)).toEqual([118]);
    expect(after).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls.map(c => c[1])).toEqual([id(118)]);
    expect(compteRendu(r, "prete").titre).toBe("1 commande marquée prête.");
  });
  it("lit les commandes avec le client de la session (RLS) en une seule requête", async () => {
    lignes.valeur = [cmd(127, "demandee", "12:23")];
    await changerStatutCommandesBoutique([id(127)], "confirmee");
    expect(lectures).toEqual([["commandes", "select", "id, numero, boutique_id, statut, cree_le"], ["commandes", "in", "id", [id(127)]]]);
  });
});

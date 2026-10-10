import { beforeEach, describe, expect, it, vi } from "vitest";
// US-35 : langue de la requête (cookie) : français dans ces tests.
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => "fr", getTextes: async () => textesDe("fr"), enLangue: async <T,>(r: T) => r }; });
import { changerStatutCommandeBoutique, declarerClientPasVenu } from "./actions";

const { rpc, commande, boutique } = vi.hoisted(() => ({ rpc: vi.fn(), commande: { valeur: null as unknown }, boutique: { valeur: "b1" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, from: () => { const c: Record<string, unknown> = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: commande.valeur, error: null }) }; return c; } }) }));
const { after, envoyer } = vi.hoisted(() => ({ after: vi.fn((tache: () => unknown) => { void tache(); }), envoyer: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesCommande: envoyer }));
vi.mock("@/lib/gestion-articles", () => ({ boutiqueDuCompte: async () => boutique.valeur }));
const id = "11111111-1111-1111-1111-111111111111";
beforeEach(() => { after.mockClear(); envoyer.mockReset(); rpc.mockReset(); rpc.mockResolvedValue({ error: null }); commande.valeur = { id, boutique_id: "b1", statut: "demandee" }; boutique.valeur = "b1"; });

describe("action serveur de la boutique (US-20.3)", () => {
  it("confirme une commande de sa boutique", async () => {
    expect(await changerStatutCommandeBoutique(id, "confirmee", null, "")).toEqual({ succes: true, message: "Commande mise à jour." });
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id, statut: "confirmee", motif: undefined, note: undefined });
  });
  it("refuse une commande d’une autre boutique sans appeler la base", async () => {
    boutique.valeur = "b2";
    expect(await changerStatutCommandeBoutique(id, "confirmee", null, "")).toEqual({ succes: false, message: "Commande introuvable." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuse une étape sautée ou une annulation sans motif", async () => {
    expect((await changerStatutCommandeBoutique(id, "recuperee", null, "")).message).toBe("Changement de statut impossible.");
    expect((await changerStatutCommandeBoutique(id, "annulee", null, "")).message).toBe("Choisissez le motif de l’annulation.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("US-26.3 : « Remis sans QR code » met toujours la note « Remise sans QR code »", async () => {
    commande.valeur = { id, boutique_id: "b1", statut: "prete" };
    expect(await changerStatutCommandeBoutique(id, "recuperee", null, "autre texte")).toEqual({ succes: true, message: "Commande mise à jour." });
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id, statut: "recuperee", motif: undefined, note: "Remise sans QR code" });
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("transmet le motif et la note d’une annulation", async () => {
    await changerStatutCommandeBoutique(id, "annulee", "plus_en_stock", " Désolé ");
    expect(rpc).toHaveBeenCalledWith("changer_statut_commande", { commande: id, statut: "annulee", motif: "plus_en_stock", note: "Désolé" });
  });
  it("envoie le WhatsApp « commande prête » après la réponse, pas pour une confirmation (US-20.5)", async () => {
    await changerStatutCommandeBoutique(id, "confirmee", null, "");
    expect(after).not.toHaveBeenCalled();
    commande.valeur = { id, boutique_id: "b1", statut: "confirmee" };
    await changerStatutCommandeBoutique(id, "prete", null, "");
    expect(after).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith(expect.anything(), id);
  });
});

describe("« Client pas venu » (relecture point 11)", () => {
  it("déclare le no-show d’une commande expirée de sa boutique et envoie le WhatsApp", async () => {
    commande.valeur = { id, boutique_id: "b1", statut: "expiree", expire_le: null, no_show_le: null };
    expect(await declarerClientPasVenu(id)).toEqual({ succes: true, message: "C’est noté : le client est averti." });
    expect(rpc).toHaveBeenCalledWith("declarer_no_show", { commande: id });
    expect(envoyer).toHaveBeenCalledWith(expect.anything(), id);
  });
  it("refuse avant 24 h, une autre boutique, ou une commande déjà signalée, sans appeler la base", async () => {
    commande.valeur = { id, boutique_id: "b1", statut: "prete", expire_le: "2999-01-01T00:00:00Z", no_show_le: null };
    expect((await declarerClientPasVenu(id)).succes).toBe(false);
    commande.valeur = { id, boutique_id: "b1", statut: "expiree", expire_le: null, no_show_le: "2026-10-09T10:00:00Z" };
    expect((await declarerClientPasVenu(id)).succes).toBe(false);
    boutique.valeur = "b2";
    commande.valeur = { id, boutique_id: "b1", statut: "expiree", expire_le: null, no_show_le: null };
    expect(await declarerClientPasVenu(id)).toEqual({ succes: false, message: "Commande introuvable." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

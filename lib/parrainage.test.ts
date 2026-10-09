import { describe, expect, it, vi } from "vitest";
import {
  afficherMonParrainage, choisirParrain, compteursParrainage, lienParrainage, lienPartageParrainage, messagePartageParrainage, modificationsRestantes,
  MESSAGE_PARRAIN_IMPOSSIBLE, MESSAGE_SAISIE_PARRAIN_INVALIDE, normaliserCodeParrainage, normaliserSaisieParrain, parrainageOuvert, preparerInvitation, type MonParrainage,
} from "./parrainage";

const client = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as never;
const mon = (extra: Partial<MonParrainage> = {}): MonParrainage => ({ actif: true, peut_parrainer: true, code: "K7M2QX", parrain_saisi: false, saisies: 0, peut_choisir: false,
  choix_jusqu_au: null, filleuls: [], en_attente: 0, plafond_atteint: false, ...extra });

describe("US-27.2 : saisie du parrain", () => {
  it("numéro algérien dans tous les formats de US-21 → +213XXXXXXXXX", () => {
    for (const saisie of ["0661 23 45 67", "+213 661 23 45 67", "00213661234567", "661234567", "06.61.23.45.67"]) expect(normaliserSaisieParrain(saisie)).toBe("+213661234567");
  });
  it("code de 6 caractères, minuscules et espaces acceptés ; 0, O, 1, I, L refusés", () => {
    expect(normaliserSaisieParrain("k7m2qx")).toBe("K7M2QX");
    expect(normaliserSaisieParrain(" K7M 2QX ")).toBe("K7M2QX");
    expect(normaliserCodeParrainage("K0M2QX")).toBeNull();
    expect(normaliserCodeParrainage("KIM2QX")).toBeNull();
    expect(normaliserCodeParrainage("K7M2Q")).toBeNull();
    expect(normaliserSaisieParrain("0161234567")).toBeNull(); // fixe, pas un mobile
    expect(normaliserSaisieParrain("")).toBeNull();
    expect(normaliserSaisieParrain(null)).toBeNull();
  });
  it("choisirParrain envoie la saisie normalisée ; même succès pour tout numéro accepté par la base", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "enregistre", error: null });
    await choisirParrain(client(rpc), "0661 23 45 67");
    await choisirParrain(client(rpc), "0770 00 00 01");
    await choisirParrain(client(rpc), "k7m2qx");
    expect(rpc.mock.calls).toEqual([["choisir_parrain", { saisie: "+213661234567" }], ["choisir_parrain", { saisie: "+213770000001" }], ["choisir_parrain", { saisie: "K7M2QX" }]]);
  });
  it("saisie mal écrite : message, sans appel à la base", async () => {
    const rpc = vi.fn();
    await expect(choisirParrain(client(rpc), "abc")).rejects.toThrow(MESSAGE_SAISIE_PARRAIN_INVALIDE);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("erreurs de la base sur le filleul gardées ; erreur inconnue → message général", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "23514", message: "C'est ton propre numéro : choisis le numéro d'un ami." } })
      .mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "détail interne" } })
      .mockResolvedValueOnce({ data: "autre", error: null });
    await expect(choisirParrain(client(rpc), "0661234567")).rejects.toThrow("C'est ton propre numéro");
    await expect(choisirParrain(client(rpc), "0661234567")).rejects.toThrow(MESSAGE_PARRAIN_IMPOSSIBLE);
    await expect(choisirParrain(client(rpc), "0661234567")).rejects.toThrow(MESSAGE_PARRAIN_IMPOSSIBLE);
  });
  it("3 saisies au plus : 2 modifications après la première", () => {
    expect(modificationsRestantes(0)).toBe(3);
    expect(modificationsRestantes(1)).toBe(2);
    expect(modificationsRestantes(3)).toBe(0);
    expect(modificationsRestantes(5)).toBe(0);
  });
});

describe("US-27.3 : lien et partage", () => {
  it("lien /p/<code> sur l'adresse du site, sans nom ni numéro", () => {
    expect(lienParrainage("K7M2QX", "https://oranpromo.dz/")).toBe("https://oranpromo.dz/p/K7M2QX");
  });
  it("message de partage WhatsApp sans destinataire, en français et en arabe", () => {
    const lien = "https://oranpromo.dz/p/K7M2QX";
    expect(messagePartageParrainage("fr", lien)).toBe("Je t'invite sur OranPromo, les promos des boutiques d'Oran : https://oranpromo.dz/p/K7M2QX");
    expect(messagePartageParrainage("ar", lien)).toContain(lien);
    const wa = lienPartageParrainage("fr", lien);
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1])).toBe(messagePartageParrainage("fr", lien));
  });
  it("lien d'invitation seulement si la base donne un code ; QR code à la demande", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: "K7M2QX", error: null }).mockResolvedValueOnce({ data: null, error: { code: "42501", message: "x" } });
    const invitation = await preparerInvitation(client(rpc), "fr", { qr: true, siteUrl: "https://oranpromo.dz" });
    expect(invitation).toMatchObject({ code: "K7M2QX", lien: "https://oranpromo.dz/p/K7M2QX" });
    expect(invitation!.qr).toMatch(/^data:image\/svg\+xml/);
    expect(await preparerInvitation(client(rpc), "fr")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("mon_code_parrainage");
  });
  it("compteurs : filleuls récompensés et en attente ; bloc affiché si le client peut parrainer ou a des filleuls", () => {
    expect(compteursParrainage(mon({ filleuls: [{ prenom: "Samir B.", valide_le: "2026-10-12T10:00:00Z", statut: "valide" }], en_attente: 1 }))).toEqual({ valides: 1, enAttente: 1 });
    expect(afficherMonParrainage(mon())).toBe(true);
    expect(afficherMonParrainage(mon({ actif: false }))).toBe(false);
    expect(afficherMonParrainage(mon({ actif: false, en_attente: 1 }))).toBe(true);
    expect(afficherMonParrainage(mon({ peut_parrainer: false }))).toBe(false);
    expect(afficherMonParrainage(null)).toBe(false);
  });
  it("interrupteur : vrai seulement si la base répond vrai ; une erreur vaut « fermé »", async () => {
    expect(await parrainageOuvert(client(vi.fn().mockResolvedValue({ data: true, error: null })))).toBe(true);
    expect(await parrainageOuvert(client(vi.fn().mockResolvedValue({ data: false, error: null })))).toBe(false);
    expect(await parrainageOuvert(client(vi.fn().mockResolvedValue({ data: null, error: { message: "x" } })))).toBe(false);
    expect(await parrainageOuvert(client(vi.fn().mockRejectedValue(new Error("réseau"))))).toBe(false);
  });
});

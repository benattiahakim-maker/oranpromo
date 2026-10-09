import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, supprimer, langue } = vi.hoisted(() => ({ rpc: vi.fn(), supprimer: vi.fn(), langue: { valeur: "fr" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "langue" ? { value: langue.valeur } : undefined), delete: supprimer }) }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
import { choisirParrain } from "./actions";
import { MESSAGE_PARRAIN_ENREGISTRE } from "@/lib/parrainage";

beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; rpc.mockResolvedValue({ data: "enregistre", error: null }); });

describe("US-27.2 : choisir son parrain", () => {
  it("même message pour tout numéro ou code accepté (client, inconnu, commerçant : la base répond pareil)", async () => {
    const reponses = [await choisirParrain("0661 23 45 67"), await choisirParrain("0550 00 00 00"), await choisirParrain("K7M2QX")];
    for (const r of reponses) expect(r).toEqual({ succes: true, message: MESSAGE_PARRAIN_ENREGISTRE });
    expect(supprimer).toHaveBeenCalledWith("parrain");
  });
  it("erreur sur le filleul (propre numéro) : message de la base", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "C'est ton propre numéro : choisis le numéro d'un ami." } });
    expect(await choisirParrain("0661234567")).toEqual({ succes: false, message: "C'est ton propre numéro : choisis le numéro d'un ami." });
    expect(supprimer).not.toHaveBeenCalled();
  });
  it("saisie mal écrite ou valeur non texte : refusée sans appel à la base", async () => {
    expect((await choisirParrain("12")).succes).toBe(false);
    expect((await choisirParrain(42 as unknown as string)).succes).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("en arabe : messages n° 9 et 10 validés", async () => {
    langue.valeur = "ar";
    expect((await choisirParrain("0661234567")).message).toBe("تسجّلت. إلا كانت هاد النمرة نتاع زبون في OranPromo، يولّي هو اللي عرضك من بعد أول طلب تدّيه من الحانوت.");
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "C'est ton propre numéro : choisis le numéro d'un ami." } });
    expect((await choisirParrain("0661234567")).message).toBe("هادي نمرتك أنت: ختار نمرة صاحبك.");
  });
});

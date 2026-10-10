// US-32.5 : petit bon pour chaque avis (bon « avis » donné par la base dans donner_avis ; mention publique n° 11).
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { donnerAvis, lireRecompenseAvis, messageBonAvis } from "./avis";
import { estBonProgramme, type BonClient } from "./bons";
import { detailBonProgramme, libelleUtiliserBon, nomDuBon } from "./bons-affichage";
import { nomBon } from "./bons-boutique";
import { traduireMessage } from "./textes/messages";
import { textesDe } from "./textes";

const ID = "11111111-1111-1111-1111-111111111111";
const rpc = (reponse: { data: unknown; error: unknown }) => { const f = vi.fn().mockResolvedValue(reponse); return { f, c: { rpc: f } as unknown as SupabaseClient<Database> }; };
const fr = textesDe("fr").parrainage, ar = textesDe("ar").parrainage;
const bon: BonClient = { id: "b1", montant: 150, statut: "disponible", origine: "avis", cree_le: "2026-10-10T10:00:00Z", expire_le: "2026-11-09T10:00:00Z",
  utilise_le: null, commande: null, numero: null, boutique: null, minimum_achat: 1500, univers: null, villes: [], nom_fr: "Avis", nom_ar: "راي" };

describe("US-32.5 : bon donné avec l'avis", () => {
  it("donner_avis renvoie le montant du bon (ou rien)", async () => {
    expect(await donnerAvis(rpc({ data: { avis: "a1", bon: 150 }, error: null }).c, ID, { note: 1 })).toEqual({ id: "a1", bon: 150 });
    expect(await donnerAvis(rpc({ data: { avis: "a1", bon: null }, error: null }).c, ID, { note: 5 })).toEqual({ id: "a1", bon: null });
    expect(await donnerAvis(rpc({ data: { avis: "a1", bon: "150" }, error: null }).c, ID, { note: 5 })).toEqual({ id: "a1", bon: null });
  });
  it("« Votre bon de 150 DA est dans votre compte. » (français) et sa traduction arabe (à valider)", () => {
    expect(messageBonAvis(150)).toBe("Votre bon de 150\u00a0DA est dans votre compte.");
    expect(traduireMessage(messageBonAvis(150), "fr")).toBe("Votre bon de 150\u00a0DA est dans votre compte.");
    expect(traduireMessage(messageBonAvis(150), "ar")).toBe("البون نتاعك تاع 150\u00a0دج راهو في حسابك.");
    expect(traduireMessage(messageBonAvis(1500), "ar")).toBe("البون نتاعك تاع 1\u00a0500\u00a0دج راهو في حسابك.");
  });
});

describe("US-32.5 : mention publique (texte n° 11)", () => {
  it("lue par recompense_avis() ; absente si la récompense est inactive, invalide ou en erreur", async () => {
    const actif = rpc({ data: { montant: 150, minimum: 1500 }, error: null });
    expect(await lireRecompenseAvis(actif.c)).toEqual({ montant: 150, minimum: 1500 });
    expect(actif.f).toHaveBeenCalledWith("recompense_avis");
    expect(await lireRecompenseAvis(rpc({ data: null, error: null }).c)).toBeNull();
    expect(await lireRecompenseAvis(rpc({ data: { montant: "150" }, error: null }).c)).toBeNull();
    expect(await lireRecompenseAvis(rpc({ data: null, error: { message: "x" } }).c)).toBeNull();
  });
  it("textes n° 11 français et arabe", () => {
    expect(textesDe("fr").avis.mentionBon).toBe("Les clients reçoivent un petit bon pour chaque avis, quelle que soit leur note.");
    expect(textesDe("ar").avis.mentionBon).toBe("الكليان ياخذو بون صغير على كل راي، مهما كانت النقطة.");
  });
});

describe("US-32.5 : le bon « avis » s'affiche comme un bon de programme", () => {
  it("nom « Bon Avis » / « بون راي », détail avec minimum et date, case du panier", () => {
    expect(estBonProgramme(bon)).toBe(true);
    expect(nomDuBon(bon, fr, "fr")).toBe("Bon Avis");
    expect(nomDuBon(bon, ar, "ar")).toBe("بون راي");
    expect(detailBonProgramme(bon, fr, "fr")).toBe("150\u00a0DA dès 1\u00a0500\u00a0DA d’achat · jusqu’au 9/11");
    expect(libelleUtiliserBon(bon, fr, "fr")).toBe("Utiliser mon bon Avis (−150\u00a0DA)");
  });
  it("côté boutique (scan, commandes) : « Bon Avis », pas « Bon parrainage »", () => {
    expect(nomBon({ origine: "avis", nom_fr: "Avis", nom_ar: "راي" })).toBe("Bon Avis");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { confirmerParLien, creerLienConfirmation, DUREE_LIEN_MS, lireCommandeAConfirmer, lireLienConfirmation, MESSAGES_CONFIRMATION, preparerBoutonConfirmer, secretConfirmation } from "./confirmation";

const SECRET = "secret-confirmation-de-test";
const ID = "0b9f2c1e-5a4d-4c3b-9e8f-112233445566";
const T0 = Date.UTC(2026, 9, 9, 12, 0, 0);
const ENV = { CONFIRMATION_SECRET: SECRET };
const base = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient<Database>;

describe("US-20.6 : lien signé de confirmation", () => {
  it("secret d’au moins 16 caractères, sinon aucun", () => {
    expect(secretConfirmation(ENV)).toBe(SECRET);
    expect(secretConfirmation({ CONFIRMATION_SECRET: "court" })).toBeNull();
    expect(secretConfirmation({})).toBeNull();
  });
  it("un lien fabriqué est valide pour sa commande pendant 24 h, puis expiré", () => {
    const lien = creerLienConfirmation(ID, SECRET, T0);
    expect(lien.startsWith(`${ID}.`)).toBe(true);
    expect(lien).toMatch(/^[0-9a-f-]{36}\.[0-9a-z]+\.[A-Za-z0-9_-]{43}$/);
    expect(lireLienConfirmation(lien, SECRET, T0 + DUREE_LIEN_MS - 1000)).toEqual({ etat: "valide", commandeId: ID });
    expect(lireLienConfirmation(lien, SECRET, T0 + DUREE_LIEN_MS)).toEqual({ etat: "expire" });
  });
  it("lien modifié, autre commande, autre secret ou abîmé : invalide", () => {
    const lien = creerLienConfirmation(ID, SECRET, T0);
    const [, expiration, signature] = lien.split(".");
    const autre = "0b9f2c1e-5a4d-4c3b-9e8f-112233445567";
    expect(lireLienConfirmation(`${autre}.${expiration}.${signature}`, SECRET, T0)).toEqual({ etat: "invalide" });
    // Repousser l’expiration casse la signature : invalide (et non « expiré »).
    expect(lireLienConfirmation(`${ID}.${(parseInt(expiration, 36) + 86400).toString(36)}.${signature}`, SECRET, T0)).toEqual({ etat: "invalide" });
    expect(lireLienConfirmation(`${ID}.${expiration}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`, SECRET, T0)).toEqual({ etat: "invalide" });
    expect(lireLienConfirmation(lien, "un-autre-secret-de-test", T0)).toEqual({ etat: "invalide" });
    for (const abime of ["", "abc", `${ID}.${expiration}`, `${ID}..${signature}`, `x.${expiration}.${signature}`, `${lien}.x`, "a".repeat(300)]) {
      expect(lireLienConfirmation(abime, SECRET, T0)).toEqual({ etat: "invalide" });
    }
  });
});

describe("US-20.6 : confirmation par le lien", () => {
  const lien = () => creerLienConfirmation(ID, SECRET, T0);
  it("confirme avec le secret du serveur et la commande du lien", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "confirmee", error: null });
    expect(await confirmerParLien(base(rpc), lien(), ENV, T0)).toEqual({ succes: true, etat: "confirmee", message: MESSAGES_CONFIRMATION.confirmee });
    expect(rpc).toHaveBeenCalledWith("confirmer_commande_par_lien", { jeton: SECRET, commande: ID });
  });
  it.each([
    ["deja_confirmee", "Cette commande est déjà confirmée."],
    ["annulee", "Cette commande a été annulée : il n’y a rien à confirmer."],
    ["expiree", "Cette commande a expiré : il n’y a rien à confirmer."],
  ])("état « %s » : %s", async (etat, message) => {
    const rpc = vi.fn().mockResolvedValue({ data: etat, error: null });
    expect(await confirmerParLien(base(rpc), lien(), ENV, T0)).toEqual({ succes: false, etat, message });
  });
  it("lien expiré ou invalide : la base n’est pas appelée", async () => {
    const rpc = vi.fn();
    expect((await confirmerParLien(base(rpc), lien(), ENV, T0 + DUREE_LIEN_MS)).message).toBe("Ce lien a expiré. Confirmez la commande dans votre espace OranPromo, rubrique Commandes.");
    expect((await confirmerParLien(base(rpc), "faux", ENV, T0)).message).toBe("Ce lien n’est pas valide.");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sans CONFIRMATION_SECRET : indisponible, rien n’est appelé", async () => {
    const rpc = vi.fn();
    expect((await confirmerParLien(base(rpc), lien(), {}, T0)).etat).toBe("indisponible");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("stock insuffisant : même message que sur le site ; erreurs de la base traduites", async () => {
    const stock = "Stock insuffisant pour « Polo » en taille M : 0 pièce(s) disponible(s).";
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "23514", message: stock } })
      .mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "Ce lien n'est pas valide." } })
      .mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Accès refusé." } })
      .mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "détail interne" } })
      .mockResolvedValueOnce({ data: "bizarre", error: null });
    expect(await confirmerParLien(base(rpc), lien(), ENV, T0)).toEqual({ succes: false, etat: "stock", message: stock });
    expect((await confirmerParLien(base(rpc), lien(), ENV, T0)).etat).toBe("invalide");
    expect((await confirmerParLien(base(rpc), lien(), ENV, T0)).etat).toBe("indisponible");
    const inattendue = await confirmerParLien(base(rpc), lien(), ENV, T0);
    expect(inattendue.etat).toBe("erreur"); expect(inattendue.message).not.toContain("interne");
    expect((await confirmerParLien(base(rpc), lien(), ENV, T0)).etat).toBe("erreur");
  });
  it("lecture de la commande pour la page : secret du serveur, erreur cachée", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { numero: 15 }, error: null }).mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Accès refusé." } });
    expect(await lireCommandeAConfirmer(base(rpc), ID, SECRET)).toEqual({ numero: 15 });
    expect(rpc).toHaveBeenCalledWith("commande_a_confirmer", { jeton: SECRET, commande: ID });
    await expect(lireCommandeAConfirmer(base(rpc), ID, SECRET)).rejects.toThrow(MESSAGES_CONFIRMATION.indisponible);
  });
});

describe("US-20.6 : bouton « Confirmer » du message WhatsApp", () => {
  const message: { modele: string; parametres: string[]; bouton?: string } = { modele: "oranpromo_nouvelle_commande_confirmer", parametres: ["15", "Samia", "2", "8 700 DA", ID] };
  it("le 5e paramètre devient le lien signé du bouton (4 paramètres de texte)", () => {
    const pret = preparerBoutonConfirmer(message, SECRET, T0);
    expect(pret.modele).toBe("oranpromo_nouvelle_commande_confirmer");
    expect(pret.parametres).toEqual(["15", "Samia", "2", "8 700 DA"]);
    expect(lireLienConfirmation(pret.bouton!, SECRET, T0)).toEqual({ etat: "valide", commandeId: ID });
  });
  it("sans secret (ou paramètre abîmé) : ancien modèle sans bouton, aucun message perdu", () => {
    expect(preparerBoutonConfirmer(message, null, T0)).toEqual({ modele: "oranpromo_nouvelle_commande", parametres: ["15", "Samia", "2", "8 700 DA"] });
    expect(preparerBoutonConfirmer({ ...message, parametres: ["15", "Samia", "2", "8 700 DA", "pas-un-id"] }, SECRET, T0).modele).toBe("oranpromo_nouvelle_commande");
  });
  it("les autres modèles ne changent pas", () => {
    const autre = { modele: "oranpromo_commande_prete", parametres: ["Samia", "15", "Boutique", "10/10"] };
    expect(preparerBoutonConfirmer(autre, SECRET, T0)).toBe(autre);
  });
});

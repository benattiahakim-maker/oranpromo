import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ALERTE_ARRETEE, envoyerMessages, preparerBoutonAlerte, type FournisseurWhatsApp, type MessageWhatsApp } from ".";
import { corpsMessageMeta } from "./meta";

// US-31.5 : l'alerte « nouvelles promos » part avec le lien « Ne plus recevoir », ou ne part pas.
const JETON = "jeton-serveur-0123456789";
const PROFIL = "c3150000-0000-0000-0000-000000000001";
const LIEN = "a".repeat(48);
const alerte: MessageWhatsApp = { id: "m9", reservation: "r9", destinataire: "+213555315001", modele: "bledeal_nouvelles_promos",
  parametres: ["Amine", "Boutique Alpha et 1 autre(s)", PROFIL], texte: "Bonjour Amine, de nouvelles promos…" };
const base = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient<Database>;

describe("bouton « Ne plus recevoir » de l'alerte (US-31.5)", () => {
  it("demande le jeton au moment de l'envoi, avec CRON_SECRET ; 2 paramètres de corps + le bouton", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: LIEN, error: null });
    const pret = await preparerBoutonAlerte(base(rpc), alerte, JETON);
    expect(rpc).toHaveBeenCalledWith("jeton_alertes_envoi", { jeton: JETON, profil: PROFIL });
    expect(pret).toEqual({ ...alerte, parametres: ["Amine", "Boutique Alpha et 1 autre(s)"], bouton: LIEN });
    expect(corpsMessageMeta(pret!, "fr").template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Amine" }, { type: "text", text: "Boutique Alpha et 1 autre(s)" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: LIEN }] },
    ]);
  });
  it("modèle arabe : langue « ar » chez Meta", async () => {
    const pret = await preparerBoutonAlerte(base(vi.fn().mockResolvedValue({ data: LIEN, error: null })), { ...alerte, modele: "bledeal_nouvelles_promos_ar" }, JETON);
    expect(corpsMessageMeta(pret!, "fr").template.language).toEqual({ code: "ar" });
  });
  it("alertes arrêtées (null), jeton mal formé, erreur, identifiant absent : pas d'envoi", async () => {
    expect(await preparerBoutonAlerte(base(vi.fn().mockResolvedValue({ data: null, error: null })), alerte, JETON)).toBeNull();
    expect(await preparerBoutonAlerte(base(vi.fn().mockResolvedValue({ data: "court", error: null })), alerte, JETON)).toBeNull();
    expect(await preparerBoutonAlerte(base(vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } })), alerte, JETON)).toBeNull();
    expect(await preparerBoutonAlerte(base(vi.fn().mockRejectedValue(new Error("réseau"))), alerte, JETON)).toBeNull();
    const rpc = vi.fn();
    expect(await preparerBoutonAlerte(base(rpc), { ...alerte, parametres: ["Amine", "X"] }, JETON)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("les autres messages ne changent pas", async () => {
    const rpc = vi.fn();
    const autre = { ...alerte, modele: "oranpromo_commande_expiree", parametres: ["a", "b", "c"] };
    expect(await preparerBoutonAlerte(base(rpc), autre, JETON)).toBe(autre);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("envoi : alerte arrêtée → aucun appel au fournisseur, échec définitif enregistré", async () => {
    const rpc = vi.fn().mockImplementation((nom: string) => Promise.resolve(nom === "jeton_alertes_envoi" ? { data: null, error: null } : { data: null, error: null }));
    const fournisseur: FournisseurWhatsApp = { nom: "test", envoyer: vi.fn() };
    expect(await envoyerMessages(base(rpc), [alerte], fournisseur, JETON)).toEqual({ envoyes: 0, echecs: 1, reportes: 0 });
    expect(fournisseur.envoyer).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("resultat_message_whatsapp", { jeton: JETON, message: "m9", reservation: "r9", succes: false, erreur: ALERTE_ARRETEE, definitif: true });
  });
  it("envoi : alerte active → envoyée avec le bouton", async () => {
    const rpc = vi.fn().mockImplementation((nom: string) => Promise.resolve(nom === "jeton_alertes_envoi" ? { data: LIEN, error: null } : { data: null, error: null }));
    const envoyer = vi.fn().mockResolvedValue({ succes: true, identifiant: "wamid.9" });
    expect(await envoyerMessages(base(rpc), [alerte], { nom: "test", envoyer }, JETON)).toEqual({ envoyes: 1, echecs: 0, reportes: 0 });
    expect(envoyer.mock.calls[0][0]).toMatchObject({ modele: "bledeal_nouvelles_promos", parametres: ["Amine", "Boutique Alpha et 1 autre(s)"], bouton: LIEN });
  });
});

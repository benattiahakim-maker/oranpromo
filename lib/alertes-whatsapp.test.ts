import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { afficherBlocCompte, erreurAlertes, estModeleAlerte, jetonAlertesValide, lireEtat, lireEtatAlertes, lireEtatLien, lireEtatParLien, proposerApresSuivi } from "./alertes-whatsapp";

const base = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient<Database>;

describe("alertes WhatsApp (US-31.5)", () => {
  it("éteintes par défaut : réponse vide, erreur ou panne → rien de proposé", async () => {
    expect(lireEtat(null)).toEqual({ proposees: false, actives: false });
    expect(lireEtat({ proposees: "oui", actives: 1 })).toEqual({ proposees: false, actives: false });
    expect(await lireEtatAlertes(base(vi.fn().mockResolvedValue({ data: null, error: { code: "500" } })))).toEqual({ proposees: false, actives: false });
    expect(await lireEtatAlertes(base(vi.fn().mockRejectedValue(new Error("réseau"))))).toEqual({ proposees: false, actives: false });
    expect(await lireEtatAlertes(base(vi.fn().mockResolvedValue({ data: { proposees: true, actives: false }, error: null })))).toEqual({ proposees: true, actives: false });
  });
  it("bloc après « Suivre » : proposées et pas encore actives ; bloc du compte : proposées ou actives", () => {
    expect(proposerApresSuivi({ proposees: true, actives: false })).toBe(true);
    expect(proposerApresSuivi({ proposees: true, actives: true })).toBe(false);
    expect(proposerApresSuivi({ proposees: false, actives: false })).toBe(false);
    expect(afficherBlocCompte({ proposees: false, actives: true })).toBe(true);
    expect(afficherBlocCompte({ proposees: false, actives: false })).toBe(false);
  });
  it("modèles et jeton du lien", () => {
    expect(estModeleAlerte("bledeal_nouvelles_promos")).toBe(true);
    expect(estModeleAlerte("bledeal_nouvelles_promos_ar")).toBe(true);
    expect(estModeleAlerte("oranpromo_commande_prete")).toBe(false);
    expect(jetonAlertesValide("0123456789abcdef".repeat(3))).toBe(true);
    expect(jetonAlertesValide("0123456789ABCDEF".repeat(3))).toBe(false);
    expect(jetonAlertesValide("abc")).toBe(false);
    expect(jetonAlertesValide(null)).toBe(false);
  });
  it("erreurs de la base", () => {
    expect(erreurAlertes({ code: "42501" })).toBe("connexion");
    expect(erreurAlertes({ code: "55000" })).toBe("nonProposees");
    expect(erreurAlertes({ code: "XX000" })).toBe("erreur");
    expect(erreurAlertes(null)).toBe("erreur");
  });
  it("page du lien : jeton mal formé → null sans appel ; état lu ; erreur → exception", async () => {
    const rpc = vi.fn();
    expect(await lireEtatParLien(base(rpc), "pas-un-jeton")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(await lireEtatParLien(base(vi.fn().mockResolvedValue({ data: "actives", error: null })), "a".repeat(48))).toBe("actives");
    await expect(lireEtatParLien(base(vi.fn().mockResolvedValue({ data: null, error: { code: "500" } })), "a".repeat(48))).rejects.toThrow();
    expect(lireEtatLien("autre")).toBeNull();
    expect(lireEtatLien("desactivees")).toBe("desactivees");
  });
});

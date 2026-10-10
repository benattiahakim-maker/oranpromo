import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/app/espace/retrait/actions", () => ({ remettreCommandeRetrait: vi.fn() }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok", commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T17:30:00Z", terminee_le: null, mode_remise: null,
  lignes: [{ titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix_unitaire: 3900 }, { titre: "Huile parfumée musc blanc", taille: "10 ml", quantite: 2, prix_unitaire: 1200 }] };
const afficher = async (jeton = JETON) => renderToStaticMarkup(await Page({ params: Promise.resolve({ jeton }) }));
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: resume, error: null }); });

describe("US-26.3 : /espace/retrait/[jeton]", () => {
  it("non indexée, sans Referer", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false }); expect(metadata.referrer).toBe("no-referrer");
  });
  it("ouvrir la page lit seulement (retrait_boutique) : résumé, prénom, montant à encaisser, bouton « Remis au client »", async () => {
    const html = await afficher();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("retrait_boutique", { jeton: JETON });
    expect(html).toContain("Commande trouvée · par QR code");
    expect(html).toContain("Commande n° 128 · Amine");
    expect(html).toContain("Eau de parfum rose et musc · 50 ml × 1");
    expect(html).toMatch(/À encaisser en espèces<\/span><span[^>]*><bdi dir="ltr" data-prix="">6\s300\sDA<\/bdi>/); // prix isolé (page en arabe)
    expect(html).toContain("Un proche peut venir à sa place : c’est normal.");
    expect(html).toContain("Remis au client");
  });
  it.each([
    [{ etat: "invalide" }, "Ce QR code n’est pas valide pour votre boutique."],
    [{ ...resume, etat: "deja_remise", terminee_le: "2026-10-10T16:05:00Z" }, "Déjà remise le 10/10 à 17 h 05."],
    [{ ...resume, etat: "annulee" }, "Cette commande a été annulée."],
    [{ ...resume, etat: "expiree" }, "Cette commande a expiré : elle n’est plus à remettre."],
  ])("message sans résumé ni bouton : %j", async (data, message) => {
    rpc.mockResolvedValue({ data, error: null });
    const html = await afficher();
    expect(html).toContain(message); expect(html).not.toContain("Remis au client"); expect(html).not.toContain("Amine");
    expect(html).toContain('href="/espace/scanner"');
  });
  it("jeton mal formé : même message, sans appel ; pas une boutique : demande la connexion", async () => {
    expect(await afficher("abc")).toContain("Ce QR code n’est pas valide pour votre boutique.");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    expect(await afficher()).toContain("Connectez-vous à votre espace boutique.");
  });
});

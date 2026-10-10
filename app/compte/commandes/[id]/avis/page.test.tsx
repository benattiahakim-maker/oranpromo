import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { lireCommande, lireMesNotes, langue } = vi.hoisted(() => ({ lireCommande: vi.fn(), lireMesNotes: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "k1" } } }) } }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
vi.mock("@/lib/commandes", async (original) => ({ ...(await original<typeof import("@/lib/commandes")>()), lireCommande }));
vi.mock("@/lib/avis", async (original) => ({ ...(await original<typeof import("@/lib/avis")>()), lireMesNotes }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("@/app/compte/commandes/[id]/avis/actions", () => ({ donnerMonAvis: vi.fn() }));

const hier = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const commande = (champs: Record<string, unknown> = {}) => ({ id: "c1", numero: 134, client_id: "k1", statut: "recuperee", mode_remise: "qr", terminee_le: hier(), boutiques: { nom: "Boutique Nour" }, ...champs });
const afficher = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "c1" }) }));
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; lireCommande.mockResolvedValue(commande()); lireMesNotes.mockResolvedValue(new Map()); });

describe("US-32.2 : page « Donner mon avis »", () => {
  it("commande récupérée par QR code hier : titre « Votre avis sur Boutique Nour » et formulaire", async () => {
    const html = await afficher();
    expect(html).toContain("Votre avis sur Boutique Nour"); expect(html).toContain("Commande n° 134");
    expect(html).toContain("Publier mon avis");
  });
  it("avis déjà donné : la note, pas de formulaire", async () => {
    lireMesNotes.mockResolvedValue(new Map([["c1", 4]]));
    const html = await afficher();
    expect(html).toContain("Avis donné · ★ 4"); expect(html).not.toContain("Publier mon avis");
  });
  it.each([["remise par code", { mode_remise: "code" }], ["sans QR code", { mode_remise: "manuel" }], ["après 14 jours", { terminee_le: "2026-01-01T00:00:00Z" }], ["pas récupérée", { statut: "prete", mode_remise: null, terminee_le: null }]])
  ("%s : pas de formulaire, explication", async (_, champs) => {
    lireCommande.mockResolvedValue(commande(champs));
    const html = await afficher();
    expect(html).not.toContain("Publier mon avis");
    expect(html).toContain("Un avis est possible seulement sur une commande récupérée avec votre QR code, dans les 14 jours.");
  });
  it("commande d'un autre compte : page introuvable", async () => {
    lireCommande.mockResolvedValue(commande({ client_id: "autre" }));
    await expect(afficher()).rejects.toThrow("404");
  });
  it("en arabe : « رايك في Boutique Nour »", async () => {
    langue.valeur = "ar";
    expect(await afficher()).toContain("رايك في Boutique Nour");
  });
});

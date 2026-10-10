import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { listerMesCommandes, lireMesNotes } = vi.hoisted(() => ({ listerMesCommandes: vi.fn(), lireMesNotes: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => "fr" }));
vi.mock("@/lib/commandes", async (original) => ({ ...(await original<typeof import("@/lib/commandes")>()), listerMesCommandes }));
vi.mock("@/lib/clients", async (original) => ({ ...(await original<typeof import("@/lib/clients")>()), lireProfilClient: async () => null }));
vi.mock("@/lib/avis", async (original) => ({ ...(await original<typeof import("@/lib/avis")>()), lireMesNotes }));

const il_y_a = (jours: number) => new Date(Date.now() - jours * 24 * 3600 * 1000).toISOString();
const ligne = (id: string, champs: Record<string, unknown>) => ({ id, numero: 100, statut: "recuperee", total: 4200, cree_le: il_y_a(3), expire_le: null, mode_remise: "qr", terminee_le: il_y_a(2), boutiques: { nom: "Boutique Nour" }, ...champs });
beforeEach(() => { vi.clearAllMocks(); lireMesNotes.mockResolvedValue(new Map()); });

describe("US-32.2 : « Donner mon avis » dans « Mes commandes »", () => {
  it("bouton seulement sur une commande récupérée par QR code depuis 14 jours au plus et sans avis ; sinon la note donnée", async () => {
    listerMesCommandes.mockResolvedValue([
      ligne("qr-recente", {}), ligne("qr-notee", {}), ligne("qr-ancienne", { terminee_le: il_y_a(15) }),
      ligne("code", { mode_remise: "code" }), ligne("manuel", { mode_remise: "manuel" }), ligne("prete", { statut: "prete", mode_remise: null, terminee_le: null }),
    ]);
    lireMesNotes.mockResolvedValue(new Map([["qr-notee", 4]]));
    const html = await afficher();
    expect(html.match(/Donner mon avis/g)).toHaveLength(1);
    expect(html).toContain('href="/compte/commandes/qr-recente/avis"');
    expect(html).toContain("Avis donné · ★ 4");
    // Notes lues seulement pour les commandes remises par QR code.
    expect(lireMesNotes).toHaveBeenCalledWith(expect.anything(), ["qr-recente", "qr-notee", "qr-ancienne"]);
  });
  it("lecture des avis impossible : la liste s'affiche quand même", async () => {
    listerMesCommandes.mockResolvedValue([ligne("qr-recente", {})]);
    lireMesNotes.mockRejectedValue(new Error("x"));
    const html = await afficher();
    expect(html).toContain("Boutique Nour"); expect(html).not.toContain("Impossible de charger vos commandes");
  });
});
async function afficher() { return renderToStaticMarkup(await Page()); }

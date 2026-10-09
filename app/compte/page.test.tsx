import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { rpc, profil, cookie } = vi.hoisted(() => ({ rpc: vi.fn(), profil: { valeur: null as Record<string, unknown> | null }, cookie: { parrain: undefined as string | undefined } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/langue-serveur", async () => { const { textesDe } = await import("@/lib/textes"); return { getLangue: async () => "fr", getTextes: async () => textesDe("fr") }; });
vi.mock("@/lib/clients", async (original) => ({ ...(await original<typeof import("@/lib/clients")>()), lireProfilClient: async () => profil.valeur, listerMesNoShows: async () => [] }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "parrain" && cookie.parrain ? { value: cookie.parrain } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); }, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/compte/actions", () => ({ enregistrerProfil: vi.fn(), enregistrerNom: vi.fn(), envoyerCodeVerification: vi.fn(), verifierCodeVerification: vi.fn(), contesterMonNoShow: vi.fn() }));
vi.mock("@/app/compte/parrainage/actions", () => ({ choisirParrain: vi.fn() }));

const parrainage = (extra: Record<string, unknown> = {}) => ({ actif: true, peut_parrainer: true, code: "K7M2QX", parrain_saisi: false, saisies: 0, peut_choisir: false, choix_jusqu_au: null, filleuls: [], en_attente: 0, plafond_atteint: false, ...extra });
const bon = { id: "b1", montant: 300, statut: "disponible", origine: "parrainage_filleul", cree_le: "2099-10-12T10:00:00Z", expire_le: "2099-12-11T10:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null };
function base(mon: unknown, bons: unknown[] = []) {
  rpc.mockImplementation(async (nom: string) => nom === "mon_parrainage" ? { data: mon, error: null } : nom === "mes_bons" ? { data: bons, error: null }
    : nom === "mon_code_parrainage" ? { data: "K7M2QX", error: null } : { data: null, error: null });
}
const afficher = async () => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.clearAllMocks(); cookie.parrain = undefined; vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oranpromo.dz");
  profil.valeur = { id: "k1", nom: "Amine Kaci", telephone: "+213661234567", telephone_verifie_le: "2026-10-09T10:00:00Z", no_shows: 0, bloque: false, role: "client", boutique_id: null }; });

describe("US-27 : /compte", () => {
  it("parrainage fermé, sans bon ni filleul : aucun bloc", async () => {
    base(parrainage({ actif: false }));
    const html = await afficher();
    expect(html).not.toContain("Mon parrainage"); expect(html).not.toContain("Mes bons"); expect(html).not.toContain("Ton parrain");
  });
  it("nouveau client (7 jours, aucune commande) : « Ton parrain » pré-rempli par le lien d'invitation", async () => {
    cookie.parrain = "K7M2QX";
    base(parrainage({ peut_choisir: true, peut_parrainer: true }));
    const html = await afficher();
    expect(html).toContain("Ton parrain (facultatif)"); expect(html).toContain('value="K7M2QX"');
  });
  it("après une commande (la base répond peut_choisir = faux) : le bloc disparaît", async () => {
    cookie.parrain = "K7M2QX";
    base(parrainage({ peut_choisir: false }));
    expect(await afficher()).not.toContain("Ton parrain (facultatif)");
  });
  it("client vérifié, parrainage ouvert : « Mon parrainage » avec code et lien /p/<code> ; « Mes bons »", async () => {
    base(parrainage(), [bon]);
    const html = await afficher();
    expect(html).toContain("Mon parrainage"); expect(html).toContain("K7M2QX");
    expect(decodeURIComponent(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/.exec(html)![1])).toContain("https://oranpromo.dz/p/K7M2QX");
    expect(html).toContain("Mes bons"); expect(html).toContain("valable jusqu’au 11 décembre");
  });
  it("commerçant : la base n'est pas interrogée pour le parrainage", async () => {
    profil.valeur = { ...profil.valeur!, role: "commercant", boutique_id: "b1" };
    base(parrainage());
    const html = await afficher();
    expect(rpc).not.toHaveBeenCalled(); expect(html).not.toContain("Mon parrainage");
  });
});

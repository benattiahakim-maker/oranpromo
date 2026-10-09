import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { rpc, utilisateur, cookie } = vi.hoisted(() => ({ rpc: vi.fn(), utilisateur: { valeur: null as { id: string } | null }, cookie: { parrain: undefined as string | undefined } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, auth: { getUser: async () => ({ data: { user: utilisateur.valeur } }) } }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => "fr" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "parrain" && cookie.parrain ? { value: cookie.parrain } : undefined) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/compte/parrainage/actions", () => ({ choisirParrain: vi.fn() }));
vi.mock("@/components/EntetePublic", () => ({ default: () => null }));

const mon = (extra: Record<string, unknown> = {}) => ({ actif: true, peut_parrainer: true, code: null, parrain_saisi: false, saisies: 0, peut_choisir: false, filleuls: [], en_attente: 0, plafond_atteint: false, ...extra });
const reponses = (ouvert: boolean, parrainage: unknown = null) => rpc.mockImplementation(async (nom: string) =>
  nom === "parrainage_ouvert" ? { data: ouvert, error: null } : nom === "mon_parrainage" ? { data: parrainage, error: null } : nom === "mon_code_parrainage" ? { data: "K7M2QX", error: null } : { data: null, error: null });
const afficher = async (invite?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(invite ? { invite } : {}) }));
beforeEach(() => { vi.clearAllMocks(); utilisateur.valeur = null; cookie.parrain = undefined; vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oranpromo.dz"); });

describe("US-27.3 : /parrainage", () => {
  it("visiteur, parrainage ouvert : explication et connexion, sans lecture du compte", async () => {
    reponses(true);
    const html = await afficher();
    expect(html).toContain("Parraine tes amis"); expect(html).toContain("Connecte-toi pour avoir ton lien");
    expect(rpc).not.toHaveBeenCalledWith("mon_parrainage");
  });
  it("parrainage fermé : « pas encore ouvert », pas de bouton", async () => {
    reponses(false);
    expect(await afficher()).toContain("pas encore ouvert");
  });
  it("client vérifié : code, lien /p/<code>, QR code", async () => {
    utilisateur.valeur = { id: "k1" }; reponses(true, mon());
    const html = await afficher();
    expect(html).toContain("K7M2QX"); expect(html).toContain("oranpromo.dz/p/K7M2QX"); expect(html).toContain("data:image/svg+xml");
  });
  it("invitation : bandeau, champ pré-rempli pour un nouveau client ; code gardé seulement s'il est bien formé", async () => {
    utilisateur.valeur = { id: "k2" }; cookie.parrain = "K7M2QX"; reponses(true, mon({ peut_parrainer: false, peut_choisir: true }));
    let html = await afficher("1");
    expect(html).toContain("Un ami t’invite sur OranPromo"); expect(html).toContain('value="K7M2QX"');
    cookie.parrain = "<b>";
    html = await afficher("1");
    expect(html).toContain('value=""');
  });
});

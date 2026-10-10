import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, langue } = vi.hoisted(() => ({ rpc: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
vi.mock("./actions", () => ({ nePlusRecevoir: vi.fn() }));
import Page, { metadata } from "./page";

const JETON = "0123456789abcdef".repeat(3);
const afficher = async (jeton = JETON) => renderToStaticMarkup(await Page({ params: Promise.resolve({ jeton }) }));
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; rpc.mockResolvedValue({ data: "actives", error: null }); });

describe("US-31.5 : page du lien « Ne plus recevoir »", () => {
  it("non indexée, sans Referer (le jeton est dans l'adresse)", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });
  it("alertes actives : question et bouton ; l'ouverture seule ne désabonne pas (lecture seulement)", async () => {
    const html = await afficher();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("etat_alertes_par_lien", { jeton: JETON });
    expect(html).toContain("Ne plus recevoir sur WhatsApp les nouvelles promos des boutiques que vous suivez ?");
    expect(html).toContain(">Ne plus recevoir</button>");
  });
  it("déjà désactivées : « Vous ne recevrez plus d'alertes. Vous suivez toujours vos boutiques. »", async () => {
    rpc.mockResolvedValue({ data: "desactivees", error: null });
    const html = await afficher();
    expect(html).toContain("Vous ne recevrez plus d’alertes.");
    expect(html).toContain("Vous suivez toujours vos boutiques.");
  });
  it("lien inconnu ou mal formé : « Ce lien n'est pas valide. » ; panne : message d'erreur", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await afficher()).toContain("Ce lien n’est pas valide.");
    rpc.mockClear();
    expect(await afficher("pas-un-jeton")).toContain("Ce lien n’est pas valide.");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await afficher()).toContain("Action impossible pour le moment. Réessayez.");
  });
  it("en arabe : titre arabe", async () => {
    langue.valeur = "ar";
    rpc.mockResolvedValue({ data: "desactivees", error: null });
    expect(await afficher()).toContain("التنبيهات في الواتساب");
  });
});

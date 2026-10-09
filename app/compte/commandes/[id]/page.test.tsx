import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { rpc, lireCommande, langue } = vi.hoisted(() => ({ rpc: vi.fn(), lireCommande: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, auth: { getUser: async () => ({ data: { user: { id: "k1" } } }) } }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
vi.mock("@/lib/commandes", async (original) => ({ ...(await original<typeof import("@/lib/commandes")>()), lireCommande }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/compte/actions", () => ({ annulerMaCommande: vi.fn() }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const commande = (statut: string) => ({ id: "c1", numero: 128, client_id: "k1", statut, total: 6300, note: null, motif_annulation: null, expire_le: "2026-10-10T18:30:00Z",
  boutiques: { nom: "Parfumerie Démo", slug: "parfumerie-demo", quartier: "Gambetta", adresse: "12 rue de Mostaganem", whatsapp: "+213555000000" },
  suivi_commandes: [], lignes_commande: [{ id: "l1", article_id: "a1", titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix_unitaire: 3900 }] });
const afficher = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "c1" }) }));
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oranpromo.example");
  lireCommande.mockResolvedValue(commande("prete")); rpc.mockResolvedValue({ data: [{ jeton: JETON, code: "0481" }], error: null }); });

describe("US-26.2 : QR code de retrait dans « Mes commandes »", () => {
  it("commande prête : QR code, code, montant, envoi à un proche avec le lien /retrait/<jeton>", async () => {
    const html = await afficher();
    expect(rpc).toHaveBeenCalledWith("retrait_client", { commande: "c1" });
    expect(html).toContain("Mon QR code de retrait"); expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("À payer en espèces");
    const whatsapp = decodeURIComponent(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/.exec(html)![1].replace(/&amp;/g, "&"));
    expect(whatsapp).toContain(`https://oranpromo.example/retrait/${JETON}`); expect(whatsapp).toContain("n° 128 chez Parfumerie Démo");
    // Le jeton n'apparaît en clair que dans le lien à partager (le QR code est une image).
    expect(html.split(JETON).length - 1).toBe(1);
  });
  it.each(["demandee", "confirmee", "recuperee", "annulee", "expiree"])("commande « %s » : pas de QR code, la base n’est pas lue", async (statut) => {
    lireCommande.mockResolvedValue(commande(statut));
    const html = await afficher();
    expect(html).not.toContain("Mon QR code de retrait"); expect(rpc).not.toHaveBeenCalled();
  });
  it("prête mais la base ne rend rien (date passée) ou erreur : la page s’affiche sans QR code", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await afficher()).not.toContain("Mon QR code de retrait");
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    const html = await afficher();
    expect(html).not.toContain("Mon QR code de retrait"); expect(html).toContain("Eau de parfum rose et musc");
  });
});

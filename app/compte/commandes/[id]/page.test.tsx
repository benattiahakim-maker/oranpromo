import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { rpc, lireCommande, langue, notesAvis } = vi.hoisted(() => ({ rpc: vi.fn(), lireCommande: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" }, notesAvis: { liste: [] as { commande_id: string; note: number }[] } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc, from: () => ({ select: () => ({ in: async () => ({ data: notesAvis.liste, error: null }) }) }), auth: { getUser: async () => ({ data: { user: { id: "k1" } } }) } }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
vi.mock("@/lib/commandes", async (original) => ({ ...(await original<typeof import("@/lib/commandes")>()), lireCommande }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/compte/actions", () => ({ annulerMaCommande: vi.fn() }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const commande = (statut: string) => ({ id: "c1", numero: 128, client_id: "k1", statut, total: 6300, note: null, motif_annulation: null, expire_le: "2026-10-10T18:30:00Z",
  boutiques: { nom: "Parfumerie Démo", slug: "parfumerie-demo", quartier: "Gambetta", adresse: "12 rue de Mostaganem", whatsapp: "+213555000000" },
  suivi_commandes: [], lignes_commande: [{ id: "l1", article_id: "a1", titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix_unitaire: 3900 }] });
const afficher = async (bon?: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "c1" }), searchParams: Promise.resolve(bon ? { bon } : {}) }));
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://oranpromo.example");
  lireCommande.mockResolvedValue(commande("prete")); rpc.mockResolvedValue({ data: [{ jeton: JETON, code: "048193" }], error: null }); });

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
    // US-27.3 : une commande récupérée lit seulement le parrainage (encadré « Merci ! »), jamais le retrait.
    expect(html).not.toContain("Mon QR code de retrait"); expect(rpc).not.toHaveBeenCalledWith("retrait_client", expect.anything());
  });
  it("prête mais la base ne rend rien (date passée) ou erreur : la page s’affiche sans QR code", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await afficher()).not.toContain("Mon QR code de retrait");
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    const html = await afficher();
    expect(html).not.toContain("Mon QR code de retrait"); expect(html).toContain("Eau de parfum rose et musc");
  });
});

describe("US-27.3 et US-27.4 : bon et parrainage sur le suivi", () => {
  it("commande avec bon : Total, Bon parrainage −300 DA, À payer en espèces 6 000 DA (aussi sur le QR code)", async () => {
    lireCommande.mockResolvedValue({ ...commande("prete"), remise_bon: 300 });
    const html = await afficher();
    expect(html).toContain("Bon parrainage"); expect(html).toMatch(/−300\sDA/);
    expect(html.match(/6\s000\sDA/g)?.length).toBe(2);
  });
  it("bon coché mais non posé : la raison s'affiche sur une commande au prix plein ; valeur inconnue ignorée", async () => {
    lireCommande.mockResolvedValue(commande("demandee"));
    expect(await afficher("aucun_bon")).toContain("Bon non appliqué : il a expiré ou n’est plus disponible.");
    expect(await afficher("<script>")).not.toContain("Bon non appliqué");
    lireCommande.mockResolvedValue({ ...commande("demandee"), remise_bon: 300 });
    expect(await afficher("aucun_bon")).not.toContain("Bon non appliqué");
  });
  it("commande récupérée, parrainage ouvert : encadré « Merci ! » avec le lien WhatsApp", async () => {
    lireCommande.mockResolvedValue(commande("recuperee"));
    rpc.mockImplementation(async (nom: string) => nom === "mon_parrainage" ? { data: { actif: true, peut_parrainer: true, filleuls: [], en_attente: 0 }, error: null }
      : nom === "mon_code_parrainage" ? { data: "K7M2QX", error: null } : { data: null, error: null });
    const html = await afficher();
    expect(html).toContain("Merci !");
    expect(decodeURIComponent(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/.exec(html)![1])).toContain("https://oranpromo.example/p/K7M2QX");
  });
  it("pas d'encadré si le parrainage est fermé ou la commande pas récupérée", async () => {
    rpc.mockImplementation(async (nom: string) => nom === "mon_parrainage" ? { data: { actif: false, peut_parrainer: true }, error: null } : { data: [{ jeton: JETON, code: "048193" }], error: null });
    lireCommande.mockResolvedValue(commande("recuperee"));
    expect(await afficher()).not.toContain("Merci !");
    lireCommande.mockResolvedValue(commande("prete"));
    expect(await afficher()).not.toContain("Merci !");
  });
});

describe("US-32.2 : « Donner mon avis » sur le suivi", () => {
  const ID = "11111111-2222-3333-4444-555555555555";
  const recuperee = (champs: Record<string, unknown>) => ({ ...commande("recuperee"), id: ID, terminee_le: new Date(Date.now() - 3600 * 1000).toISOString(), ...champs });
  beforeEach(() => { notesAvis.liste = []; });
  it("récupérée par QR code il y a une heure : bouton vers /compte/commandes/<id>/avis", async () => {
    lireCommande.mockResolvedValue(recuperee({ mode_remise: "qr" }));
    const html = await afficher();
    expect(html).toContain(`href="/compte/commandes/${ID}/avis"`); expect(html).toContain("Donner mon avis");
  });
  it("avis déjà donné : « Avis donné · ★ 5 », pas de bouton", async () => {
    lireCommande.mockResolvedValue(recuperee({ mode_remise: "qr" }));
    notesAvis.liste = [{ commande_id: ID, note: 5 }];
    const html = await afficher();
    expect(html).toContain("Avis donné · ★ 5"); expect(html).not.toContain("Donner mon avis");
  });
  it.each([["code", "code à 6 chiffres"], ["manuel", "sans QR code"]])("remise « %s » (%s) : pas de bouton", async (mode) => {
    lireCommande.mockResolvedValue(recuperee({ mode_remise: mode }));
    expect(await afficher()).not.toContain("Donner mon avis");
  });
  it("récupérée il y a 15 jours : pas de bouton", async () => {
    lireCommande.mockResolvedValue(recuperee({ mode_remise: "qr", terminee_le: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString() }));
    expect(await afficher()).not.toContain("Donner mon avis");
  });
  it("en arabe : « قول رايك »", async () => {
    langue.valeur = "ar";
    lireCommande.mockResolvedValue(recuperee({ mode_remise: "qr" }));
    expect(await afficher()).toContain("قول رايك");
  });
});

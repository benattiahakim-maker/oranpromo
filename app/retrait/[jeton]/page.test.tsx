import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";

const { rpc, langue } = vi.hoisted(() => ({ rpc: vi.fn(), langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const vue = (etat: string, code: string | null = "0481") => ({ etat, numero: 128, total: 6300, expire_le: "2026-10-10T18:30:00Z", terminee_le: null,
  boutique: { nom: "Parfumerie Démo", slug: "parfumerie-demo", quartier: "Gambetta", adresse: "12 rue de Mostaganem" },
  lignes: [{ titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix_unitaire: 3900 }, { titre: "Huile parfumée musc blanc", taille: "10 ml", quantite: 2, prix_unitaire: 1200 }], code });
const afficher = async (jeton = JETON) => renderToStaticMarkup(await Page({ params: Promise.resolve({ jeton }) }));
beforeEach(() => { vi.clearAllMocks(); langue.valeur = "fr"; rpc.mockResolvedValue({ data: vue("prete"), error: null }); });

describe("US-26.2 : page du retrait (proche, sans connexion)", () => {
  it("non indexée, sans Referer (le jeton est dans l’adresse)", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false }); expect(metadata.referrer).toBe("no-referrer");
  });
  it("commande prête : boutique, date, QR code, code, articles et montant ; jamais de nom ni de téléphone", async () => {
    const html = await afficher();
    expect(rpc).toHaveBeenCalledWith("retrait_par_lien", { jeton: JETON });
    expect(html).toContain("Commande n° 128 à récupérer chez Parfumerie Démo");
    expect(html).toContain("Avant le"); expect(html).toContain("<bdi>12 rue de Mostaganem</bdi></span><span> · <bdi>Gambetta</bdi>");
    expect(html).toContain('href="/b/parfumerie-demo"');
    expect(html).toContain("Montrez ce QR code au vendeur, ou donnez-lui le code :");
    expect(html).toContain("data:image/svg+xml"); expect(html).toMatch(/>0<\/span><span[^>]*>4<\/span><span[^>]*>8<\/span><span[^>]*>1</);
    expect(html).toContain("<bdi>Eau de parfum rose et musc</bdi> · <bdi>50 ml</bdi> × 1"); expect(html).toContain("<bdi>Huile parfumée musc blanc</bdi> · <bdi>10 ml</bdi> × 2");
    expect(html).toContain("À payer en espèces");
    expect(html).not.toContain("+213"); expect(html).not.toContain("Envoyer à un proche");
  });
  it.each([
    ["recuperee", "Cette commande a déjà été récupérée."],
    ["annulee", "Cette commande a été annulée : il n’y a rien à récupérer."],
    ["expiree", "Cette commande a expiré : elle n’est plus à récupérer."],
  ])("commande « %s » : message, pas de QR code", async (etat, message) => {
    rpc.mockResolvedValue({ data: vue(etat, null), error: null });
    const html = await afficher();
    expect(html).toContain(message); expect(html).not.toContain("data:image/svg+xml");
  });
  it("lien inconnu ou abîmé : « Ce lien n’est pas valide. » ; abîmé : la base n’est pas appelée", async () => {
    expect(await afficher("abime")).toContain("Ce lien n’est pas valide.");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await afficher()).toContain("Ce lien n’est pas valide.");
  });
  it("base indisponible : message clair", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await afficher()).toContain("Impossible de charger la commande. Réessayez.");
  });
  it("arabe : titre, date et contenance en arabe", async () => {
    langue.valeur = "ar";
    const html = await afficher();
    expect(html).toContain("الطلبية رقم 128 تدّيها من Parfumerie Démo");
    expect(html).toContain("50\u00a0مل");
  });
});

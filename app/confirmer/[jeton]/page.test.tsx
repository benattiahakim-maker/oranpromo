import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import { creerLienConfirmation, DUREE_LIEN_MS } from "@/lib/confirmation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ rpc }) }));
vi.mock("@/app/confirmer/actions", () => ({ confirmerCommandeDepuisLien: vi.fn() }));
const SECRET = "secret-confirmation-de-test";
const ID = "0b9f2c1e-5a4d-4c3b-9e8f-112233445566";
const commande = (statut: string) => ({ numero: 15, boutique: "Boutique Amine", client: "Samia B.", statut, total: 8700, note: "Je passe samedi.", cree_le: "2026-10-09T13:05:00Z",
  lignes: [{ titre: "Polo piqué", taille: "M", quantite: 1, prix_unitaire: 3500 }, { titre: "Chemise lin", taille: "L", quantite: 1, prix_unitaire: 5200 }] });
const afficher = async (jeton: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ jeton }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CONFIRMATION_SECRET", SECRET); rpc.mockResolvedValue({ data: commande("demandee"), error: null }); });

describe("US-20.6 : page du lien « Confirmer »", () => {
  it("montre la commande et le bouton, sans rien confirmer à l’ouverture", async () => {
    const html = await afficher(creerLienConfirmation(ID, SECRET));
    expect(html).toContain("Boutique Amine · Commande n° 15"); expect(html).toContain("Samia B.");
    expect(html).toContain("Polo piqué · M × 1"); expect(html).toContain("Total"); expect(html).toContain("Note du client");
    expect(html).toContain("Confirmer la commande");
    expect(rpc).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledWith("commande_a_confirmer", { jeton: SECRET, commande: ID });
    expect(rpc).not.toHaveBeenCalledWith("confirmer_commande_par_lien", expect.anything());
  });
  it.each([
    ["confirmee", "Cette commande est déjà confirmée."], ["prete", "Cette commande est déjà confirmée."], ["recuperee", "Cette commande est déjà confirmée."],
    ["annulee", "Cette commande a été annulée : il n’y a rien à confirmer."], ["expiree", "Cette commande a expiré : il n’y a rien à confirmer."],
  ])("commande « %s » : pas de bouton, « %s »", async (statut, message) => {
    rpc.mockResolvedValue({ data: commande(statut), error: null });
    const html = await afficher(creerLienConfirmation(ID, SECRET));
    expect(html).toContain(message); expect(html).not.toContain("Confirmer la commande");
  });
  it("lien expiré, invalide ou commande inconnue : message clair, la base n’est pas lue pour un faux lien", async () => {
    expect(await afficher(creerLienConfirmation(ID, SECRET, Date.now() - DUREE_LIEN_MS - 1000))).toContain("Ce lien a expiré.");
    expect(await afficher("faux-lien")).toContain("Ce lien n’est pas valide.");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await afficher(creerLienConfirmation(ID, SECRET))).toContain("Ce lien n’est pas valide.");
  });
  it("sans CONFIRMATION_SECRET ou base indisponible : renvoie vers l’espace", async () => {
    vi.stubEnv("CONFIRMATION_SECRET", "");
    expect(await afficher(creerLienConfirmation(ID, SECRET))).toContain("pas disponible");
    vi.stubEnv("CONFIRMATION_SECRET", SECRET);
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Accès refusé." } });
    const html = await afficher(creerLienConfirmation(ID, SECRET));
    expect(html).toContain("pas disponible"); expect(html).toContain("/espace/commandes");
  });
  it("ne montre jamais le téléphone du client", async () => {
    expect(await afficher(creerLienConfirmation(ID, SECRET))).not.toContain("+213");
  });
});

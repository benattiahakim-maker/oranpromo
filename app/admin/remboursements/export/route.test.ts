import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const { verifier, lister } = vi.hoisted(() => ({ verifier: vi.fn(), lister: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
vi.mock("@/lib/parrainage-admin", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/parrainage-admin")>()), listerReleves: lister }));
const requete = (q: string) => new NextRequest(`http://localhost/admin/remboursements/export${q}`);
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); lister.mockResolvedValue([]); });

describe("US-27.5 export CSV", () => {
  it("non-admin : 404 sans lecture des relevés", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    const r = await GET(requete("?mois=2026-10"));
    expect(r.status).toBe(404);
    expect(lister).not.toHaveBeenCalled();
  });
  it("admin : CSV du mois, BOM, nom de fichier, pas de cache", async () => {
    lister.mockResolvedValue([{ mois: "2026-10-01", statut: "a_payer", reference_paiement: null, boutique: { id: "b", nom: "Boutique Nour", slug: "boutique-nour", bons_acceptes: true },
      lignes: [{ id: "l", releve_id: "r", numero_commande: 128, remise_le: "2026-10-05T13:32:00Z", mode_remise: "qr", client: "Samia B.", total_commande: 3500, montant: 300, statut: "a_rembourser", motif: null, commande: null }] }]);
    const r = await GET(requete("?mois=2026-10"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="bledeal-bons-2026-10.csv"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    const octets = new Uint8Array(await r.arrayBuffer());
    expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texte = new TextDecoder().decode(octets);
    expect(texte).toContain("2026-10;Boutique Nour;boutique-nour;128;05/10/2026 14:32;qr;Samia B.;3500;300;300;a_rembourser;a_payer;");
    expect(lister).toHaveBeenCalledWith({}, "2026-10-01", null);
  });
  it("une seule boutique ; identifiant invalide refusé", async () => {
    const id = "6f1c2a40-1b2c-4d5e-8f90-123456789abc";
    await GET(requete(`?mois=2026-09&boutique=${id}`));
    expect(lister).toHaveBeenCalledWith({}, "2026-09-01", id);
    expect((await GET(requete("?mois=2026-09&boutique=x'or'1"))).status).toBe(400);
  });
  it("erreur de lecture : 500 sans détail", async () => {
    lister.mockRejectedValue(new Error("boom"));
    const r = await GET(requete("?mois=2026-10"));
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("Impossible de préparer l’export. Réessayez.");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { modifierArticle } from "./gestion-articles";
const prefixe = "https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/";
function simulation() {
  const article = { id: "article", boutique_id: "boutique", promos: null, tailles: [{ libelle: "M", disponible: true }], photos: [{ id: "ancienne", adresse: prefixe + "boutique/article/ancienne.jpg", adresse_vignette: null, ordre: 0 }] };
  const profil = { eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { boutique_id: "boutique" }, error: null }) }; profil.eq.mockReturnValue(profil);
  const requete = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: article, error: null }), single: vi.fn().mockResolvedValue({ data: { id: "article" }, error: null }) }; requete.eq.mockReturnValue(requete); requete.select.mockReturnValue(requete);
  const fin = { error: null, eq: vi.fn(), in: vi.fn().mockResolvedValue({ error: null }) }; fin.eq.mockReturnValue(fin);
  const insertion = vi.fn().mockResolvedValue({ error: null }), suppression = vi.fn().mockReturnValue(fin), ordre = vi.fn().mockReturnValue(fin);
  const update = vi.fn().mockReturnValue(requete), upsert = vi.fn().mockResolvedValue({ error: null });
  const upload = vi.fn().mockResolvedValue({ error: null }), remove = vi.fn().mockResolvedValue({ error: null });
  const stockage = { upload, remove, getPublicUrl: (chemin: string) => ({ data: { publicUrl: prefixe + chemin } }) };
  const client = { auth: { getUser: async () => ({ data: { user: { id: "compte" } }, error: null }) }, from: vi.fn((table: string) => table === "profils" ? { select: () => profil } : table === "tailles" ? { upsert } : table === "photos" ? { insert: insertion, delete: suppression, update: ordre } : { select: () => requete, update }), storage: { from: () => stockage } } as unknown as SupabaseClient<Database>;
  return { client, update, insertion, suppression, upload, remove, fin };
}
const saisie = { titre: "Polo", categorie: "Polos", genre: "homme", couleur: "Bleu", description: "", prix: "3500", tailles: ["M"], photos: [] };
const fichier = new File(["jpeg"], "p.jpg", { type: "image/jpeg" });
const compression = async (f: File) => f;
describe("photos en modification", () => {
  it("envoie dans le dossier imposé, puis remplace les lignes et retire le stockage ancien", async () => { const t = simulation(); await modifierArticle(t.client, "article", saisie, [{ libelle: "M", disponible: true }], { garder: [], fichiers: [fichier] }, compression); expect(t.upload.mock.calls[0][0]).toMatch(/^boutique\/article\/[^/]+\.jpg$/); expect(t.insertion).toHaveBeenCalledWith([expect.objectContaining({ article_id: "article", ordre: 0 })]); expect(t.fin.in).toHaveBeenCalledWith("id", ["ancienne"]); expect(t.remove).toHaveBeenCalledWith(["boutique/article/ancienne.jpg"]); expect(t.insertion.mock.invocationCallOrder[0]).toBeLessThan(t.suppression.mock.invocationCallOrder[0]); });
  it.each([{ garder: [], fichiers: [] }, { garder: ["autre"], fichiers: [] }, { garder: ["ancienne", "ancienne"], fichiers: [] }, { garder: ["ancienne"], fichiers: Array(5).fill(fichier) }])("refuse les identifiants étrangers et le nombre invalide avant toute écriture", async photos => { const t = simulation(); await expect(modifierArticle(t.client, "article", saisie, [{ libelle: "M", disponible: true }], photos, compression)).rejects.toThrow("1 et 5"); expect(t.update).not.toHaveBeenCalled(); expect(t.upload).not.toHaveBeenCalled(); });
  it("nettoie les nouveaux fichiers et conserve les anciens si l’insertion échoue", async () => { const t = simulation(); t.insertion.mockResolvedValue({ error: { message: "réseau" } }); await expect(modifierArticle(t.client, "article", saisie, [{ libelle: "M", disponible: true }], { garder: [], fichiers: [fichier] }, compression)).rejects.toThrow("photos n’ont pas été modifiées"); expect(t.suppression).not.toHaveBeenCalled(); expect(t.remove).toHaveBeenCalledWith([t.upload.mock.calls[0][0]]); });
  it("conserve les objets référencés si le retrait des anciennes lignes échoue", async () => { const t = simulation(); t.fin.in.mockResolvedValue({ error: { message: "réseau" } }); await expect(modifierArticle(t.client, "article", saisie, [{ libelle: "M", disponible: true }], { garder: [], fichiers: [fichier] }, compression)).rejects.toThrow("Rechargez"); expect(t.remove).not.toHaveBeenCalled(); });
});

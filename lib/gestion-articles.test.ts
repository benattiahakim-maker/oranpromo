import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { changerStatut, MASQUE_PAR_MODERATION, cheminPhotoArticle, confirmerModification, modifierArticle, preparerTailles, supprimerArticle, verifierPrixAvecPromo } from "./gestion-articles";

function simulation() {
  const article = { id: "article", boutique_id: "boutique", promos: null as { prix_promo: number } | null, tailles: [{ libelle: "S", disponible: true }, { libelle: "M", disponible: true }], photos: [{ adresse: "https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/boutique/article/photo.jpg", adresse_vignette: "https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/boutique/article/vignette.webp" }] };
  const profile = { maybeSingle: vi.fn().mockResolvedValue({ data: { boutique_id: "boutique" }, error: null }), eq: vi.fn() };
  profile.eq.mockReturnValue(profile);
  const requete = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: article, error: null }), single: vi.fn().mockResolvedValue({ data: { id: "article" }, error: null }) };
  requete.eq.mockReturnValue(requete); requete.select.mockReturnValue(requete);
  const update = vi.fn().mockReturnValue(requete), suppression = vi.fn().mockReturnValue(requete), upsert = vi.fn().mockResolvedValue({ error: null });
  const list = vi.fn().mockResolvedValue({ data: [{ name: "photo.jpg" }, { name: "vignette.webp" }], error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "compte" } }, error: null });
  const client = { auth: { getUser }, from: vi.fn((table: string) => table === "profils" ? { select: () => profile } : table === "tailles" ? { upsert } : { select: () => requete, update, delete: suppression }), storage: { from: vi.fn().mockReturnValue({ list, remove }) } } as unknown as SupabaseClient<Database>;
  return { client, profile, requete, update, suppression, upsert, list, remove, getUser };
}
const saisie = { titre: "Polo", categorie: "T-shirts et polos", genre: "homme", couleur: "", description: "", prix: "3500", tailles: ["S"], photos: [] };

describe("US-11 : gestion de mes articles", () => {
  it.each([2999, 3000])("refuse un prix %s qui n’est pas supérieur à la promo", prix => { expect(() => verifierPrixAvecPromo(prix, { prix_promo: 3000 })).toThrow("Le prix doit rester supérieur au prix promo, ou arrêtez d'abord la promo"); });
  it("autorise un prix supérieur à la promo ou un article sans promo", () => { expect(() => verifierPrixAvecPromo(3001, { prix_promo: 3000 })).not.toThrow(); expect(() => verifierPrixAvecPromo(1000, null)).not.toThrow(); });
  it("refuse une baisse incompatible avant toute écriture d’article ou de tailles", async () => { const test = simulation(); test.requete.maybeSingle.mockResolvedValue({ data: { id: "article", boutique_id: "boutique", tailles: [], photos: [], promos: { prix_promo: 3000 } }, error: null }); await expect(modifierArticle(test.client, "article", { ...saisie, prix: "2500" }, [{ libelle: "S", disponible: true }])).rejects.toThrow("supérieur au prix promo"); expect(test.update).not.toHaveBeenCalled(); expect(test.upsert).not.toHaveBeenCalled(); });
  it("US-15 : modifie ou efface description_ar en confirmant l’article", async () => { const test = simulation(); await modifierArticle(test.client, "article", { ...saisie, descriptionAr: "قميص أزرق\nأكمام قصيرة." }, [{ libelle: "S", disponible: true }]); expect(test.update).toHaveBeenCalledWith(expect.objectContaining({ description_ar: "قميص أزرق\nأكمام قصيرة.", derniere_confirmation: expect.any(String) })); await modifierArticle(test.client, "article", { ...saisie, descriptionAr: "" }, [{ libelle: "S", disponible: true }]); expect(test.update).toHaveBeenLastCalledWith(expect.objectContaining({ description_ar: null })); });
  it("date toute modification sans altérer les données", () => {
    expect(confirmerModification({ statut: "vendu" }, new Date("2026-10-09T10:00:00Z"))).toEqual({ statut: "vendu", derniere_confirmation: "2026-10-09T10:00:00.000Z" });
    expect(confirmerModification({ titre: "Polo" }, new Date("2026-10-10T12:00:00Z")).derniere_confirmation).toBe("2026-10-10T12:00:00.000Z");
  });
  it("conserve les tailles retirées et normalise les nouvelles", () => {
    expect(preparerTailles("article", [{ libelle: "S", disponible: true }, { libelle: "M", disponible: true }], [{ libelle: "s", disponible: false }, { libelle: " 42 ", disponible: true }])).toEqual([{ article_id: "article", libelle: "S", disponible: false }, { article_id: "article", libelle: "M", disponible: false }, { article_id: "article", libelle: "42", disponible: true }]);
  });
  it.each(["disponible", "reserve", "vendu", "masque"] as const)("change le statut %s et confirme l’article de ma boutique", async statut => {
    const test = simulation(); await changerStatut(test.client, "article", statut);
    expect(test.profile.eq).toHaveBeenCalledWith("id", "compte"); expect(test.requete.eq).toHaveBeenCalledWith("boutique_id", "boutique");
    expect(test.update).toHaveBeenCalledWith({ statut, derniere_confirmation: expect.any(String) });
  });
  it.each(["disponible", "reserve", "vendu", "masque"] as const)("refuse le statut %s sur un article masqué par la modération, avant toute écriture", async statut => {
    const test = simulation(); test.requete.maybeSingle.mockResolvedValue({ data: { id: "article", boutique_id: "boutique", statut: "masque", masque_par_moderation: true, photos: [], tailles: [], promos: null }, error: null });
    await expect(changerStatut(test.client, "article", statut)).rejects.toThrow(MASQUE_PAR_MODERATION); expect(test.update).not.toHaveBeenCalled();
  });
  it("refuse un article absent de ma boutique avant toute écriture", async () => {
    const test = simulation(); test.requete.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(changerStatut(test.client, "autre", "vendu")).rejects.toThrow("introuvable"); await expect(supprimerArticle(test.client, "autre")).rejects.toThrow("introuvable");
    expect(test.update).not.toHaveBeenCalled(); expect(test.remove).not.toHaveBeenCalled();
  });
  it("réutilise la validation avant toute écriture", async () => {
    const test = simulation(); await expect(modifierArticle(test.client, "article", { ...saisie, prix: "2.5" }, [{ libelle: "S", disponible: true }])).rejects.toThrow("champs"); expect(test.update).not.toHaveBeenCalled();
  });
  it("enregistre les champs, les tailles vendues et la date de confirmation", async () => {
    const test = simulation(); await modifierArticle(test.client, "article", saisie, [{ libelle: "S", disponible: false }]);
    expect(test.update).toHaveBeenCalledWith(expect.objectContaining({ titre: "Polo", prix: 3500, derniere_confirmation: expect.any(String) }));
    expect(test.upsert).toHaveBeenCalledWith([{ article_id: "article", libelle: "S", disponible: false }, { article_id: "article", libelle: "M", disponible: false }], { onConflict: "article_id,libelle" });
  });
  it("n’annonce pas un succès si les tailles échouent", async () => {
    const test = simulation(); test.upsert.mockResolvedValue({ error: { message: "Réseau" } }); await expect(modifierArticle(test.client, "article", saisie, [{ libelle: "S", disponible: true }])).rejects.toThrow("mais pas les tailles");
  });
  it("supprime les photos du seul dossier autorisé avant l’article", async () => {
    const test = simulation(); await supprimerArticle(test.client, "article"); expect(test.list).not.toHaveBeenCalled();
    expect(test.remove).toHaveBeenCalledWith(["boutique/article/photo.jpg", "boutique/article/vignette.webp"]); expect(test.remove.mock.invocationCallOrder[0]).toBeLessThan(test.suppression.mock.invocationCallOrder[0]);
    expect(test.requete.eq).toHaveBeenCalledWith("boutique_id", "boutique");
  });
  it("conserve l’article quand la suppression des photos échoue", async () => {
    const test = simulation(); test.remove.mockResolvedValue({ error: { message: "Réseau" } }); await expect(supprimerArticle(test.client, "article")).rejects.toThrow("conservé"); expect(test.suppression).not.toHaveBeenCalled();
  });
  it("signale une suppression partielle et permet de réessayer", async () => {
    const test = simulation(); test.requete.single.mockResolvedValue({ data: null, error: { message: "Réseau" } }); await expect(supprimerArticle(test.client, "article")).rejects.toThrow("photos ont été supprimées");
  });
  it("extrait seulement les chemins des photos appartenant à cet article", () => {
    const prefixe = "https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/";
    expect(cheminPhotoArticle(prefixe + "boutique/article/photo%20une.jpg", "boutique", "article")).toBe("boutique/article/photo une.jpg");
    expect(cheminPhotoArticle("https://placehold.co/400x500", "boutique", "article")).toBeNull();
    expect(() => cheminPhotoArticle(prefixe + "autre/article/photo.jpg", "boutique", "article")).toThrow("n’appartient pas");
    expect(() => cheminPhotoArticle(prefixe + "boutique/autre/photo.jpg", "boutique", "article")).toThrow("n’appartient pas");
  });
});

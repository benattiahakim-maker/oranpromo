import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { publierArticle } from "./publication-article";
import type { SaisieArticle } from "./article";

const fichiers = [new File(["photo"], "photo.jpg", { type: "image/jpeg" })];
const saisie: SaisieArticle = { titre: "Polo bleu", categorie: "T-shirts et polos", genre: "homme", couleur: "", description: "", prix: "3500", tailles: ["M", "m", "L"], photos: fichiers };

function clientTest() {
  const ordre: string[] = [];
  const upload = vi.fn().mockImplementation(async () => { ordre.push("upload"); return { error: null }; });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const supprimer = vi.fn().mockResolvedValue({ error: null });
  const filtreBoutique = vi.fn(() => supprimer());
  const filtreArticle = vi.fn(() => ({ eq: filtreBoutique }));
  const insertions = {
    articles: vi.fn().mockImplementation(async () => { ordre.push("articles"); return { error: null }; }),
    photos: vi.fn().mockImplementation(async () => { ordre.push("photos"); return { error: null }; }),
    tailles: vi.fn().mockImplementation(async () => { ordre.push("tailles"); return { error: null }; }),
  };
  const storage = { upload, remove, getPublicUrl: (chemin: string) => ({ data: { publicUrl: `https://iloyliuzsflzbkhpvxjt.supabase.co/storage/v1/object/public/photos/${chemin}` } }) };
  const client = { from: (table: keyof typeof insertions) => ({ insert: insertions[table], delete: () => ({ eq: filtreArticle }) }), storage: { from: vi.fn(() => storage) } } as unknown as SupabaseClient<Database>;
  const compression = vi.fn().mockImplementation(async () => { ordre.push("compression"); return new Blob(["jpeg"], { type: "image/jpeg" }); });
  return { client, ordre, upload, remove, supprimer, filtreArticle, filtreBoutique, insertions, compression };
}

describe("US-10 : publication et nettoyage", () => {
  it("US-15 : publie le texte arabe dans la seule colonne description_ar", async () => { const test = clientTest(); await publierArticle(test.client, "boutique", { ...saisie, descriptionAr: "قميص أزرق\nأكمام قصيرة." }, fichiers, test.compression); expect(test.insertions.articles).toHaveBeenCalledWith(expect.objectContaining({ description_ar: "قميص أزرق\nأكمام قصيرة." })); expect(test.insertions.articles.mock.calls[0][0]).not.toHaveProperty("titre_ar"); });
  it("US-14 : enregistre l’origine IA seulement lors de la publication validée", async () => { const test = clientTest(); await publierArticle(test.client, "boutique", saisie, fichiers, test.compression, true); expect(test.insertions.articles).toHaveBeenCalledWith(expect.objectContaining({ propose_par_ia: true })); });
  it("compresse, envoie puis crée l’article, les photos et les tailles dans cet ordre", async () => {
    const test = clientTest();
    const id = await publierArticle(test.client, "boutique", saisie, fichiers, test.compression);
    expect(test.ordre).toEqual(["compression", "upload", "articles", "photos", "tailles"]);
    const chemin = test.upload.mock.calls[0][0] as string;
    expect(chemin).toMatch(new RegExp(`^boutique/${id}/[a-f0-9-]+\\.jpg$`));
    expect(test.upload.mock.calls[0][2]).toEqual({ contentType: "image/jpeg", upsert: false });
    expect(test.insertions.articles).toHaveBeenCalledWith(expect.objectContaining({ id, boutique_id: "boutique", statut: "disponible", prix: 3500, propose_par_ia: false }));
    expect(test.insertions.photos).toHaveBeenCalledWith([{ article_id: id, adresse: expect.stringContaining(chemin), adresse_vignette: null, ordre: 0 }]);
    expect(test.insertions.tailles).toHaveBeenCalledWith([{ article_id: id, libelle: "M", disponible: true }, { article_id: id, libelle: "L", disponible: true }]);
    expect(test.remove).not.toHaveBeenCalled();
  });
  it("envoie la miniature dans le même dossier et la range dans adresse_vignette", async () => {
    const test = clientTest();
    const vignette = new Blob(["mini"], { type: "image/jpeg" });
    test.compression.mockImplementation(async () => ({ photo: new Blob(["jpeg"], { type: "image/jpeg" }), vignette }));
    const id = await publierArticle(test.client, "boutique", saisie, fichiers, test.compression);
    const [photo, mini] = test.upload.mock.calls.map(appel => appel[0] as string);
    expect(mini).toMatch(new RegExp(`^boutique/${id}/[a-f0-9-]+-vignette\\.jpg$`));
    expect(test.upload.mock.calls[1][1]).toBe(vignette);
    // Même modèle que la règle de la base prive.verifier_adresse_photo().
    const modele = new RegExp(`^https://iloyliuzsflzbkhpvxjt\\.supabase\\.co/storage/v1/object/public/photos/boutique/${id}/[A-Za-z0-9_-]+(\\.[A-Za-z0-9]+)?$`);
    const ligne = test.insertions.photos.mock.calls[0][0][0];
    expect(ligne).toEqual({ article_id: id, adresse: expect.stringContaining(photo), adresse_vignette: expect.stringContaining(mini), ordre: 0 });
    expect(ligne.adresse).toMatch(modele); expect(ligne.adresse_vignette).toMatch(modele);
  });
  it("refuse une miniature trop lourde avant tout envoi", async () => {
    const test = clientTest();
    test.compression.mockImplementation(async () => ({ photo: new Blob(["jpeg"], { type: "image/jpeg" }), vignette: new Blob([new Uint8Array(151 * 1024)], { type: "image/jpeg" }) }));
    await expect(publierArticle(test.client, "boutique", saisie, fichiers, test.compression)).rejects.toThrow("miniature");
    expect(test.upload).not.toHaveBeenCalled();
  });
  it("annule les fichiers d’un envoi interrompu avant toute création d’article", async () => {
    const test = clientTest();
    test.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "Échec" } });
    await expect(publierArticle(test.client, "boutique", saisie, [...fichiers, ...fichiers], test.compression)).rejects.toThrow("Impossible d’envoyer les photos");
    expect(test.remove).toHaveBeenCalledWith(test.upload.mock.calls.map(call => call[0]));
    expect(test.insertions.articles).not.toHaveBeenCalled();
    expect(test.supprimer).not.toHaveBeenCalled();
  });
  it.each(["articles", "photos", "tailles"] as const)("nettoie l’article et les fichiers après l’échec de %s", async table => {
    const test = clientTest();
    test.insertions[table].mockResolvedValue({ error: { message: "Échec" } });
    await expect(publierArticle(test.client, "boutique", saisie, fichiers, test.compression)).rejects.toThrow("Aucun article n’a été publié");
    expect(test.filtreArticle).toHaveBeenCalledWith("id", expect.any(String));
    expect(test.filtreBoutique).toHaveBeenCalledWith("boutique_id", "boutique");
    expect(test.supprimer).toHaveBeenCalled();
    expect(test.remove).toHaveBeenCalledWith([test.upload.mock.calls[0][0]]);
  });
  it("tente le nettoyage du stockage même si celui de la base échoue", async () => {
    const test = clientTest();
    test.insertions.tailles.mockRejectedValue(new Error("Réseau"));
    test.supprimer.mockRejectedValue(new Error("Réseau"));
    await expect(publierArticle(test.client, "boutique", saisie, fichiers, test.compression)).rejects.toThrow("Le nettoyage n’a pas pu être terminé");
    expect(test.remove).toHaveBeenCalled();
  });
  it("n’envoie rien si la validation ou la compression échoue", async () => {
    const test = clientTest();
    await expect(publierArticle(test.client, "boutique", { ...saisie, titre: "" }, fichiers, test.compression)).rejects.toThrow("Vérifiez les champs");
    expect(test.compression).not.toHaveBeenCalled();
    test.compression.mockRejectedValue(new Error("Photo illisible"));
    await expect(publierArticle(test.client, "boutique", saisie, fichiers, test.compression)).rejects.toThrow("Photo illisible");
    expect(test.upload).not.toHaveBeenCalled();
  });
});

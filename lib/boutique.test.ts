import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { slugValide } from "./lien-boutique";
import { changerStatutBoutique, creerBoutique, filtreBoutiques, listerBoutiques, normaliserWhatsAppAlgerien, rattacherCommercant, roleAdministration, slugBoutique, validerBoutique } from "./boutique";
const saisie = { nom: "Boutique Étoile", quartier: "Akid Lotfi", adresse: "12 rue des Oliviers", latitude: "", longitude: "", horaires: "", whatsapp: "0555 12 34 56", instagram: "", facebook: "" };

describe("US-16 : validation boutique", () => {
  it("génère un slug minuscule sans accents ni espaces", () => { expect(slugBoutique("  L’Étoile & Cœur d’Oran  ")).toBe("l-etoile-coeur-d-oran"); expect(slugBoutique("متجر")).toBe("boutique"); });
  it.each(["0555 12 34 56", "+213 555 12 34 56", "00213 555123456", "213555123456"])("normalise le numéro %s", telephone => { expect(normaliserWhatsAppAlgerien(telephone)).toBe("+213555123456"); });
  it.each(["", "+33612345678", "0555abc123456", "+2130555123456", "0555123"])("refuse le numéro invalide %s", telephone => { expect(normaliserWhatsAppAlgerien(telephone)).toBeNull(); });
  it("accepte les champs facultatifs vides et signale les obligatoires", () => {
    expect(validerBoutique(saisie)).toEqual({}); expect(Object.keys(validerBoutique({ ...saisie, nom: "A", quartier: "", adresse: "", whatsapp: "" })).sort()).toEqual(["adresse", "nom", "quartier", "whatsapp"]);
  });
  it("valide les coordonnées et exige une paire cohérente", () => {
    expect(validerBoutique({ ...saisie, latitude: "35,7", longitude: "-0,6" })).toEqual({}); expect(validerBoutique({ ...saisie, latitude: "91", longitude: "181" })).toHaveProperty("latitude"); expect(validerBoutique({ ...saisie, latitude: "0" })).toHaveProperty("longitude");
  });
  it("refuse les liens dangereux ou d’un autre réseau", () => {
    expect(validerBoutique({ ...saisie, instagram: "javascript:alert(1)", facebook: "https://example.com" })).toMatchObject({ instagram: expect.any(String), facebook: expect.any(String) });
    expect(validerBoutique({ ...saisie, instagram: "https://www.instagram.com/boutique", facebook: "https://www.facebook.com/boutique" })).toEqual({});
  });
  it("autorise les deux rôles et le filtre d’attente par défaut pour l’ambassadeur", () => { expect(roleAdministration("admin")).toBe(true); expect(roleAdministration("ambassadeur")).toBe(true); expect(roleAdministration("commercant")).toBe(false); expect(filtreBoutiques(undefined, "ambassadeur")).toBe("en_attente"); expect(filtreBoutiques(undefined, "admin")).toBeNull(); expect(filtreBoutiques("suspendue", "admin")).toBe("suspendue"); });
});
function simulation(role = "admin") {
  const profil = { maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null }), eq: vi.fn() }; profil.eq.mockReturnValue(profil);
  const single = vi.fn().mockResolvedValue({ data: { id: "boutique", statut: "en_attente" }, error: null });
  const requete = { eq: vi.fn(), select: vi.fn(), single, order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) }; for (const methode of [requete.eq, requete.select, requete.order]) methode.mockReturnValue(requete);
  const insert = vi.fn().mockReturnValue(requete), update = vi.fn().mockReturnValue(requete), rpc = vi.fn().mockResolvedValue({ error: null });
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "compte" } }, error: null }) }, from: vi.fn((table: string) => table === "profils" ? { select: () => profil } : { insert, update, select: () => requete }), rpc } as unknown as SupabaseClient<Database>;
  return { client, profil, requete, single, insert, update, rpc };
}
describe("US-16 : opérations soumises aux rôles", () => {
  it("crée une boutique en attente avec un slug unique et un numéro normalisé", async () => {
    const test = simulation("ambassadeur"); await creerBoutique(test.client, saisie); expect(test.profil.eq).toHaveBeenCalledWith("id", "compte"); expect(test.insert).toHaveBeenCalledWith(expect.objectContaining({ slug: "boutique-etoile", statut: "en_attente", whatsapp: "+213555123456", latitude: null }));
  });
  it("réessaie un conflit de slug avec un nouveau suffixe", async () => { const test = simulation(); test.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } }); await creerBoutique(test.client, saisie); expect(test.insert).toHaveBeenCalledTimes(2); expect(test.insert.mock.calls[0][0].slug).not.toBe(test.insert.mock.calls[1][0].slug); });
  it("US-22 : essaie nom, nom-2 … nom-9 puis un suffixe aléatoire, toujours au format de la base", async () => {
    const test = simulation(); for (let i = 0; i < 10; i++) test.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    await creerBoutique(test.client, saisie);
    const slugs = test.insert.mock.calls.map(appel => appel[0].slug as string);
    expect(slugs.slice(0, 9)).toEqual(["boutique-etoile", ...[2, 3, 4, 5, 6, 7, 8, 9].map(n => `boutique-etoile-${n}`)]);
    expect(slugs[9]).toMatch(/^boutique-etoile-[0-9a-f]{6}$/); expect(slugs[10]).toMatch(/^boutique-etoile-[0-9a-f]{6}$/);
    expect(slugs.every(slugValide)).toBe(true);
  });
  it("US-22 : un nom très long donne un slug valide de 60 caractères au plus", async () => {
    const test = simulation(); test.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    await creerBoutique(test.client, { ...saisie, nom: "La Très Grande Maison de la Mode Oranaise du Front de Mer 2026" });
    const slugs = test.insert.mock.calls.map(appel => appel[0].slug as string);
    expect(slugs.every(slugValide)).toBe(true); expect(slugs[1]).toMatch(/-2$/);
  });
  it("US-22 : abandonne après 11 conflits avec un message clair", async () => { const test = simulation(); test.single.mockResolvedValue({ data: null, error: { code: "23505" } }); await expect(creerBoutique(test.client, saisie)).rejects.toThrow("adresse unique"); expect(test.insert).toHaveBeenCalledTimes(11); });
  it("refuse un commerçant avant toute création", async () => { const test = simulation("commercant"); await expect(creerBoutique(test.client, saisie)).rejects.toThrow("Accès réservé"); expect(test.insert).not.toHaveBeenCalled(); });
  it("refuse un formulaire invalide avant insertion", async () => { const test = simulation(); await expect(creerBoutique(test.client, { ...saisie, nom: "" })).rejects.toThrow("champs"); expect(test.insert).not.toHaveBeenCalled(); });
  it("refuse statut et RPC à un ambassadeur même hors interface", async () => { const test = simulation("ambassadeur"); await expect(changerStatutBoutique(test.client, "boutique", "validee")).rejects.toThrow("administrateurs"); await expect(rattacherCommercant(test.client, "boutique", "vendeur@example.com")).rejects.toThrow("administrateurs"); expect(test.update).not.toHaveBeenCalled(); expect(test.rpc).not.toHaveBeenCalled(); });
  it.each(["validee", "suspendue"] as const)("permet à l’admin le statut %s", async statut => { const test = simulation(); await changerStatutBoutique(test.client, "boutique", statut); expect(test.update).toHaveBeenCalledWith({ statut }); expect(test.requete.eq).toHaveBeenCalledWith("id", "boutique"); });
  it("rattache par la RPC existante et transmet les erreurs françaises de la base", async () => {
    const test = simulation(); await rattacherCommercant(test.client, "boutique", " vendeur@example.com "); expect(test.rpc).toHaveBeenCalledWith("rattacher_commercant", { email_commercant: "vendeur@example.com", boutique: "boutique" });
    test.rpc.mockResolvedValue({ error: { message: "Le commerçant doit d’abord se connecter une fois." } }); await expect(rattacherCommercant(test.client, "boutique", "vendeur@example.com")).rejects.toThrow("se connecter une fois");
  });
  it("refuse un e-mail invalide sans appeler la RPC", async () => { const test = simulation(); await expect(rattacherCommercant(test.client, "boutique", "abc")).rejects.toThrow("e-mail valide"); expect(test.rpc).not.toHaveBeenCalled(); });
  it("lit la liste avec les attentes en premier et applique le filtre", async () => { const test = simulation(); await listerBoutiques(test.client, "en_attente"); expect(test.requete.order.mock.calls[0]).toEqual(["statut", { ascending: true }]); expect(test.requete.eq).toHaveBeenCalledWith("statut", "en_attente"); });
});

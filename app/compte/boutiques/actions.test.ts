import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  rpc: vi.fn(), getUser: vi.fn(), maybeSingle: vi.fn(), set: vi.fn(), supprimer: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  cookie: undefined as string | undefined, inscription: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (nom: string) => (nom === "suivre_boutique" && etat.cookie ? { value: etat.cookie } : nom === "inscription_boutique" && etat.inscription ? { value: etat.inscription } : undefined), set: etat.set, delete: etat.supprimer }) }));
vi.mock("next/navigation", () => ({ redirect: etat.redirect }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({
  rpc: etat.rpc, auth: { getUser: etat.getUser },
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: etat.maybeSingle }) }) }) }),
}) }));
import { nePlusSuivre, rattacherInscription, seConnecterPourSuivre, suivreApresConnexion, suivreBoutique } from "./actions";

const ID = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); etat.cookie = undefined; etat.inscription = undefined;
  etat.getUser.mockResolvedValue({ data: { user: { id: "client" } } });
  etat.rpc.mockResolvedValue({ data: true, error: null });
  etat.maybeSingle.mockResolvedValue({ data: { id: ID }, error: null });
});

describe("US-31.2 : suivre une boutique", () => {
  it("suivre : appelle la base avec l'identifiant", async () => {
    expect(await suivreBoutique(ID)).toEqual({ succes: true, suivie: true });
    expect(etat.rpc).toHaveBeenCalledWith("suivre_boutique", { boutique: ID });
  });
  it("visiteur : demande de connexion, sans appel à la base ; identifiant invalide refusé", async () => {
    etat.getUser.mockResolvedValue({ data: { user: null } });
    expect(await suivreBoutique(ID)).toEqual({ succes: false, suivie: false, erreur: "connexion" });
    expect(await suivreBoutique("pas-un-uuid")).toMatchObject({ succes: false, erreur: "introuvable" });
    expect(etat.rpc).not.toHaveBeenCalled();
  });
  it("erreurs de la base traduites en clé de texte (plafond, boutique, commerçant)", async () => {
    etat.rpc.mockResolvedValueOnce({ data: null, error: { code: "54000" } });
    expect(await suivreBoutique(ID)).toMatchObject({ succes: false, erreur: "plafond" });
    etat.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002" } });
    expect(await suivreBoutique(ID)).toMatchObject({ erreur: "introuvable" });
    etat.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await suivreBoutique(ID)).toMatchObject({ erreur: "reserve" });
  });
  it("ne plus suivre", async () => {
    expect(await nePlusSuivre(ID)).toEqual({ succes: true, suivie: false });
    expect(etat.rpc).toHaveBeenCalledWith("ne_plus_suivre", { boutique: ID });
  });
  it("sans être connecté : cookie court httpOnly puis connexion client avec retour sur la vitrine", async () => {
    await expect(seConnecterPourSuivre("chez-amine")).rejects.toThrow("REDIRECT:/compte/connexion?suite=%2Fb%2Fchez-amine");
    expect(etat.set).toHaveBeenCalledWith("suivre_boutique", "chez-amine", expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 3600, path: "/" }));
    etat.set.mockClear();
    await expect(seConnecterPourSuivre("../x")).rejects.toThrow("REDIRECT:/compte/connexion");
    expect(etat.set).not.toHaveBeenCalled();
  });
  it("après connexion : suit seulement si le cookie désigne cette vitrine, puis l'efface", async () => {
    expect(await suivreApresConnexion("chez-amine")).toEqual({ succes: false, suivie: false });
    etat.cookie = "autre-boutique";
    expect(await suivreApresConnexion("chez-amine")).toEqual({ succes: false, suivie: false });
    expect(etat.rpc).not.toHaveBeenCalled();
    etat.cookie = "chez-amine";
    expect(await suivreApresConnexion("chez-amine")).toEqual({ succes: true, suivie: true });
    expect(etat.supprimer).toHaveBeenCalledWith("suivre_boutique");
    expect(etat.rpc).toHaveBeenCalledWith("suivre_boutique", { boutique: ID });
  });
  it("après connexion : boutique devenue invisible → cookie effacé, rien suivi", async () => {
    etat.cookie = "chez-amine";
    etat.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await suivreApresConnexion("chez-amine")).toMatchObject({ succes: false, erreur: "introuvable" });
    expect(etat.supprimer).toHaveBeenCalled();
    expect(etat.rpc).not.toHaveBeenCalled();
  });

  it("US-31.3 : affiche scannée puis connexion → rattacher_inscription, seulement pour la vitrine du cookie, cookie effacé", async () => {
    expect(await rattacherInscription("chez-amine")).toEqual({ succes: false, suivie: false });
    etat.inscription = "autre-boutique";
    expect(await rattacherInscription("chez-amine")).toEqual({ succes: false, suivie: false });
    expect(etat.rpc).not.toHaveBeenCalled();
    etat.inscription = "chez-amine";
    etat.rpc.mockResolvedValue({ data: { suivie_nouvelle: true, rattache: true }, error: null });
    expect(await rattacherInscription("chez-amine")).toEqual({ succes: true, suivie: true, rattache: true });
    expect(etat.rpc).toHaveBeenCalledWith("rattacher_inscription", { slug_boutique: "chez-amine" });
    expect(etat.supprimer).toHaveBeenCalledWith("inscription_boutique");
  });
  it("US-31.3 : sans session, rien n'est appelé et le cookie reste ; erreur de la base → clé de texte", async () => {
    etat.inscription = "chez-amine";
    etat.getUser.mockResolvedValue({ data: { user: null } });
    expect(await rattacherInscription("chez-amine")).toMatchObject({ succes: false, erreur: "connexion" });
    expect(etat.supprimer).not.toHaveBeenCalled();
    etat.getUser.mockResolvedValue({ data: { user: { id: "commercant" } } });
    etat.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await rattacherInscription("chez-amine")).toMatchObject({ succes: false, erreur: "reserve" });
  });
});

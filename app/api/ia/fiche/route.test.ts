// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { BOUTIQUE_NON_VALIDEE, QUOTA_IA_ATTEINT } from "@/lib/acces-ia";
import { IA_INDISPONIBLE, PHOTO_A_REPRENDRE } from "@/lib/ia-fiche";
const { creer, construire, getUser, profil, boutique, quota } = vi.hoisted(() => ({ creer: vi.fn(), construire: vi.fn(), getUser: vi.fn(), profil: vi.fn(), boutique: vi.fn(), quota: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: creer }; constructor(options: unknown) { construire(options); } } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === "profils" ? profil : boutique }) }) }), rpc: quota }) }));
const fiche = { estVetement: true, nette: true, titre: "Polo bleu", description: "Polo bleu à manches courtes.", categorie: "Polos", genre: "homme", couleur: "bleu" };
const resultat = (valeur: unknown = fiche) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(valeur) }] });
function demande(photos = [new File([new Uint8Array([255, 216, 255, 217])], "photo.jpg", { type: "image/jpeg" })]) {
  const body = new FormData(); photos.forEach(photo => body.append("photo", photo));
  return new Request("http://localhost/api/ia/fiche", { method: "POST", body });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ANTHROPIC_API_KEY", "cle-factice-tests"); vi.stubEnv("ANTHROPIC_MODELE", ""); getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null }); profil.mockResolvedValue({ data: { boutique_id: "boutique" }, error: null }); boutique.mockResolvedValue({ data: { statut: "validee" }, error: null }); quota.mockResolvedValue({ data: true, error: null }); creer.mockResolvedValue(resultat()); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("POST fiche IA, API entièrement simulée", () => {
  it("sans clé : répond exactement 503 et ne construit jamais de client Claude", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const reponse = await POST(demande());
    expect(reponse.status).toBe(503); expect(await reponse.json()).toEqual({ message: IA_INDISPONIBLE });
    expect(construire).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled();
  });
  it.each([401, 403])("refuse l’accès avec statut %s avant l’appel IA", async statut => {
    if (statut === 401) getUser.mockResolvedValue({ data: { user: null }, error: null }); else profil.mockResolvedValue({ data: { boutique_id: null }, error: null });
    expect((await POST(demande())).status).toBe(statut); expect(creer).not.toHaveBeenCalled();
  });
  it("transmet un seul JPEG, impose le JSON strict et le modèle par défaut, sans retries", async () => {
    const reponse = await POST(demande()); expect(reponse.status).toBe(200);
    expect((await reponse.json()).fiche.titre).toBe("Polo bleu");
    expect(construire).toHaveBeenCalledWith({ apiKey: "cle-factice-tests", timeout: 15000, maxRetries: 0 });
    const parametres = creer.mock.calls[0][0];
    expect(parametres.model).toBe("claude-haiku-5-5");
    expect(parametres.output_config.format.schema.additionalProperties).toBe(false);
    expect(parametres.messages[0].content[0].source.media_type).toBe("image/jpeg");
    expect(parametres.system).toContain("aucun prix ni aucune taille");
  });
  it("respecte le modèle configuré", async () => { vi.stubEnv("ANTHROPIC_MODELE", "modele-test"); await POST(demande()); expect(creer.mock.calls[0][0].model).toBe("modele-test"); });
  it.each([{ photos: [] }, { photos: [new File(["png"], "p.png", { type: "image/png" })] }, { photos: [new File(["pas un jpeg"], "p.jpg", { type: "image/jpeg" })] }])("refuse une photo absente ou invalide", async ({ photos }) => { expect((await POST(demande(photos))).status).toBe(400); expect(creer).not.toHaveBeenCalled(); });
  it("refuse plusieurs photos et une photo supérieure à 5 Mo", async () => {
    const photo = new File([new Uint8Array([255, 216, 255])], "p.jpg", { type: "image/jpeg" });
    expect((await POST(demande([photo, photo]))).status).toBe(400);
    expect((await POST(demande([new File([new Uint8Array(5 * 1024 * 1024 + 1)], "p.jpg", { type: "image/jpeg" })]))).status).toBe(413);
    expect(creer).not.toHaveBeenCalled();
  });
  it("renvoie la demande de nouvelle photo sans fiche", async () => { creer.mockResolvedValue(resultat({ ...fiche, nette: false })); const reponse = await POST(demande()); expect(reponse.status).toBe(422); expect(await reponse.json()).toEqual({ message: PHOTO_A_REPRENDRE }); });
  it.each(["erreur", "json", "categorie"])("répond 503 pour %s sans révéler de détail technique", async cas => {
    if (cas === "erreur") creer.mockRejectedValue(new Error("information confidentielle"));
    if (cas === "json") creer.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "pas du JSON" }] });
    if (cas === "categorie") creer.mockResolvedValue(resultat({ ...fiche, categorie: "autre" }));
    const reponse = await POST(demande()); expect(reponse.status).toBe(503); expect(await reponse.json()).toEqual({ message: IA_INDISPONIBLE });
  });
  it("interrompt à 15 secondes même si l’appel simulé reste bloqué", async () => {
    vi.useFakeTimers(); creer.mockImplementation(() => new Promise(() => {}));
    const reponsePromise = POST(demande()); await vi.waitFor(() => expect(creer).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(15000); const reponse = await reponsePromise;
    expect(reponse.status).toBe(503); expect(creer.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it.each(["en_attente", "suspendue", null])("refuse une boutique %s (non validée) avant le quota et l’appel IA", async statut => { boutique.mockResolvedValue({ data: statut ? { statut } : null, error: null }); const r = await POST(demande()); expect(r.status).toBe(403); expect(await r.json()).toEqual({ message: BOUTIQUE_NON_VALIDEE }); expect(quota).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled(); });
  it("consomme le quota une fois par appel autorisé", async () => { expect((await POST(demande())).status).toBe(200); expect(quota).toHaveBeenCalledTimes(1); expect(quota).toHaveBeenCalledWith("consommer_quota_ia"); });
  it("répond 429 quand le quota est atteint, sans appeler l’IA", async () => { quota.mockResolvedValue({ data: false, error: null }); const r = await POST(demande()); expect(r.status).toBe(429); expect(await r.json()).toEqual({ message: QUOTA_IA_ATTEINT }); expect(construire).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled(); });
  it("répond 503 si le quota ne peut pas être vérifié", async () => { quota.mockResolvedValue({ data: null, error: { message: "erreur" } }); const r = await POST(demande()); expect(r.status).toBe(503); expect(await r.json()).toEqual({ message: IA_INDISPONIBLE }); expect(creer).not.toHaveBeenCalled(); });
  it("refuse un envoi sans Content-Length qui dépasse 5 Mo, avant l’analyse et l’appel IA", async () => {
    const morceau = new Uint8Array(1024 * 1024);
    const flux = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(morceau); } });
    const r = await POST(new Request("http://localhost/api/ia/fiche", { method: "POST", body: flux, headers: { "content-type": "multipart/form-data; boundary=x" }, duplex: "half" } as RequestInit));
    expect(r.status).toBe(413); expect(quota).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled();
  });
});

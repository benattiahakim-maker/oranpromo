// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { BOUTIQUE_NON_VALIDEE, QUOTA_IA_ATTEINT } from "@/lib/acces-ia";
import { TRADUCTION_INDISPONIBLE } from "@/lib/ia-traduction";
const { creer, construire, getUser, profil, boutique, quota } = vi.hoisted(() => ({ creer: vi.fn(), construire: vi.fn(), getUser: vi.fn(), profil: vi.fn(), boutique: vi.fn(), quota: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: creer }; constructor(options: unknown) { construire(options); } } }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { getUser }, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === "profils" ? profil : boutique }) }) }), rpc: quota }) }));
const traduction = { titreAr: "قميص أزرق", descriptionAr: "قميص بأكمام قصيرة." };
const resultat = (valeur: unknown = traduction) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(valeur) }] });
const demande = (valeur: unknown = { titre: "Polo bleu", description: "Polo à manches courtes." }) => new Request("http://localhost/api/ia/traduire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valeur) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ANTHROPIC_API_KEY", "cle-factice-test"); vi.stubEnv("ANTHROPIC_MODELE", ""); getUser.mockResolvedValue({ data: { user: { id: "compte" } }, error: null }); profil.mockResolvedValue({ data: { boutique_id: "boutique" }, error: null }); boutique.mockResolvedValue({ data: { statut: "validee" }, error: null }); quota.mockResolvedValue({ data: true, error: null }); creer.mockResolvedValue(resultat()); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("POST traduction : aucun appel API réel", () => {
  it("sans clé : renvoie 503 et le message exact sans construire le SDK", async () => { vi.stubEnv("ANTHROPIC_API_KEY", ""); const reponse = await POST(demande()); expect(reponse.status).toBe(503); expect(await reponse.json()).toEqual({ message: TRADUCTION_INDISPONIBLE }); expect(construire).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled(); });
  it.each([401, 403])("refuse l’accès avec statut %s", async statut => { if (statut === 401) getUser.mockResolvedValue({ data: { user: null }, error: null }); else profil.mockResolvedValue({ data: { boutique_id: null }, error: null }); expect((await POST(demande())).status).toBe(statut); expect(creer).not.toHaveBeenCalled(); });
  it("retourne le JSON arabe strict et utilise le modèle et le délai prévus", async () => {
    const reponse = await POST(demande()); expect(reponse.status).toBe(200); expect(await reponse.json()).toEqual(traduction);
    expect(construire).toHaveBeenCalledWith({ apiKey: "cle-factice-test", timeout: 15000, maxRetries: 0 });
    expect(creer.mock.calls[0][0].model).toBe("claude-haiku-5-5");
    expect(creer.mock.calls[0][0].output_config.format.schema.additionalProperties).toBe(false);
    expect(creer.mock.calls[0][0].system).toContain("N’ajoute aucune information");
  });
  it("utilise le modèle configuré", async () => { vi.stubEnv("ANTHROPIC_MODELE", "modele-simule"); await POST(demande()); expect(creer.mock.calls[0][0].model).toBe("modele-simule"); });
  it.each([{ titre: "" }, { titre: "x".repeat(121) }, { description: "x".repeat(1001) }])("refuse les longueurs incorrectes avant l’appel IA", async changement => { expect((await POST(demande({ titre: "Polo", description: "Bleu", ...changement }))).status).toBe(400); expect(creer).not.toHaveBeenCalled(); });
  it("refuse le JSON mal formé", async () => { const r = await POST(new Request("http://localhost/api/ia/traduire", { method: "POST", body: "{" })); expect(r.status).toBe(400); expect(creer).not.toHaveBeenCalled(); });
  it("n’ajoute aucune description si la source est vide", async () => { creer.mockResolvedValue(resultat({ ...traduction, descriptionAr: "" })); expect((await POST(demande({ titre: "Polo", description: "" }))).status).toBe(200); creer.mockResolvedValue(resultat()); expect((await POST(demande({ titre: "Polo", description: "" }))).status).toBe(503); });
  it.each(["api", "json", "arabe"])("renvoie 503 pour %s sans exposer l’erreur technique", async cas => { if (cas === "api") creer.mockRejectedValue(new Error("secret")); if (cas === "json") creer.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "non JSON" }] }); if (cas === "arabe") creer.mockResolvedValue(resultat({ titreAr: "Polo", descriptionAr: "Bleu" })); const r = await POST(demande()); expect(r.status).toBe(503); expect(await r.json()).toEqual({ message: TRADUCTION_INDISPONIBLE }); });
  it("interrompt un appel simulé bloqué après 15 secondes", async () => { vi.useFakeTimers(); creer.mockImplementation(() => new Promise(() => {})); const promesse = POST(demande()); await vi.waitFor(() => expect(creer).toHaveBeenCalled()); await vi.advanceTimersByTimeAsync(15000); expect((await promesse).status).toBe(503); expect(creer.mock.calls[0][1].signal.aborted).toBe(true); });
  it.each(["en_attente", "suspendue", null])("refuse une boutique %s (non validée) avant le quota et l’appel IA", async statut => { boutique.mockResolvedValue({ data: statut ? { statut } : null, error: null }); const r = await POST(demande()); expect(r.status).toBe(403); expect(await r.json()).toEqual({ message: BOUTIQUE_NON_VALIDEE }); expect(quota).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled(); });
  it("consomme le quota une fois par appel autorisé", async () => { expect((await POST(demande())).status).toBe(200); expect(quota).toHaveBeenCalledTimes(1); expect(quota).toHaveBeenCalledWith("consommer_quota_ia"); });
  it("répond 429 quand le quota est atteint, sans appeler l’IA", async () => { quota.mockResolvedValue({ data: false, error: null }); const r = await POST(demande()); expect(r.status).toBe(429); expect(await r.json()).toEqual({ message: QUOTA_IA_ATTEINT }); expect(construire).not.toHaveBeenCalled(); expect(creer).not.toHaveBeenCalled(); });
  it("répond 503 si le quota ne peut pas être vérifié", async () => { quota.mockResolvedValue({ data: null, error: { message: "erreur" } }); const r = await POST(demande()); expect(r.status).toBe(503); expect(await r.json()).toEqual({ message: TRADUCTION_INDISPONIBLE }); expect(creer).not.toHaveBeenCalled(); });
});

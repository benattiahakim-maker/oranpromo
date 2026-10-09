import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GET, maxDuration } from "./route";

const { envoyer, fournisseur } = vi.hoisted(() => ({ envoyer: vi.fn(), fournisseur: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesEnAttente: envoyer, fournisseurWhatsApp: fournisseur, LIMITE_TACHE: 5 }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
const SECRET = "un-secret-de-test-assez-long-123";
const appel = (autorisation?: string) => GET(new Request("http://localhost/api/notifications/whatsapp", { headers: autorisation ? { authorization: autorisation } : {} }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", SECRET); fournisseur.mockReturnValue({ nom: "meta", envoyer: vi.fn() }); envoyer.mockResolvedValue({ envoyes: 2, echecs: 0, traites: 2 }); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("tâche d’envoi WhatsApp (US-20.5)", () => {
  it("refuse sans le bon secret", async () => {
    expect((await appel()).status).toBe(401);
    expect((await appel("Bearer mauvais")).status).toBe(401);
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("503 si CRON_SECRET n’est pas configuré", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await appel(`Bearer ${SECRET}`)).status).toBe(503);
  });
  it("n’envoie rien si WhatsApp n’est pas configuré", async () => {
    fournisseur.mockReturnValue(null);
    const reponse = await appel(`Bearer ${SECRET}`);
    expect(reponse.status).toBe(200);
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("envoie les messages en attente avec le secret comme jeton", async () => {
    const reponse = await appel(`Bearer ${SECRET}`);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ envoyes: 2, echecs: 0, traites: 2 });
    expect(envoyer).toHaveBeenCalledWith({}, SECRET, expect.objectContaining({ nom: "meta" }), expect.objectContaining({ limite: 5 }));
  });
  it("relecture point 6 : 5 messages au plus et arrêt avant la limite de durée (pas de doublon)", async () => {
    const debut = Date.now();
    await appel(`Bearer ${SECRET}`);
    const options = envoyer.mock.calls[0][3] as { limite: number; finAvant: number };
    expect(options.limite * 10_000).toBeLessThan(maxDuration * 1000);
    expect(options.finAvant).toBeGreaterThanOrEqual(debut + 50_000);
    expect(options.finAvant).toBeLessThanOrEqual(Date.now() + maxDuration * 1000 - 5_000);
  });
  it("relecture point 7 : vercel.json appelle la tâche (Vercel Cron)", () => {
    const config = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };
    expect(config.crons).toContainEqual(expect.objectContaining({ path: "/api/notifications/whatsapp" }));
  });
  it("500 si la base refuse", async () => {
    envoyer.mockRejectedValue(new Error("Accès refusé."));
    expect((await appel(`Bearer ${SECRET}`)).status).toBe(500);
  });
});

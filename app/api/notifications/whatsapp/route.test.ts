import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { envoyer, fournisseur } = vi.hoisted(() => ({ envoyer: vi.fn(), fournisseur: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ envoyerMessagesEnAttente: envoyer, fournisseurWhatsApp: fournisseur }));
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
    expect(envoyer).toHaveBeenCalledWith({}, SECRET, expect.objectContaining({ nom: "meta" }));
  });
  it("500 si la base refuse", async () => {
    envoyer.mockRejectedValue(new Error("Accès refusé."));
    expect((await appel(`Bearer ${SECRET}`)).status).toBe(500);
  });
});

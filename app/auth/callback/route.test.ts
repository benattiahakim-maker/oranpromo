import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({ auth: { exchangeCodeForSession } }) }));
beforeEach(() => { exchangeCodeForSession.mockReset(); });

describe("US-09 : callback", () => {
  it("échange le code et redirige vers l’espace", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const reponse = await GET(new Request("http://localhost:3000/auth/callback?code=test&suite=/espace"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test");
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/espace");
    expect(reponse.headers.get("Cache-Control")).toContain("no-store");
  });
  it("renvoie un lien expiré ou déjà utilisé au formulaire avec erreur", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "Expired" } });
    const reponse = await GET(new Request("http://localhost:3000/auth/callback?code=expire"));
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/espace/connexion?erreur=lien");
  });
  it.each(["?suite=/espace", "?code=test&suite=//exemple.com", "?code=test&error=access_denied"])("refuse un callback invalide %s sans échange", async query => {
    const reponse = await GET(new Request(`http://localhost:3000/auth/callback${query}`));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/espace/connexion?erreur=lien");
  });
  it("renvoie un client vers sa propre page de connexion quand le lien échoue", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "Expired" } });
    const reponse = await GET(new Request("http://localhost:3000/auth/callback?code=expire&suite=/panier"));
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/compte/connexion?erreur=lien");
  });
});

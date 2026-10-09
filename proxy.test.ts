import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
let rafraichir = false;
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: { name: string; value: string; options: { path: string; httpOnly: boolean } }[], headers: Record<string, string>) => void } }) => {
    if (rafraichir) options.cookies.setAll([{ name: "session-test", value: "rafraichie", options: { path: "/", httpOnly: true } }], { "Cache-Control": "private, no-store", Pragma: "no-cache" });
    return { auth: { getUser } };
  },
}));
beforeEach(() => { rafraichir = false; getUser.mockReset(); });

describe("US-09 : proxy", () => {
  it.each(["/espace", "/espace/articles/nouveau", "/espace/statistiques", "/admin", "/admin/boutiques"])("protège %s sans session", async chemin => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const reponse = await proxy(new NextRequest(`http://localhost:3000${chemin}`));
    expect(reponse.status).toBe(307);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/espace/connexion");
  });
  it("laisse le formulaire de connexion accessible", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const reponse = await proxy(new NextRequest("http://localhost:3000/espace/connexion"));
    expect(reponse.status).toBe(200);
  });
  it("transmet les cookies rafraîchis au serveur et au navigateur", async () => {
    rafraichir = true;
    getUser.mockResolvedValue({ data: { user: { id: "test" } }, error: null });
    const request = new NextRequest("http://localhost:3000/espace");
    const reponse = await proxy(request);
    expect(request.cookies.get("session-test")?.value).toBe("rafraichie");
    expect(reponse.cookies.get("session-test")?.value).toBe("rafraichie");
    expect(reponse.headers.get("Cache-Control")).toContain("no-store");
  });
  it("conserve les cookies et en-têtes sur la redirection d’une session rejetée", async () => {
    rafraichir = true;
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Session invalide" } });
    const reponse = await proxy(new NextRequest("http://localhost:3000/espace"));
    expect(reponse.status).toBe(307);
    expect(reponse.cookies.get("session-test")?.value).toBe("rafraichie");
    expect(reponse.headers.get("Pragma")).toBe("no-cache");
  });
  it("protège le compte client et revient à la page demandée après connexion (US-20.2)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const reponse = await proxy(new NextRequest("http://localhost:3000/compte/commandes"));
    expect(reponse.status).toBe(307);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/compte/connexion?suite=%2Fcompte%2Fcommandes");
    expect((await proxy(new NextRequest("http://localhost:3000/compte/connexion"))).status).toBe(200);
  });
});

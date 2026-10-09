import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const ouvrir = (code: string) => GET(new NextRequest(`http://localhost:3000/p/${code}`), { params: Promise.resolve({ code }) });

describe("US-27.2 : lien d'invitation /p/<code>", () => {
  it("garde le code seul dans le cookie « parrain » (httpOnly, SameSite=Lax, 30 jours) puis ouvre /parrainage?invite=1", async () => {
    const reponse = await ouvrir("k7m2qx");
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/parrainage?invite=1");
    const cookie = reponse.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^parrain=K7M2QX;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/Path=\//);
    expect(reponse.headers.get("Cache-Control")).toContain("no-store");
  });
  it.each(["INCONNU", "K0M2QX", "%E0%A4%A", "<script>"])("code mal formé « %s » : même page, sans cookie", async (code) => {
    const reponse = await ouvrir(code);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/parrainage?invite=1");
    expect(reponse.headers.get("set-cookie")).toBeNull();
  });
});

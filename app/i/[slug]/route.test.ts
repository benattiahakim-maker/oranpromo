import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const ouvrir = (slug: string) => GET(new NextRequest(`http://localhost:3000/i/${slug}`), { params: Promise.resolve({ slug }) });

describe("US-31.3 : lien de l'affiche /i/<slug>", () => {
  it("garde le slug dans le cookie « inscription_boutique » (httpOnly, SameSite=Lax, 24 h) puis ouvre la vitrine", async () => {
    const reponse = await ouvrir("chez-amine");
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/b/chez-amine?bienvenue=1");
    const cookie = reponse.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^inscription_boutique=chez-amine;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=86400/);
    expect(cookie).toMatch(/Path=\//);
    expect(reponse.headers.get("Cache-Control")).toContain("no-store");
    expect(reponse.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
  it("majuscules tolérées (QR recopié à la main)", async () => {
    expect((await ouvrir("Chez-Amine")).headers.get("location")).toBe("http://localhost:3000/b/chez-amine?bienvenue=1");
  });
  it.each(["a", "chez_amine", "%E0%A4%A", "<script>", "-chez", "x".repeat(61)])("slug mal formé « %s » : accueil, sans cookie", async (slug) => {
    const reponse = await ouvrir(slug);
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/");
    expect(reponse.headers.get("set-cookie")).toBeNull();
  });
});

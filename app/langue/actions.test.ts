import { beforeEach, describe, expect, it, vi } from "vitest";
const { set, refresh } = vi.hoisted(() => ({ set: vi.fn(), refresh: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("next/cache", () => ({ refresh }));
import { choisirLangue } from "./actions";

const formulaire = (langue: string) => { const donnees = new FormData(); donnees.set("langue", langue); return donnees; };

describe("US-23 : choisir la langue", () => {
  beforeEach(() => { set.mockClear(); refresh.mockClear(); });
  it("garde l'arabe dans le cookie « langue » pendant un an, puis rafraîchit la page", async () => {
    await choisirLangue(formulaire("ar"));
    expect(set).toHaveBeenCalledWith("langue", "ar", expect.objectContaining({ path: "/", maxAge: 31536000, sameSite: "lax" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("revient au français ; une valeur inconnue donne le français", async () => {
    await choisirLangue(formulaire("fr"));
    await choisirLangue(formulaire("<script>"));
    expect(set.mock.calls.map(appel => appel[1])).toEqual(["fr", "fr"]);
  });
});

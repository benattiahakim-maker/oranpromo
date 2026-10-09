import { describe, expect, it } from "vitest";
import { COOKIE_LANGUE, DUREE_COOKIE_LANGUE, direction, isolerGaucheDroite, langueDepuisCookie, remplir } from "./langue";

describe("US-23 : langue", () => {
  it("français par défaut : tout ce qui n'est pas « ar » donne « fr »", () => {
    expect(langueDepuisCookie("ar")).toBe("ar");
    for (const valeur of [undefined, null, "", "fr", "AR", "en", "ar;x"]) expect(langueDepuisCookie(valeur)).toBe("fr");
  });
  it("cookie « langue » gardé un an", () => {
    expect(COOKIE_LANGUE).toBe("langue");
    expect(DUREE_COOKIE_LANGUE).toBe(31536000);
  });
  it("arabe de droite à gauche, français de gauche à droite", () => {
    expect(direction("ar")).toBe("rtl");
    expect(direction("fr")).toBe("ltr");
  });
  it("remplit les {noms} et laisse les inconnus", () => {
    expect(remplir("{n} résultats", { n: 3 })).toBe("3 résultats");
    expect(remplir("السلة ({n})", { n: 2 })).toBe("السلة (2)");
    expect(remplir("{a} {b}", { a: "x" })).toBe("x {b}");
  });
  it("isole un fragment de gauche à droite", () => {
    expect(isolerGaucheDroite("+213 555")).toBe("\u2066+213 555\u2069");
  });
});

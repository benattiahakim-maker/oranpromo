import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Prix from "./Prix";

afterEach(cleanup);

describe("prix isolé du texte autour (pages en arabe, espace et admin compris)", () => {
  it("français : de gauche à droite, « DA » après le nombre, signe moins compris", () => {
    const { container } = render(<p dir="rtl">Total <Prix montant={3500} /> · bon <Prix montant={500} moins /></p>);
    const [total, bon] = container.querySelectorAll("bdi[data-prix]");
    expect(total).toHaveAttribute("dir", "ltr"); expect(total.textContent).toBe("3\u00a0500\u00a0DA");
    expect(bon).toHaveAttribute("dir", "ltr"); expect(bon.textContent).toBe("−500\u00a0DA");
  });
  it("arabe : de droite à gauche, chiffres (et signe) isolés de gauche à droite", () => {
    const { container } = render(<p dir="rtl"><Prix montant={3500} langue="ar" /> <Prix montant={500} langue="ar" moins /></p>);
    const [total, bon] = container.querySelectorAll("bdi[data-prix]");
    expect(total).toHaveAttribute("dir", "rtl"); expect(total.textContent).toBe("\u20663\u00a0500\u2069\u00a0دج");
    expect(bon.textContent).toBe("\u2066−500\u2069\u00a0دج");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Numero, { remplirAvec } from "./Numero";

afterEach(cleanup);

describe("numéro isolé de gauche à droite (pages en arabe)", () => {
  it("<bdi dir=\"ltr\"> autour du numéro brut ou lisible", () => {
    const { container } = render(<div dir="rtl"><Numero telephone="+213555123456" /> · <Numero telephone="+213555123456" lisible /></div>);
    const numeros = container.querySelectorAll("bdi[dir=ltr][data-numero]");
    expect([...numeros].map(n => n.textContent)).toEqual(["+213555123456", "0555 12 34 56"]);
    expect(numeros[0].textContent?.startsWith("+")).toBe(true);
  });

  it("remplirAvec : le numéro est un élément isolé dans la phrase arabe, le reste est remplacé comme avec remplir", () => {
    render(<p dir="rtl">{remplirAvec("{numero} · مأكّدة نهار {date} {inconnu}", { numero: <Numero telephone="+213555123456" />, date: "10/10/2026" })}</p>);
    const p = screen.getByText(/مأكّدة نهار 10\/10\/2026/);
    expect(p).toHaveTextContent("+213555123456 · مأكّدة نهار 10/10/2026 {inconnu}");
    expect(p.querySelector("bdi[dir=ltr]")).toHaveTextContent(/^\+213555123456$/);
  });
});

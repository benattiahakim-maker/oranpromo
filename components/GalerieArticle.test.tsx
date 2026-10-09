import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GalerieArticle from "./GalerieArticle";

vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span role="img" aria-label={props.alt} /> }));
afterEach(cleanup);

describe("Galerie article (US-02)", () => {
  it("affiche toutes les photos et permet de naviguer au clavier et avec les boutons", () => {
    render(<GalerieArticle titre="Polo" photos={[{ adresse: "/1.jpg", ordre: 0 }, { adresse: "/2.jpg", ordre: 1 }]} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    const galerie = screen.getByLabelText("Galerie défilable");
    Object.defineProperty(galerie, "clientWidth", { value: 375 });
    const scrollTo = vi.fn();
    galerie.scrollTo = scrollTo;
    fireEvent.click(screen.getByLabelText("Photo suivante"));
    expect(scrollTo).toHaveBeenCalledWith({ left: 375, behavior: "smooth" });
    Object.defineProperty(galerie, "scrollLeft", { value: 375, configurable: true });
    fireEvent.scroll(galerie);
    expect(screen.getByLabelText("Voir la photo 2").getAttribute("aria-current")).toBe("true");
    expect((screen.getByLabelText("Photo suivante") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(galerie, { key: "ArrowLeft" });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
  });
});

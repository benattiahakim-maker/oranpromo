import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoixTailles } from "./ChoixArticle";

afterEach(cleanup);
describe("choix des tailles selon la catégorie", () => {
  it("propose des contenances en ml pour la beauté", () => {
    const onChange = vi.fn();
    render(<ChoixTailles categorie="Parfums" genre="" valeurs={[]} onChange={onChange} />);
    expect(screen.getByText("Contenances disponibles *")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "100 ml" }));
    expect(onChange).toHaveBeenCalledWith(["100 ml"]);
    expect(screen.getByRole("button", { name: "Unique" })).toBeTruthy();
  });
  it("garde les tailles pour la mode", () => {
    render(<ChoixTailles categorie="Robes" genre="femme" valeurs={["M"]} onChange={() => {}} />);
    expect(screen.getByText("Tailles disponibles *")).toBeTruthy();
    expect(screen.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe("true");
  });
});

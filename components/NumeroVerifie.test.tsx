import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import NumeroVerifie from "./NumeroVerifie";

vi.mock("./CodeTelephone", () => ({ default: ({ usage, numeroInitial }: { usage: string; numeroInitial?: string | null }) => <p>Formulaire de code ({usage}) {numeroInitial ?? "vide"}</p> }));
afterEach(cleanup);

describe("numéro dans /compte (US-21.2)", () => {
  it("numéro vérifié : affiché sans champ, « Changer de numéro » relance une vérification", () => {
    render(<NumeroVerifie telephone="+213555123456" verifie verificationActive />);
    expect(screen.getByText("Téléphone vérifié")).toBeInTheDocument();
    expect(screen.getByText("0555 12 34 56")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Changer de numéro" }));
    expect(screen.getByText(/Formulaire de code \(verification\)/)).toBeInTheDocument();
  });
  it("mode e-mail : numéro vérifié affiché, sans changement possible ici", () => {
    render(<NumeroVerifie telephone="+213555123456" verifie verificationActive={false} />);
    expect(screen.getByText("0555 12 34 56")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Changer de numéro" })).not.toBeInTheDocument();
  });
  it("mode téléphone, numéro non vérifié : vérification demandée avec le numéro saisi", () => {
    render(<NumeroVerifie telephone="+213555123456" verifie={false} verificationActive />);
    expect(screen.getByText("Vérifiez votre numéro pour commander")).toBeInTheDocument();
    expect(screen.getByText("Formulaire de code (verification) +213555123456")).toBeInTheDocument();
  });
  it("mode e-mail, numéro non vérifié : rien (comme avant)", () => {
    const { container } = render(<NumeroVerifie telephone="+213555123456" verifie={false} verificationActive={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

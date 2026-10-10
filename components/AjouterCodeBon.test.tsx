import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AjouterCodeBon from "./AjouterCodeBon";

const { ajouterCode, refresh } = vi.hoisted(() => ({ ajouterCode: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/compte/bons/actions", () => ({ ajouterCode }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => { ajouterCode.mockReset(); refresh.mockReset(); });
afterEach(cleanup);

describe("US-33.3 : « J'ai un code » dans /compte", () => {
  it("code valable : « Bon Aïd 2026 ajouté : 500 DA dès 4 000 DA d'achat. » (n° 5), « Mes bons » rechargé", async () => {
    ajouterCode.mockResolvedValue({ etat: "ajoute", nom_fr: "Aïd 2026", nom_ar: "العيد 2026", montant: 500, minimum_achat: 4000 });
    render(<AjouterCodeBon />);
    fireEvent.click(screen.getByRole("button", { name: "J’ai un code" }));
    fireEvent.change(screen.getByRole("textbox", { name: "J’ai un code" }), { target: { value: "aid2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/^Bon Aïd 2026 ajouté : 500\sDA dès 4\s000\sDA d’achat\.$/);
    expect(ajouterCode).toHaveBeenCalledWith("aid2026");
    expect(refresh).toHaveBeenCalled();
  });
  it.each([["inconnu", "Ce code n’existe pas ou n’est plus valable."], ["deja", "Vous avez déjà eu ce bon."], ["trop", "Trop d’essais. Réessayez dans une heure."], ["erreur", "Impossible d’ajouter ce code. Réessayez."]])
  ("%s : message de la conception", async (etat, texte) => {
    ajouterCode.mockResolvedValue({ etat });
    render(<AjouterCodeBon />);
    fireEvent.click(screen.getByRole("button", { name: "J’ai un code" }));
    fireEvent.change(screen.getByRole("textbox", { name: "J’ai un code" }), { target: { value: "FAUX01" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(texte);
    expect(refresh).not.toHaveBeenCalled();
  });
});

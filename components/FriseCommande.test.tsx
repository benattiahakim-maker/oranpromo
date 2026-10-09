import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import FriseCommande from "./FriseCommande";

afterEach(cleanup);
describe("frise du suivi (US-20.2)", () => {
  it("montre les étapes faites avec date et note, puis les étapes à venir", () => {
    render(<FriseCommande statut="confirmee" suivi={[{ statut: "demandee", date: "2026-10-09T12:05:00Z", note: "Samedi", auteur: "client" }, { statut: "confirmee", date: "2026-10-09T12:30:00Z", note: null, auteur: "boutique" }]} />);
    const etapes = within(screen.getByRole("list", { name: "Suivi de la commande" })).getAllByRole("listitem");
    expect(etapes.map(e => e.textContent)).toEqual(["Demandéeven. 9 oct. · 13:05« Samedi »", "Confirméeven. 9 oct. · 13:30", "Prête (à venir)", "Récupérée (à venir)"]);
  });
});

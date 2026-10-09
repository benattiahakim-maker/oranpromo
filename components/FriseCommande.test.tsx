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

describe("US-23 : suivi en arabe", () => {
  it("étapes traduites", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    const { render: rendu, screen: ecran } = await import("@testing-library/react");
    rendu(<FournisseurTextes langue="ar" textes={textesDe("ar")}><FriseCommande statut="confirmee" suivi={[{ statut: "demandee", date: "2026-10-09T10:00:00Z", note: null, auteur: "client" }, { statut: "confirmee", date: "2026-10-09T10:05:00Z", note: null, auteur: "client" }]} /></FournisseurTextes>);
    expect(ecran.getByText("تأكّد")).toBeTruthy();
    expect(ecran.getByText("واجد (من بعد)")).toBeTruthy();
  });
});

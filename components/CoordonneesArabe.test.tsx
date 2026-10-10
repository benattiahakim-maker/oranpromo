// @vitest-environment jsdom
// BOLOSS (10/10) : en arabe, « Position sur la carte » montrait la latitude et la longitude dans le mauvais ordre
// pour la page de droite à gauche. Les coordonnées sont maintenant isolées de gauche à droite (<Coordonnees />, comme <Numero />),
// dans le bloc de l'espace, sous la carte du choix et dans le message « coordonnées lues dans le lien ».
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChoixPosition from "./ChoixPosition";
import PositionEspace from "./PositionEspace";
import FournisseurTextes from "./FournisseurTextes";
import { textesDe } from "@/lib/textes";
import { traduireMessage } from "@/lib/textes/messages";

vi.mock("@/app/espace/actions", () => ({ enregistrerPositionMaBoutique: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => function FausseCarte() { return <div data-testid="carte" />; } }));
afterEach(cleanup);

const ar = textesDe("ar"), t = ar.espace.position;
const isolees = (el: Element | null) => {
  expect(el).not.toBeNull();
  expect(el!.tagName).toBe("BDI"); expect(el).toHaveAttribute("dir", "ltr");
};

describe("coordonnées isolées de gauche à droite en arabe", () => {
  it("espace (boutique validée) : « 35,700000 · −0,630000 » isolé, dans un paragraphe qui suit la page", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><PositionEspace statut="validee" latitude={35.7} longitude={-0.63} /></FournisseurTextes>);
    const coordonnees = document.querySelector("[data-coordonnees]");
    isolees(coordonnees);
    expect(coordonnees).toHaveTextContent("35,700000 · −0,630000");
    expect(coordonnees!.parentElement).not.toHaveAttribute("dir"); // aligné avec la page (à droite), l'ordre reste latitude puis longitude
  });

  it("choix de la position : lien collé → message arabe avec les coordonnées isolées ; coordonnées sous la carte isolées", () => {
    render(<ChoixPosition id="p" latitude="" longitude="" onChange={() => {}} t={t} traduireMessage={m => traduireMessage(m, "ar")} />);
    fireEvent.change(screen.getByLabelText(t.collerLien), { target: { value: "https://www.google.com/maps/@35.69712,-0.63375,17z" } });
    fireEvent.click(screen.getByRole("button", { name: t.lire }));
    const message = screen.getByRole("status");
    expect(message.textContent).toContain(t.lue.split("{position}")[0]);
    const dansMessage = message.querySelector("[data-coordonnees]");
    isolees(dansMessage);
    expect(dansMessage).toHaveTextContent("35,697120 · −0,633750");
  });

  it("coordonnées sous la carte (position déjà placée) : isolées", () => {
    render(<ChoixPosition id="p" latitude="35.69712" longitude="-0.63375" onChange={() => {}} t={t} traduireMessage={m => traduireMessage(m, "ar")} />);
    isolees(screen.getByTestId("p-coordonnees"));
    expect(screen.getByTestId("p-coordonnees")).toHaveTextContent("35,697120 · −0,633750");
  });
});

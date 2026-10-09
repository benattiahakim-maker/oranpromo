// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProprietesCartePosition } from "./CartePosition";
import ChoixPosition from "./ChoixPosition";
import { MESSAGE_HORS_ORAN, MESSAGE_LIEN_COURT, MESSAGE_LOCALISATION_REFUSEE } from "@/lib/position";

// La carte Leaflet est remplacée par un faux composant (next/dynamic) qui montre ce qu'elle reçoit.
vi.mock("next/dynamic", () => ({
  default: () => function FausseCarte(props: ProprietesCartePosition) {
    return <div data-testid="carte" data-position={JSON.stringify(props.position)} data-deplacable={String(props.deplacable)}>
      <button type="button" onClick={() => props.onDeplacer?.({ latitude: 35.7034, longitude: -0.6436 })}>Déplacer l’épingle</button>
      <button type="button" onClick={() => props.onDeplacer?.({ latitude: 36.75, longitude: 3.05 })}>Épingle à Alger</button>
    </div>;
  },
}));

const getCurrentPosition = vi.fn();
function Formulaire({ initiale = ["", ""] }: { initiale?: [string, string] }) {
  const [position, setPosition] = useState(initiale);
  return <form onSubmit={evenement => { evenement.preventDefault(); envoi(); }}><ChoixPosition id="test" latitude={position[0]} longitude={position[1]} onChange={(a, b) => setPosition([a, b])} /><span data-testid="valeur">{position.join("|")}</span></form>;
}
const envoi = vi.fn();
const reponse = (latitude: number, longitude: number, accuracy: number) => ({ coords: { latitude, longitude, accuracy } });

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("US-24.2 : bloc « Position sur la carte »", () => {
  it("ne demande pas la localisation à l'ouverture ; sans position, la carte est vide", () => {
    render(<Formulaire />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByTestId("carte")).toHaveAttribute("data-position", "null");
    expect(screen.queryByText("Retirer la position")).toBeNull();
  });

  it("« Je suis dans la boutique » : localisation précise, position et précision affichées", () => {
    getCurrentPosition.mockImplementation(succes => succes(reponse(35.69712, -0.63375, 11.6)));
    render(<Formulaire />);
    fireEvent.click(screen.getByRole("button", { name: "Je suis dans la boutique : utiliser ma position" }));
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("✓ Position trouvée · précision ± 12 m");
    expect(screen.getByTestId("valeur")).toHaveTextContent("35.697120|-0.633750");
    expect(screen.getByTestId("test-coordonnees")).toHaveTextContent("35,697120 · −0,633750");
    expect(screen.getByTestId("carte")).toHaveAttribute("data-position", JSON.stringify({ latitude: 35.69712, longitude: -0.63375 }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("précision au-delà de 100 m : avertissement, la position reste proposée", () => {
    getCurrentPosition.mockImplementation(succes => succes(reponse(35.69712, -0.63375, 350)));
    render(<Formulaire />);
    fireEvent.click(screen.getByRole("button", { name: /Je suis dans la boutique/ }));
    expect(screen.getByText(/Position peu précise \(± 350 m\)/)).toBeInTheDocument();
    expect(screen.getByTestId("valeur")).toHaveTextContent("35.697120|-0.633750");
  });

  it("localisation refusée : message, rien de rempli", () => {
    getCurrentPosition.mockImplementation((_succes, echec) => echec({ code: 1 }));
    render(<Formulaire />);
    fireEvent.click(screen.getByRole("button", { name: /Je suis dans la boutique/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE_LOCALISATION_REFUSEE);
    expect(screen.getByTestId("valeur")).toHaveTextContent("|");
  });

  it("position trouvée hors de la wilaya d'Oran : refusée tout de suite", () => {
    getCurrentPosition.mockImplementation(succes => succes(reponse(36.75, 3.05, 10)));
    render(<Formulaire />);
    fireEvent.click(screen.getByRole("button", { name: /Je suis dans la boutique/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE_HORS_ORAN);
    expect(screen.getByTestId("valeur")).toHaveTextContent("|");
  });

  it("lien Google Maps long : coordonnées lues et épingle placée ; Entrée ne soumet pas le formulaire", () => {
    render(<Formulaire />);
    const champ = screen.getByLabelText("Coller un lien Google Maps");
    fireEvent.change(champ, { target: { value: "https://www.google.com/maps/place/X/@35.6,-0.7,15z/data=!3d35.69712!4d-0.63375" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(envoi).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Coordonnées lues dans le lien : 35,697120 · −0,633750. Vérifiez l’épingle sur la carte.");
    expect(screen.getByTestId("valeur")).toHaveTextContent("35.697120|-0.633750");
  });

  it("lien court : message dédié, jamais ouvert (aucun appel réseau)", () => {
    render(<Formulaire />);
    fireEvent.change(screen.getByLabelText("Coller un lien Google Maps"), { target: { value: "https://maps.app.goo.gl/Ab12Cd34" } });
    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE_LIEN_COURT);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("valeur")).toHaveTextContent("|");
  });

  it("lien non reconnu : « Coordonnées introuvables dans ce lien. »", () => {
    render(<Formulaire />);
    fireEvent.change(screen.getByLabelText("Coller un lien Google Maps"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Coordonnées introuvables dans ce lien.");
  });

  it("épingle déplacée du doigt : nouvelles coordonnées ; hors d'Oran refusée", () => {
    render(<Formulaire initiale={["35.697120", "-0.633750"]} />);
    expect(screen.getByTestId("carte")).toHaveAttribute("data-deplacable", "true");
    fireEvent.click(screen.getByRole("button", { name: "Déplacer l’épingle" }));
    expect(screen.getByTestId("valeur")).toHaveTextContent("35.703400|-0.643600");
    fireEvent.click(screen.getByRole("button", { name: "Épingle à Alger" }));
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE_HORS_ORAN);
    expect(screen.getByTestId("valeur")).toHaveTextContent("35.703400|-0.643600");
  });

  it("« Retirer la position » vide les deux coordonnées", () => {
    render(<Formulaire initiale={["35.697120", "-0.633750"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer la position" }));
    expect(screen.getByTestId("valeur")).toHaveTextContent("|");
    expect(screen.getByTestId("carte")).toHaveAttribute("data-position", "null");
  });

  it("saisie à la main gardée (latitude et longitude)", () => {
    render(<Formulaire />);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "35,7303" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-0,5784" } });
    expect(screen.getByTestId("carte")).toHaveAttribute("data-position", JSON.stringify({ latitude: 35.7303, longitude: -0.5784 }));
  });
});

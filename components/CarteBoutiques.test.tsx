// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProprietesCarteLeaflet } from "./CarteLeaflet";
import CarteBoutiques from "./CarteBoutiques";
import FournisseurTextes from "./FournisseurTextes";
import { textesDe } from "@/lib/textes";
import type { BoutiqueCarte } from "@/lib/carte";

// Faux composant de carte : montre les épingles reçues et permet de toucher une épingle.
const recu: { props: ProprietesCarteLeaflet | null } = { props: null };
vi.mock("next/dynamic", () => ({
  default: () => function FausseCarte(props: ProprietesCarteLeaflet) {
    recu.props = props;
    return <div data-testid="carte" data-epingles={props.boutiques.map(b => `${b.id}:${b.promos}`).join(",")} data-origine={JSON.stringify(props.origine)}>
      {props.boutiques.map(b => <button key={b.id} type="button" onClick={() => props.onSelection(b.id)}>Épingle {b.nom}</button>)}
      <button type="button" onClick={props.onIndisponible}>Tuiles en panne</button>
    </div>;
  },
}));

const boutiques: BoutiqueCarte[] = [
  { id: "amine", slug: "boutique-amine", nom: "Boutique Amine", quartier: "Akid Lotfi", latitude: 35.7303, longitude: -0.5784, promos: 3, univers: ["femme"] },
  { id: "ilyes", slug: "maison-ilyes", nom: "Maison Ilyes", quartier: "Front de Mer", latitude: 35.7034, longitude: -0.6436, promos: 1, univers: ["homme"] },
  { id: "sarah", slug: "atelier-sarah", nom: "Atelier Sarah", quartier: "Gambetta", latitude: null, longitude: null, promos: 0, univers: ["femme"] },
];
const getCurrentPosition = vi.fn();
const tout = (langue: "fr" | "ar" = "fr", univers: BoutiqueCarte["univers"][number] | null = null) =>
  render(<FournisseurTextes langue={langue} textes={textesDe(langue)}><CarteBoutiques boutiques={boutiques} univers={univers} /></FournisseurTextes>);
const listes = () => screen.getAllByRole("list");

beforeEach(() => {
  vi.clearAllMocks(); recu.props = null;
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  vi.stubGlobal("fetch", vi.fn());
  window.history.replaceState(null, "", "/carte");
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("US-24.3 : page /carte", () => {
  it("une épingle par boutique placée (avec le nombre de promos) ; liste par nom ; section « Sans position »", () => {
    tout();
    expect(screen.getByText("3 boutiques à Oran")).toBeInTheDocument();
    expect(screen.getByTestId("carte")).toHaveAttribute("data-epingles", "amine:3,ilyes:1");
    expect(screen.getByText("Les boutiques · par nom")).toBeInTheDocument();
    expect(within(listes()[0]).getAllByRole("link").map(l => l.getAttribute("href"))).toEqual(["/b/boutique-amine", "/b/maison-ilyes"]);
    expect(screen.getByText("Sans position sur la carte (1)")).toBeInTheDocument();
    expect(within(listes()[1]).getByRole("link")).toHaveAttribute("href", "/b/atelier-sarah");
    expect(screen.getByText("Gambetta · Aucune promo en cours")).toBeInTheDocument();
  });

  it("filtre par univers : gardé dans l'adresse, sans recharger ni relire la base", () => {
    tout();
    const lien = screen.getByRole("link", { name: "Homme" });
    expect(lien).toHaveAttribute("href", "/carte?univers=homme");
    fireEvent.click(lien);
    expect(window.location.pathname + window.location.search).toBe("/carte?univers=homme");
    expect(screen.getByTestId("carte")).toHaveAttribute("data-epingles", "ilyes:1");
    expect(screen.queryByText(/Sans position/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Beauté" }));
    expect(screen.getByText("Aucune boutique de cet univers pour le moment.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Voir toutes les boutiques" }));
    expect(window.location.search).toBe("");
    expect(screen.getByTestId("carte")).toHaveAttribute("data-epingles", "amine:3,ilyes:1");
  });

  it("filtre reçu de l'adresse au chargement", () => {
    tout("fr", "femme");
    expect(screen.getByRole("link", { name: "Femme" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("carte")).toHaveAttribute("data-epingles", "amine:3");
  });

  it("toucher une épingle : mini-fiche avec « Voir la boutique » et « Itinéraire »", () => {
    tout();
    fireEvent.click(screen.getByRole("button", { name: "Épingle Boutique Amine" }));
    const fiche = screen.getByRole("region", { name: "Boutique Amine" });
    expect(within(fiche).getByText("3 promos en cours")).toBeInTheDocument();
    expect(within(fiche).getByRole("link", { name: "Voir la boutique" })).toHaveAttribute("href", "/b/boutique-amine");
    expect(within(fiche).getByRole("link", { name: "Itinéraire" })).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=35.7303%2C-0.5784");
    fireEvent.click(within(fiche).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("region", { name: "Boutique Amine" })).toBeNull();
  });

  it("« Autour de moi » : aucune demande avant le toucher, puis liste triée par distance ; la position ne sort jamais du téléphone", () => {
    const cookieAvant = document.cookie;
    tout();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText("Votre position reste sur votre téléphone : elle n’est ni envoyée ni enregistrée.")).toBeInTheDocument();
    getCurrentPosition.mockImplementation(succes => succes({ coords: { latitude: 35.7025, longitude: -0.6450, accuracy: 40 } }));
    fireEvent.click(screen.getByRole("button", { name: /Autour de moi/ }));
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    expect(screen.getByRole("button", { name: /Autour de moi · actif/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Les boutiques · les plus proches d’abord")).toBeInTheDocument();
    expect(within(listes()[0]).getAllByRole("link").map(l => l.getAttribute("href"))).toEqual(["/b/maison-ilyes", "/b/boutique-amine"]);
    expect(within(listes()[0]).getByText("160 m")).toBeInTheDocument();
    expect(within(listes()[0]).getByText("6,8 km")).toBeInTheDocument();
    expect(recu.props?.origine).toEqual({ latitude: 35.7025, longitude: -0.6450 });
    // Rien n'est envoyé ni gardé : ni requête, ni adresse, ni cookie, ni stockage.
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.href).not.toMatch(/35\.70|0\.645/);
    expect(document.cookie).toBe(cookieAvant);
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Épingle Maison Ilyes" }));
    expect(within(screen.getByRole("region", { name: "Maison Ilyes" })).getByText("Front de Mer · à 160 m")).toBeInTheDocument();
  });

  it("localisation refusée : message, la liste reste par nom", () => {
    getCurrentPosition.mockImplementation((_s, echec) => echec({ code: 1 }));
    tout();
    fireEvent.click(screen.getByRole("button", { name: /Autour de moi/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Localisation refusée : la liste reste triée par nom. Vous pouvez l’autoriser dans les réglages du navigateur.");
    expect(screen.getByText("Les boutiques · par nom")).toBeInTheDocument();
  });

  it("position introuvable (délai de 15 s) : message et « Réessayer »", () => {
    getCurrentPosition.mockImplementation((_s, echec) => echec({ code: 3 }));
    tout();
    fireEvent.click(screen.getByRole("button", { name: /Autour de moi/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Position introuvable pour le moment. Réessayez dehors ou près d’une fenêtre.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("tuiles indisponibles : message, la liste reste", () => {
    tout();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Tuiles en panne" })); });
    expect(screen.getByText("La carte ne peut pas s’afficher. La liste des boutiques reste ci-dessous.")).toBeInTheDocument();
    expect(screen.queryByTestId("carte")).toBeNull();
    expect(screen.getByText("Maison Ilyes")).toBeInTheDocument();
  });

  it("en arabe : textes proposés, distances « م / كم », noms de boutiques non traduits", () => {
    getCurrentPosition.mockImplementation(succes => succes({ coords: { latitude: 35.7025, longitude: -0.6450, accuracy: 40 } }));
    tout("ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("الحوانت في الخريطة");
    expect(screen.getByRole("link", { name: "ذراري" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /قريب ليّا/ }));
    expect(screen.getByText("160 م")).toBeInTheDocument();
    expect(screen.getByText("6,8 كم")).toBeInTheDocument();
    expect(screen.getByText("Maison Ilyes")).toBeInTheDocument();
    expect(screen.getByText("ما عندهمش بلاصة في الخريطة (1)")).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/app/ville/actions", () => ({ choisirVille: vi.fn() }));
import ChoixVille from "./ChoixVille";
import { VILLE_ORAN } from "@/lib/ville";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const tlemcen = { ...VILLE_ORAN, code: "tlemcen", nom: "Tlemcen", nom_ar: "تلمسان", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, boutiques: 2 };
const localiserA = (latitude: number, longitude: number) => {
  const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ coords: { latitude, longitude } } as GeolocationPosition));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  return getCurrentPosition;
};

describe("US-29.2 : « Me localiser » sur /villes (la position reste dans le téléphone)", () => {
  it("position dans les bornes de Tlemcen : « Vous êtes près de Tlemcen. »", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    localiserA(34.8818, -1.3167);
    render(<ChoixVille villes={[VILLE_ORAN, tlemcen]} actuelle="oran" retour="" />);
    fireEvent.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(screen.getByRole("status").textContent).toBe("Vous êtes près de Tlemcen.");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("hors de toutes les villes : texte 6", () => {
    localiserA(36.7729, 3.0588);
    render(<ChoixVille villes={[VILLE_ORAN, tlemcen]} actuelle={null} retour="" />);
    fireEvent.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(screen.getByRole("status").textContent).toBe("Pas encore de boutiques BleDeal près de vous : choisissez une ville ci-dessous.");
  });
  it("refus ou téléphone sans localisation : message, la liste reste utilisable", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_ok: PositionCallback, ko: PositionErrorCallback) => ko({ code: 1 } as GeolocationPositionError) } });
    render(<ChoixVille villes={[VILLE_ORAN]} actuelle={null} retour="" />);
    fireEvent.click(screen.getByRole("button", { name: "Me localiser" }));
    expect(screen.getByRole("status").textContent).toBe("Position introuvable : choisissez une ville ci-dessous.");
    expect(screen.getByRole("button", { name: /Oran/ })).toBeTruthy();
  });
});

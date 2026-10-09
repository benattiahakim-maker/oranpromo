import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MiseAJourCommandes, { BanniereNouvelle, EtatMiseAJour, URL_ETAT, useEstNouvelle } from "./MiseAJourCommandes";
import { INTERVALLE_ERREUR_MS, INTERVALLE_MS, type EtatCommandes } from "@/lib/tableau-commandes";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const T0 = Date.parse("2026-10-09T13:05:00Z");
const INITIAL: EtatCommandes = { a_confirmer: 3, a_preparer: 2, pretes: 1, terminees: 4, derniere: 133 };
const fetchMock = vi.fn();
const oscillateurs: number[] = [];
let visibilite: DocumentVisibilityState = "visible";
const reponse = (etat: Partial<EtatCommandes>, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => ({ ...INITIAL, ...etat }) });

class FauxAudio { currentTime = 0; destination = {}; resume = vi.fn(async () => {}); createGain() { return { gain: { value: 0 }, connect: vi.fn() }; } createOscillator() { oscillateurs.push(1); return { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; } }

function Ligne({ numero, cree_le }: { numero: number; cree_le: string }) { const estNouvelle = useEstNouvelle(); return <p>{numero}{estNouvelle({ numero, cree_le }) ? " Nouveau" : ""}</p>; }
const afficher = () => render(<MiseAJourCommandes initial={INITIAL} maintenant={T0}><EtatMiseAJour /><BanniereNouvelle /><Ligne numero={133} cree_le="2026-10-09T13:04:00Z" /><Ligne numero={134} cree_le="2026-10-09T13:05:10Z" /></MiseAJourCommandes>);
const avancer = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }); vi.setSystemTime(T0);
  vi.clearAllMocks(); oscillateurs.length = 0; visibilite = "visible"; localStorage.clear(); document.title = "Commandes reçues";
  fetchMock.mockImplementation(() => reponse({}));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("AudioContext", FauxAudio);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilite });
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("US-28.4 : mise à jour automatique (interrogation toutes les 20 s)", () => {
  it("vérifie toutes les 20 s ; rien n’a changé : pas de rafraîchissement ni de signal", async () => {
    afficher();
    expect(screen.getByText(/À jour · 14 h 05/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await avancer(INTERVALLE_MS);
    expect(fetchMock).toHaveBeenCalledWith(URL_ETAT, expect.objectContaining({ cache: "no-store" }));
    await avancer(INTERVALLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("nouvelle commande : rafraîchit, bandeau, titre « (1) », vibration, « Nouveau » sur la ligne ; pas de son sans activation", async () => {
    afficher();
    fetchMock.mockImplementation(() => reponse({ a_confirmer: 4, derniere: 134 }));
    await avancer(INTERVALLE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Nouvelle commande n° 134");
    expect(screen.getByRole("link", { name: "Voir" })).toHaveAttribute("href", "/espace/commandes?etape=a_confirmer");
    expect(document.title).toBe("(1) Commandes reçues");
    expect(navigator.vibrate).toHaveBeenCalledWith(200);
    expect(oscillateurs).toHaveLength(0);
    expect(screen.getByText("134 Nouveau")).toBeInTheDocument();
    expect(screen.getByText("133")).toBeInTheDocument(); // déjà là au chargement : pas « Nouveau »
    // Même état au tour suivant : pas de second signal.
    await avancer(INTERVALLE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("(1) Commandes reçues");
    // Regardée : le titre revient ; fermée : le bandeau part.
    fireEvent.pointerDown(window);
    expect(document.title).toBe("Commandes reçues");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("status")).toBeNull();
    // « Nouveau » s’efface après 2 minutes.
    await avancer(6 * INTERVALLE_MS);
    expect(screen.getByText("134")).toBeInTheDocument();
  });
  it("« Activer le son » : choix gardé dans le navigateur, puis deux bips à la commande suivante ; « Couper »", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Activer le son/ }));
    expect(localStorage.getItem("oranpromo-son")).toBe("1");
    expect(screen.getByText(/Son activé/)).toBeInTheDocument();
    oscillateurs.length = 0;
    fetchMock.mockImplementation(() => reponse({ a_confirmer: 4, derniere: 134 }));
    await avancer(INTERVALLE_MS);
    expect(oscillateurs).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Couper" }));
    expect(localStorage.getItem("oranpromo-son")).toBe("0");
    expect(screen.getByRole("button", { name: /Activer le son/ })).toBeInTheDocument();
  });
  it("changement de statut ailleurs (confirmée par WhatsApp, expirée) : rafraîchit sans son ni bandeau", async () => {
    localStorage.setItem("oranpromo-son", "1");
    afficher();
    fetchMock.mockImplementation(() => reponse({ a_confirmer: 2, a_preparer: 3 }));
    await avancer(INTERVALLE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(oscillateurs).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("onglet caché : plus d’interrogation ; au retour, une vérification immédiate", async () => {
    afficher();
    visibilite = "hidden";
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await avancer(5 * INTERVALLE_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    visibilite = "visible";
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await avancer(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("erreur : « Connexion perdue, nouvel essai… », ralentit à 1 minute, puis reprend à 20 s", async () => {
    afficher();
    fetchMock.mockImplementation(() => reponse({}, false));
    await avancer(INTERVALLE_MS);
    expect(screen.getByText(/Connexion perdue, nouvel essai… · dernière mise à jour à 14 h 05/)).toBeInTheDocument();
    await avancer(INTERVALLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas avant 60 s
    fetchMock.mockImplementation(() => reponse({}));
    await avancer(INTERVALLE_ERREUR_MS - INTERVALLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/À jour · 14 h 06/)).toBeInTheDocument();
    await avancer(INTERVALLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("une session expirée (redirection) compte comme une erreur, sans rafraîchir", async () => {
    afficher();
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 0, json: async () => ({}) }));
    await avancer(INTERVALLE_MS);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
  it("« Actualiser » vérifie et rafraîchit tout de suite", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    await avancer(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

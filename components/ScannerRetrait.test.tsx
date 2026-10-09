import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ScannerRetrait from "./ScannerRetrait";
import { lienRetrait, lienScanRetrait } from "@/lib/retrait";

// US-26.3 : scanner de la boutique (caméra, lecteur intégré ou jsqr, code à 4 chiffres).
const { push, lireRetraitParCode, remettreCommandeRetrait, jsQR } = vi.hoisted(() => ({ push: vi.fn(), lireRetraitParCode: vi.fn(), remettreCommandeRetrait: vi.fn(), jsQR: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/app/espace/retrait/actions", () => ({ lireRetraitParCode, remettreCommandeRetrait }));
vi.mock("jsqr", () => ({ default: jsQR }));

const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok", commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T17:30:00Z", terminee_le: null, mode_remise: null,
  lignes: [{ titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix_unitaire: 3900 }] };
const piste = { stop: vi.fn(), getCapabilities: () => ({}) };
const flux = { getTracks: () => [piste], getVideoTracks: () => [piste] };
const getUserMedia = vi.fn();
const g = globalThis as { BarcodeDetector?: unknown };

beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockResolvedValue(flux);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
  delete g.BarcodeDetector;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete g.BarcodeDetector; });

function lecteurIntegre(valeurs: string[], formats = ["qr_code"]) {
  const detect = vi.fn(async () => { const v = valeurs.shift(); return v ? [{ rawValue: v }] : []; });
  g.BarcodeDetector = Object.assign(vi.fn(function () { return { detect }; }), { getSupportedFormats: async () => formats });
  return detect;
}

describe("US-26.3 : scanner", () => {
  it("ouvre la caméra arrière sans le son ; lecteur intégré : un QR code de retrait ouvre la commande et coupe la caméra", async () => {
    lecteurIntegre([lienScanRetrait(JETON)]);
    render(<ScannerRetrait />);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/espace/retrait/${JETON}`));
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: "environment" } }, audio: false });
    expect(piste.stop).toHaveBeenCalled();
    expect(jsQR).not.toHaveBeenCalled();
    const video = screen.getByLabelText("Caméra") as HTMLVideoElement;
    expect(video.muted).toBe(true); expect(video).toHaveAttribute("playsinline");
  });
  it("un autre QR code (lien du proche, affiche, autre site) est refusé sans appel au serveur", async () => {
    lecteurIntegre([lienRetrait(JETON), "https://autre.example/espace/retrait/" + JETON]);
    render(<ScannerRetrait />);
    expect(await screen.findByText("Ce n’est pas un QR code de retrait OranPromo.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled(); expect(lireRetraitParCode).not.toHaveBeenCalled();
  });
  it("sans lecteur intégré (iPhone) : jsqr chargée à la demande lit l’image de la caméra", async () => {
    const contexte = { drawImage: vi.fn(), getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })) };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(contexte as never);
    jsQR.mockReturnValue({ data: lienScanRetrait(JETON) });
    render(<ScannerRetrait />);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/espace/retrait/${JETON}`));
    expect(jsQR).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 480, 360, { inversionAttempts: "dontInvert" });
  });
  it("lecteur intégré sans le format QR : repli sur jsqr", async () => {
    const detect = lecteurIntegre([], ["ean_13"]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) } as never);
    jsQR.mockReturnValue({ data: lienScanRetrait(JETON) });
    render(<ScannerRetrait />);
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(detect).not.toHaveBeenCalled(); expect(jsQR).toHaveBeenCalled();
  });
  it.each([["refus", () => getUserMedia.mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }))], ["pas de HTTPS", () => Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined })]])
  ("caméra bloquée (%s) : message n° 22, le code reste utilisable", async (_cas, preparer) => {
    preparer();
    render(<ScannerRetrait />);
    expect(await screen.findByText(/La caméra est bloquée. Autorisez-la dans les réglages du navigateur/)).toBeInTheDocument();
    expect(screen.getByLabelText("La caméra ne marche pas ? Tapez le code à 4 chiffres")).toBeEnabled();
  });
  it("code à 4 chiffres : résumé dans la page, puis « Remis au client » par le code", async () => {
    lireRetraitParCode.mockResolvedValue({ succes: true, message: "", resume });
    remettreCommandeRetrait.mockResolvedValue({ succes: true, message: "Commande remise", resume: { ...resume, etat: "remise" } });
    render(<ScannerRetrait />);
    const champ = screen.getByLabelText("La caméra ne marche pas ? Tapez le code à 4 chiffres");
    fireEvent.change(champ, { target: { value: "04a81" } });
    expect(champ).toHaveValue("0481");
    fireEvent.click(screen.getByRole("button", { name: "Voir la commande" }));
    expect(await screen.findByText("Commande n° 128 · Amine")).toBeInTheDocument();
    expect(lireRetraitParCode).toHaveBeenCalledWith("0481");
    expect(screen.getByText("Commande trouvée · par code")).toBeInTheDocument();
    expect(remettreCommandeRetrait).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remis au client" }));
    expect(await screen.findByText("Commande remise")).toBeInTheDocument();
    expect(remettreCommandeRetrait).toHaveBeenCalledWith({ code: "0481" });
    fireEvent.click(screen.getByRole("button", { name: "Scanner une autre commande" }));
    expect(await screen.findByLabelText("La caméra ne marche pas ? Tapez le code à 4 chiffres")).toHaveValue("");
  });
  it("code incomplet : pas d’appel ; code faux : message, on peut réessayer (pas de limite d’essais)", async () => {
    lireRetraitParCode.mockResolvedValue({ succes: false, message: "Code faux. Vérifiez les 4 chiffres avec le client." });
    render(<ScannerRetrait />);
    const champ = screen.getByLabelText("La caméra ne marche pas ? Tapez le code à 4 chiffres");
    fireEvent.change(champ, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Voir la commande" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tapez les 4 chiffres du code.");
    expect(lireRetraitParCode).not.toHaveBeenCalled();
    for (const code of ["1234", "5678", "9012", "3456", "7890", "1111"]) {
      fireEvent.change(champ, { target: { value: code } });
      fireEvent.click(screen.getByRole("button", { name: "Voir la commande" }));
      await waitFor(() => expect(lireRetraitParCode).toHaveBeenLastCalledWith(code));
      expect(await screen.findByText("Code faux. Vérifiez les 4 chiffres avec le client.")).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Voir la commande" })).toBeEnabled();
  });
  it("quitter la page coupe la caméra", async () => {
    const { unmount } = render(<ScannerRetrait />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await screen.findByLabelText("Caméra");
    await waitFor(() => expect(screen.queryByText("Ouverture de la caméra…")).toBeNull());
    unmount();
    expect(piste.stop).toHaveBeenCalled();
  });
});

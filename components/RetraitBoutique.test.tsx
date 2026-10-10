import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import RetraitBoutique from "./RetraitBoutique";

const { remettreCommandeRetrait } = vi.hoisted(() => ({ remettreCommandeRetrait: vi.fn() }));
vi.mock("@/app/espace/retrait/actions", () => ({ remettreCommandeRetrait }));
const JETON = "q7Kx2mPZ9vTfW8LrB4n1aE";
const resume = { etat: "ok" as const, commande: "c1", numero: 128, prenom: "Amine", total: 6300, expire_le: "2026-10-10T17:30:00Z", terminee_le: null, mode_remise: null, lignes: [] };
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("US-26.3 : résumé et « Remis au client »", () => {
  it("remet par le QR code, une seule fois même avec deux touches rapides", async () => {
    let finir!: (v: unknown) => void;
    remettreCommandeRetrait.mockReturnValue(new Promise(r => { finir = r; }));
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    const bouton = screen.getByRole("button", { name: "Remis au client" });
    fireEvent.click(bouton); fireEvent.click(bouton);
    expect(remettreCommandeRetrait).toHaveBeenCalledTimes(1);
    expect(remettreCommandeRetrait).toHaveBeenCalledWith({ jeton: JETON });
    finir({ succes: true, message: "Commande remise", resume: { ...resume, etat: "remise" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Commande remise");
    expect(screen.getByText(/N° 128 · 6\s300\sDA · Elle passe en « Récupérée »/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scanner une autre commande" })).toHaveAttribute("href", "/espace/scanner");
  });
  it("remise refusée (déjà remise par un autre scan) : message, pas d’écran de succès", async () => {
    remettreCommandeRetrait.mockResolvedValue({ succes: false, message: "Déjà remise le 10/10 à 17 h 05." });
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    fireEvent.click(screen.getByRole("button", { name: "Remis au client" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Déjà remise le 10/10 à 17 h 05.");
    expect(screen.queryByText("Commande remise")).toBeNull();
  });
});

describe("US-27.4 : bon parrainage dans le résumé du scan", () => {
  it("Sous-total, « Bon parrainage BleDeal −300 DA », À encaisser 6 000 DA et remboursement sur le relevé du mois", () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    render(<RetraitBoutique resume={{ ...resume, remise_bon: 300 }} cle={{ jeton: JETON }} />);
    expect(screen.queryByText(/Remise par code/)).toBeNull();
    expect(screen.getByText("Sous-total").nextSibling).toHaveTextContent(/6\s300\sDA/);
    expect(screen.getByText("Bon parrainage BleDeal").nextSibling).toHaveTextContent(/−300\sDA/);
    expect(screen.getByText("À encaisser en espèces").nextSibling).toHaveTextContent(/6\s000\sDA/);
    expect(screen.getByText(/Ces 300\sDA vous sont remboursés par BleDeal \(relevé de novembre\)\./)).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("après « Remis au client » : montant encaissé réduit et rappel du remboursement", async () => {
    remettreCommandeRetrait.mockResolvedValue({ succes: true, message: "Commande remise", resume: { ...resume, etat: "remise", remise_bon: 300, terminee_le: "2026-10-12T15:00:00Z" } });
    render(<RetraitBoutique resume={{ ...resume, remise_bon: 300 }} cle={{ jeton: JETON }} />);
    fireEvent.click(screen.getByRole("button", { name: "Remis au client" }));
    expect(await screen.findByText(/N° 128 · 6\s000\sDA/)).toBeInTheDocument();
    expect(screen.getByText(/BleDeal vous le rembourse \(relevé d’octobre\)/)).toBeInTheDocument();
  });
  it("sans bon : pas de sous-total ni de ligne de bon, montant plein", () => {
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    expect(screen.queryByText("Sous-total")).toBeNull(); expect(screen.queryByText(/remboursés par BleDeal/)).toBeNull();
    expect(screen.getByText("À encaisser en espèces").nextSibling).toHaveTextContent(/6\s300\sDA/);
  });
});

describe("Relecture n°6, point 2 : par code à 4 chiffres, ni bon ni parrainage", () => {
  it("commande avec bon trouvée par code : pas de déduction, encaisser le total, le bon reste au client", () => {
    render(<RetraitBoutique resume={{ ...resume, remise_bon: 300 }} cle={{ code: "0481" }} />);
    expect(screen.queryByText("Sous-total")).toBeNull(); expect(screen.queryByText(/remboursés par BleDeal/)).toBeNull();
    expect(screen.getByText("À encaisser en espèces").nextSibling).toHaveTextContent(/6\s300\sDA/);
    expect(screen.getByText(/Par code, le bon ne s’applique pas : encaissez 6\s300\sDA\. Le bon reste au client\./)).toBeInTheDocument();
    expect(screen.getByText("Remise par code : ni bon parrainage ni parrainage BleDeal. Scannez plutôt le QR code du client.")).toBeInTheDocument();
  });
  it("sans bon, par code : l’avertissement sur le parrainage reste ; par QR code : aucun avertissement", () => {
    render(<RetraitBoutique resume={resume} cle={{ code: "0481" }} />);
    expect(screen.getByText(/Remise par code : ni bon parrainage ni parrainage BleDeal/)).toBeInTheDocument();
    expect(screen.queryByText(/le bon ne s’applique pas/)).toBeNull();
    cleanup();
    render(<RetraitBoutique resume={resume} cle={{ jeton: JETON }} />);
    expect(screen.queryByText(/Remise par code/)).toBeNull();
  });
});

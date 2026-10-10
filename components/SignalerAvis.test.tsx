import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignalerAvis from "./SignalerAvis";
import { fr } from "@/lib/textes/fr";
import { ar } from "@/lib/textes/ar";

const { envoyerSignalementAvis } = vi.hoisted(() => ({ envoyerSignalementAvis: vi.fn() }));
vi.mock("@/app/visiteurs/actions", () => ({ envoyerSignalementAvis }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("US-32.4 : signaler un avis", () => {
  it("lien « Signaler », les 4 motifs, envoi puis confirmation sans deuxième envoi", async () => {
    envoyerSignalementAvis.mockResolvedValue({ succes: true, message: "Merci, nous allons vérifier." });
    render(<SignalerAvis avisId="v1" auteur="Amine B." t={fr.avis} />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler l’avis de Amine B." }));
    expect(screen.getAllByRole("option").slice(1).map(o => o.textContent)).toEqual(["Faux avis", "Insulte ou propos déplacés", "Informations personnelles", "Autre"]);
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "faux_avis" } });
    fireEvent.change(screen.getByLabelText("Commentaire (facultatif)"), { target: { value: "  Pas une cliente " } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Merci, nous allons vérifier."));
    expect(envoyerSignalementAvis).toHaveBeenCalledWith("v1", "faux_avis", "Pas une cliente");
    expect(screen.queryByText("Signaler")).toBeNull();
  });
  it("sans motif : message, rien n'est envoyé", async () => {
    render(<SignalerAvis avisId="v1" auteur="Amine B." t={fr.avis} />);
    fireEvent.click(screen.getByText("Signaler"));
    fireEvent.submit(screen.getByText("Envoyer le signalement").closest("form")!);
    expect(await screen.findByText("Choisissez un motif.")).toBeTruthy();
    expect(envoyerSignalementAvis).not.toHaveBeenCalled();
  });
  it("refus de la base (déjà signalé) : message affiché, nouvel essai possible", async () => {
    envoyerSignalementAvis.mockResolvedValue({ succes: false, message: "Vous avez déjà signalé cet avis, merci. Il sera examiné rapidement." });
    render(<SignalerAvis avisId="v1" auteur="Amine B." t={fr.avis} />);
    fireEvent.click(screen.getByText("Signaler"));
    fireEvent.change(screen.getByLabelText("Motif du signalement"), { target: { value: "insulte" } });
    fireEvent.click(screen.getByText("Envoyer le signalement"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("déjà signalé"));
    expect((screen.getByText("Envoyer le signalement") as HTMLButtonElement).disabled).toBe(false);
  });
  it("en arabe : « بلّغ » (texte n° 12)", () => {
    render(<SignalerAvis avisId="v1" auteur="Amine B." t={ar.avis} />);
    expect(screen.getByText("بلّغ")).toBeTruthy();
  });
});

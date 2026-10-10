import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import FormulaireAvis from "./FormulaireAvis";
import FournisseurTextes from "./FournisseurTextes";
import { textesDe } from "@/lib/textes";

const { donnerMonAvis } = vi.hoisted(() => ({ donnerMonAvis: vi.fn() }));
vi.mock("@/app/compte/commandes/[id]/avis/actions", () => ({ donnerMonAvis }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); donnerMonAvis.mockResolvedValue({ succes: true, message: "Merci, votre avis est publié." }); });
const FILTRE = "Votre commentaire ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.";

describe("US-32.2 : formulaire « Donner mon avis »", () => {
  it("5 étoiles, 3 puces, commentaire facultatif avec compteur, rappel public, « Publier mon avis »", () => {
    render(<FormulaireAvis commande="c1" />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    for (const puce of ["Bon accueil", "Article conforme", "Rapide"]) expect(screen.getByRole("button", { name: puce })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Commentaire (facultatif)")).toHaveAttribute("maxLength", "300");
    expect(screen.getByText("0/300")).toBeInTheDocument();
    expect(screen.getByText("Votre avis est public avec votre prénom et l’initiale de votre nom.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier mon avis" })).toBeInTheDocument();
  });
  it("note obligatoire : sans étoile, rien n'est envoyé", () => {
    render(<FormulaireAvis commande="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Publier mon avis" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez une note de 1 à 5 étoiles.");
    expect(donnerMonAvis).not.toHaveBeenCalled();
  });
  it("note, puces et commentaire envoyés ; « Merci, votre avis est publié. » et retour à la commande", async () => {
    render(<FormulaireAvis commande="c1" />);
    fireEvent.click(screen.getByRole("radio", { name: "4 sur 5" }));
    expect(screen.getByRole("radio", { name: "4 sur 5" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Rapide" }));
    fireEvent.click(screen.getByRole("button", { name: "Bon accueil" }));
    fireEvent.click(screen.getByRole("button", { name: "Rapide" }));
    fireEvent.change(screen.getByLabelText("Commentaire (facultatif)"), { target: { value: "Très bon accueil." } });
    expect(screen.getByText("17/300")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publier mon avis" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Merci, votre avis est publié.");
    expect(donnerMonAvis).toHaveBeenCalledWith("c1", { note: 4, criteres: ["accueil"], commentaire: "Très bon accueil." });
    expect(screen.getByRole("link", { name: "Retour à la commande" })).toHaveAttribute("href", "/compte/commandes/c1");
  });
  it("commentaire refusé par le filtre : message n° 8, le formulaire reste", async () => {
    donnerMonAvis.mockResolvedValue({ succes: false, message: FILTRE });
    render(<FormulaireAvis commande="c1" />);
    fireEvent.click(screen.getByRole("radio", { name: "5 sur 5" }));
    fireEvent.change(screen.getByLabelText("Commentaire (facultatif)"), { target: { value: "0555 12 34 56" } });
    fireEvent.click(screen.getByRole("button", { name: "Publier mon avis" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(FILTRE);
    expect(screen.getByLabelText("Commentaire (facultatif)")).toHaveValue("0555 12 34 56");
  });
  it("erreur réseau : message général", async () => {
    donnerMonAvis.mockRejectedValue(new Error("réseau"));
    render(<FormulaireAvis commande="c1" />);
    fireEvent.click(screen.getByRole("radio", { name: "3 sur 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Publier mon avis" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Impossible de publier votre avis. Réessayez."));
  });
});

describe("US-32.2 : en arabe (textes n° 3 à 6 du module 18)", () => {
  it("puces, champ, rappel et bouton en arabe", () => {
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><FormulaireAvis commande="c1" /></FournisseurTextes>);
    for (const puce of ["استقبال مليح", "السلعة كيما في الصورة", "زربان"]) expect(screen.getByRole("button", { name: puce })).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة (ماشي لازم)")).toBeInTheDocument();
    expect(screen.getByText("رايك يبان للناس بإسمك والحرف الأول من لقبك.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "انشر رايي" }));
    expect(screen.getByRole("alert")).toHaveTextContent("اختار نقطة من 1 حتى 5 نجوم.");
  });
  it("textes validés de la conception repris tels quels (n° 1, 2, 7, 8)", async () => {
    const { traduireMessage } = await import("@/lib/textes/messages");
    expect(textesDe("ar").avis.donner).toBe("قول رايك");
    expect(textesDe("ar").avis.titre).toBe("رايك في {boutique}");
    expect(traduireMessage("Merci, votre avis est publié.", "ar")).toBe("يعطيك الصحة، رايك تنشر.");
    expect(traduireMessage(FILTRE, "ar")).toBe("ما تقدرش تكتب لينك، ولا نمرة تيليفون، ولا كلام خايب.");
  });
});
